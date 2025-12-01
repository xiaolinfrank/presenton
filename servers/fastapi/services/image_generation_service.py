import asyncio
import os
import aiohttp
from google import genai
from google.genai.types import GenerateContentConfig
from openai import AsyncOpenAI
from models.image_prompt import ImagePrompt
from models.sql.image_asset import ImageAsset
from utils.download_helpers import download_file
from utils.get_env import (
    get_google_api_key_env,
    get_google_image_api_key_env,
    get_google_image_model_env,
    get_google_image_url_env,
    get_google_url_env,
    get_openai_api_key_env,
    get_openai_image_api_key_env,
    get_openai_image_model_env,
    get_openai_image_url_env,
    get_openai_url_env,
    get_pexels_api_key_env,
    get_pixabay_api_key_env,
)
from utils.image_provider import (
    is_image_generation_disabled,
    is_pixels_selected,
    is_pixabay_selected,
    is_gemini_flash_selected,
    is_dalle3_selected,
    is_openai_chat_selected,
)
import uuid


class ImageGenerationService:
    def __init__(self, output_directory: str):
        self.output_directory = output_directory
        self.is_image_generation_disabled = is_image_generation_disabled()
        self.image_gen_func = self.get_image_gen_func()

    def get_image_gen_func(self):
        if self.is_image_generation_disabled:
            return None

        if is_pixabay_selected():
            return self.get_image_from_pixabay
        elif is_pixels_selected():
            return self.get_image_from_pexels
        elif is_gemini_flash_selected():
            return self.generate_image_google
        elif is_dalle3_selected():
            return self.generate_image_openai
        elif is_openai_chat_selected():
            return self.generate_image_openai_chat
        return None

    def is_stock_provider_selected(self):
        return is_pixels_selected() or is_pixabay_selected()

    async def generate_image(
        self,
        prompt: ImagePrompt,
        aspect_ratio: str = "1:1",
        image_size: str = "1K",
        raise_on_error: bool = False
    ) -> str | ImageAsset:
        """
        Generates an image based on the provided prompt.
        - If no image generation function is available, returns a placeholder image.
        - If the stock provider is selected, it uses the prompt directly,
        otherwise it uses the full image prompt with theme.
        - Output Directory is used for saving the generated image not the stock provider.
        - If raise_on_error is True, exceptions are re-raised instead of returning placeholder.
        """
        if self.is_image_generation_disabled:
            msg = "Image generation is disabled."
            print(msg)
            if raise_on_error:
                raise Exception(msg)
            return "/static/images/placeholder.jpg"

        if not self.image_gen_func:
            msg = "No image generation function found. Check IMAGE_PROVIDER configuration."
            print(msg)
            if raise_on_error:
                raise Exception(msg)
            return "/static/images/placeholder.jpg"

        image_prompt = prompt.get_image_prompt(
            with_theme=not self.is_stock_provider_selected()
        )
        print(f"Request - Generating Image for {image_prompt}")

        try:
            if self.is_stock_provider_selected():
                image_path = await self.image_gen_func(image_prompt)
            elif is_openai_chat_selected():
                # Pass aspect_ratio and image_size for OpenAI Chat-based image generation
                image_path = await self.image_gen_func(
                    image_prompt, self.output_directory, aspect_ratio, image_size
                )
            else:
                image_path = await self.image_gen_func(
                    image_prompt, self.output_directory
                )
            if image_path:
                if image_path.startswith("http"):
                    return image_path
                elif os.path.exists(image_path):
                    return ImageAsset(
                        path=image_path,
                        is_uploaded=False,
                        extras={
                            "prompt": prompt.prompt,
                            "theme_prompt": prompt.theme_prompt,
                        },
                    )
            raise Exception(f"Image not found at {image_path}")

        except Exception as e:
            print(f"Error generating image: {e}")
            if raise_on_error:
                raise
            return "/static/images/placeholder.jpg"

    async def generate_image_openai(self, prompt: str, output_directory: str) -> str:
        openai_url = get_openai_image_url_env() or get_openai_url_env()
        openai_api_key = get_openai_image_api_key_env() or get_openai_api_key_env()

        # Build client with optional parameters
        client_kwargs = {}
        if openai_url:
            client_kwargs['base_url'] = openai_url
        if openai_api_key:
            client_kwargs['api_key'] = openai_api_key

        client = AsyncOpenAI(**client_kwargs)
        model = get_openai_image_model_env() or "dall-e-3"
        result = await client.images.generate(
            model=model,
            prompt=prompt,
            n=1,
            quality="standard",
            size="1024x1024",
        )
        image_url = result.data[0].url
        return await download_file(image_url, output_directory)

    async def generate_image_google(self, prompt: str, output_directory: str) -> str:
        google_url = get_google_image_url_env() or get_google_url_env()
        google_api_key = get_google_image_api_key_env() or get_google_api_key_env()

        # Build client with optional parameters
        client_kwargs = {}
        if google_url:
            client_kwargs['http_options'] = {'api_endpoint': google_url}
        if google_api_key:
            client_kwargs['api_key'] = google_api_key

        client = genai.Client(**client_kwargs)
        model = get_google_image_model_env() or "gemini-2.5-flash-image-preview"
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=[prompt],
            config=GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )

        for part in response.candidates[0].content.parts:
            if part.text is not None:
                print(part.text)
            elif part.inline_data is not None:
                image_path = os.path.join(output_directory, f"{uuid.uuid4()}.jpg")
                with open(image_path, "wb") as f:
                    f.write(part.inline_data.data)

        return image_path

    async def generate_image_openai_chat(
        self,
        prompt: str,
        output_directory: str,
        aspect_ratio: str = "1:1",
        image_size: str = "1K"
    ) -> str:
        """
        Generate image using OpenAI-compatible Chat Completions API.
        This is for models like gemini-3-pro-image-preview that generate images
        through the chat completions endpoint instead of the images/generations endpoint.
        """
        import base64
        import re

        openai_url = get_openai_image_url_env() or get_openai_url_env()
        openai_api_key = get_openai_image_api_key_env() or get_openai_api_key_env()

        # Build client with optional parameters
        client_kwargs = {}
        if openai_url:
            client_kwargs['base_url'] = openai_url
        if openai_api_key:
            client_kwargs['api_key'] = openai_api_key

        client = AsyncOpenAI(**client_kwargs)
        model = get_openai_image_model_env() or "gemini-3-pro-image-preview"

        print(f"OpenAI Chat Image Generation - Model: {model}, Aspect Ratio: {aspect_ratio}, Image Size: {image_size}")

        # Use chat completions API for image generation with extra_body for custom parameters
        # The prompt must clearly instruct the model to generate an image, not describe how to generate one
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": f"Please generate an image directly (do not describe or explain, just create the image): {prompt}"
                }
            ],
            stream=False,
            extra_body={
                "generationConfig": {
                    "responseModalities": ["TEXT", "IMAGE"],
                    "imageConfig": {
                        "aspectRatio": aspect_ratio,
                        "imageSize": image_size
                    }
                }
            }
        )

        # Extract image from response
        # The response may contain base64 image data in various formats
        message_content = response.choices[0].message.content

        # Check if the response contains base64 image data
        # Common patterns: data:image/png;base64,... or just base64 string
        image_path = os.path.join(output_directory, f"{uuid.uuid4()}.png")

        # Try to find base64 image in markdown format: ![...](data:image/...;base64,...)
        markdown_pattern = r'!\[.*?\]\(data:image/[^;]+;base64,([A-Za-z0-9+/=]+)\)'
        markdown_match = re.search(markdown_pattern, message_content)
        if markdown_match:
            image_data = base64.b64decode(markdown_match.group(1))
            with open(image_path, "wb") as f:
                f.write(image_data)
            return image_path

        # Try to find base64 image with data URL prefix
        data_url_pattern = r'data:image/[^;]+;base64,([A-Za-z0-9+/=]+)'
        data_url_match = re.search(data_url_pattern, message_content)
        if data_url_match:
            image_data = base64.b64decode(data_url_match.group(1))
            with open(image_path, "wb") as f:
                f.write(image_data)
            return image_path

        # Try to find a URL to an image
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp)'
        url_match = re.search(url_pattern, message_content, re.IGNORECASE)
        if url_match:
            image_url = url_match.group(0)
            return await download_file(image_url, output_directory)

        # If the entire content looks like base64 (no other text)
        if message_content and re.match(r'^[A-Za-z0-9+/=]+$', message_content.strip()):
            try:
                image_data = base64.b64decode(message_content.strip())
                with open(image_path, "wb") as f:
                    f.write(image_data)
                return image_path
            except Exception:
                pass

        raise Exception(f"Could not extract image from response: {message_content[:200]}...")

    async def get_image_from_pexels(self, prompt: str) -> str:
        async with aiohttp.ClientSession(trust_env=True) as session:
            response = await session.get(
                f"https://api.pexels.com/v1/search?query={prompt}&per_page=1",
                headers={"Authorization": f"{get_pexels_api_key_env()}"},
            )
            data = await response.json()
            image_url = data["photos"][0]["src"]["large"]
            return image_url

    async def get_image_from_pixabay(self, prompt: str) -> str:
        async with aiohttp.ClientSession(trust_env=True) as session:
            response = await session.get(
                f"https://pixabay.com/api/?key={get_pixabay_api_key_env()}&q={prompt}&image_type=photo&per_page=3"
            )
            data = await response.json()
            image_url = data["hits"][0]["largeImageURL"]
            return image_url
