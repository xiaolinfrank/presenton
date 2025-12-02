import time
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from models.image_prompt import ImagePrompt
from models.sql.image_asset import ImageAsset
from services.database import get_async_session
from services.image_generation_service import ImageGenerationService
from services.image_generation_logger import get_image_generation_logger
from utils.asset_directory_utils import get_images_directory
import os
import uuid
from utils.file_utils import get_file_name_with_random_uuid


def get_access_source_from_request(request: Request) -> dict:
    """Extract access source information from FastAPI Request object."""
    # Get client IP (considering proxy headers)
    client_ip = request.client.host if request.client else None
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    return {
        "client_ip": client_ip,
        "user_agent": request.headers.get("user-agent"),
        "referer": request.headers.get("referer"),
        "origin": request.headers.get("origin"),
        "extra_headers": {
            "x-forwarded-for": forwarded_for,
            "x-real-ip": request.headers.get("x-real-ip"),
            "accept-language": request.headers.get("accept-language"),
        }
    }

IMAGES_ROUTER = APIRouter(prefix="/images", tags=["Images"])


# Models for multi-turn chat
from typing import Union, Any

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: Union[str, List[Any]]  # Text content or multimodal content array


class ChatGenerateRequest(BaseModel):
    messages: List[ChatMessage]
    aspect_ratio: str = "1:1"
    image_size: str = "1K"


@IMAGES_ROUTER.get("/generate")
async def generate_image(
    request: Request,
    prompt: str,
    aspect_ratio: str = "1:1",
    image_size: str = "1K",
    sql_session: AsyncSession = Depends(get_async_session)
):
    # Start logging
    logger = get_image_generation_logger()
    access_source = get_access_source_from_request(request)
    start_time = time.time()

    log_id = logger.log_request(
        request_type="generate",
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        image_size=image_size,
        **access_source
    )

    images_directory = get_images_directory()
    image_prompt = ImagePrompt(prompt=prompt)
    image_generation_service = ImageGenerationService(images_directory)

    try:
        image = await image_generation_service.generate_image(
            image_prompt,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
            raise_on_error=True
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.update_log_with_response(
            log_id=log_id,
            success=False,
            error_message=str(e),
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=str(e))

    if not isinstance(image, ImageAsset):
        duration_ms = (time.time() - start_time) * 1000
        logger.update_log_with_response(
            log_id=log_id,
            success=True,
            result_path=image,
            duration_ms=duration_ms
        )
        return image

    sql_session.add(image)
    await sql_session.commit()

    duration_ms = (time.time() - start_time) * 1000
    logger.update_log_with_response(
        log_id=log_id,
        success=True,
        result_path=image.path,
        duration_ms=duration_ms
    )

    return image.path


@IMAGES_ROUTER.post("/chat/generate")
async def generate_image_chat(
    http_request: Request,
    request: ChatGenerateRequest,
    sql_session: AsyncSession = Depends(get_async_session)
):
    """
    Generate image using multi-turn chat conversation.
    Messages should include conversation history with images in markdown format.
    """
    # Start logging
    logger = get_image_generation_logger()
    access_source = get_access_source_from_request(http_request)
    start_time = time.time()

    # Convert messages to the format expected by the service
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    log_id = logger.log_request(
        request_type="chat/generate",
        messages=messages,
        aspect_ratio=request.aspect_ratio,
        image_size=request.image_size,
        **access_source
    )

    images_directory = get_images_directory()
    image_generation_service = ImageGenerationService(images_directory)

    try:
        image = await image_generation_service.generate_image_chat(
            messages=messages,
            aspect_ratio=request.aspect_ratio,
            image_size=request.image_size,
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.update_log_with_response(
            log_id=log_id,
            success=False,
            error_message=str(e),
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=str(e))

    if not isinstance(image, ImageAsset):
        duration_ms = (time.time() - start_time) * 1000
        logger.update_log_with_response(
            log_id=log_id,
            success=True,
            result_path=image,
            duration_ms=duration_ms
        )
        return image

    sql_session.add(image)
    await sql_session.commit()

    duration_ms = (time.time() - start_time) * 1000
    logger.update_log_with_response(
        log_id=log_id,
        success=True,
        result_path=image.path,
        duration_ms=duration_ms
    )

    return image.path


@IMAGES_ROUTER.get("/generated", response_model=List[ImageAsset])
async def get_generated_images(sql_session: AsyncSession = Depends(get_async_session)):
    try:
        images = await sql_session.scalars(
            select(ImageAsset)
            .where(ImageAsset.is_uploaded == False)
            .order_by(ImageAsset.created_at.desc())
        )
        return images
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve generated images: {str(e)}"
        )


@IMAGES_ROUTER.post("/upload")
async def upload_image(
    file: UploadFile = File(...), sql_session: AsyncSession = Depends(get_async_session)
):
    try:
        new_filename = get_file_name_with_random_uuid(file)
        image_path = os.path.join(
            get_images_directory(), os.path.basename(new_filename)
        )

        with open(image_path, "wb") as f:
            f.write(await file.read())

        image_asset = ImageAsset(path=image_path, is_uploaded=True)

        sql_session.add(image_asset)
        await sql_session.commit()

        return image_asset
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@IMAGES_ROUTER.get("/uploaded", response_model=List[ImageAsset])
async def get_uploaded_images(sql_session: AsyncSession = Depends(get_async_session)):
    try:
        images = await sql_session.scalars(
            select(ImageAsset)
            .where(ImageAsset.is_uploaded == True)
            .order_by(ImageAsset.created_at.desc())
        )
        return images
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve uploaded images: {str(e)}"
        )


@IMAGES_ROUTER.delete("/{id}", status_code=204)
async def delete_uploaded_image_by_id(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    try:
        # Fetch the asset to get its actual file path
        image = await sql_session.get(ImageAsset, id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        os.remove(image.path)

        await sql_session.delete(image)
        await sql_session.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")


class ZImageGenerateRequest(BaseModel):
    """Request model for Z-Image generation (single-turn only)."""
    prompt: str
    aspect_ratio: str = "1:1"


@IMAGES_ROUTER.post("/z-image/generate")
async def generate_image_z_image(
    http_request: Request,
    request: ZImageGenerateRequest,
    sql_session: AsyncSession = Depends(get_async_session)
):
    """
    Generate image using Z-Image model (Tongyi-MAI/Z-Image-Turbo).
    This endpoint is specifically for Z-Image which only supports single-turn conversations.
    After each generation, users should start a new conversation.
    """
    # Start logging
    logger = get_image_generation_logger()
    access_source = get_access_source_from_request(http_request)
    start_time = time.time()

    log_id = logger.log_request(
        request_type="z-image/generate",
        prompt=request.prompt,
        aspect_ratio=request.aspect_ratio,
        image_size="1K",  # Z-Image has fixed resolution based on aspect ratio
        **access_source
    )

    images_directory = get_images_directory()
    image_generation_service = ImageGenerationService(images_directory)

    try:
        image = await image_generation_service.generate_image_z_image(
            prompt=request.prompt,
            output_directory=images_directory,
            aspect_ratio=request.aspect_ratio,
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.update_log_with_response(
            log_id=log_id,
            success=False,
            error_message=str(e),
            duration_ms=duration_ms
        )
        raise HTTPException(status_code=500, detail=str(e))

    # Create ImageAsset for database storage
    image_asset = ImageAsset(
        path=image,
        is_uploaded=False,
        extras={
            "prompt": request.prompt,
            "model": "z-image",
            "aspect_ratio": request.aspect_ratio,
        },
    )

    sql_session.add(image_asset)
    await sql_session.commit()

    duration_ms = (time.time() - start_time) * 1000
    logger.update_log_with_response(
        log_id=log_id,
        success=True,
        result_path=image,
        duration_ms=duration_ms
    )

    return image
