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
    is_z_image_selected,
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
        elif is_z_image_selected():
            return self.generate_image_z_image
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
            elif is_z_image_selected():
                # Pass aspect_ratio for Z-Image generation
                image_path = await self.image_gen_func(
                    image_prompt, self.output_directory, aspect_ratio
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
        Uses direct HTTP request instead of OpenAI SDK to support custom generationConfig.
        """
        import base64
        import re
        import json

        openai_url = get_openai_image_url_env() or get_openai_url_env()
        openai_api_key = get_openai_image_api_key_env() or get_openai_api_key_env()
        model = get_openai_image_model_env() or "gemini-3-pro-image-preview"

        print(f"OpenAI Chat Image Generation - Model: {model}, Aspect Ratio: {aspect_ratio}, Image Size: {image_size}")

        # Build the API URL
        if openai_url:
            # Remove trailing slash and ensure /chat/completions endpoint
            base_url = openai_url.rstrip('/')
            if not base_url.endswith('/v1'):
                base_url = base_url.rstrip('/') + '/v1'
            api_url = f"{base_url}/chat/completions"
        else:
            api_url = "https://api.openai.com/v1/chat/completions"

        # Build request payload with generationConfig at root level
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": f"Please generate an image directly (do not describe or explain, just create the image): {prompt}"
                }
            ],
            "stream": True,  # Use streaming to get chunked response
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": image_size
                }
            }
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if openai_api_key:
            headers["Authorization"] = f"Bearer {openai_api_key}"

        print(f"OpenAI Chat API URL: {api_url}")
        print(f"OpenAI Chat Payload: {json.dumps(payload, indent=2)}")

        # Make async HTTP request using aiohttp with streaming
        message_content = ""
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.post(api_url, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API request failed with status {response.status}: {error_text}")

                # Read entire response and process SSE format
                # Cannot use line-by-line iteration because base64 image chunks are very large
                full_response = await response.text()

                # Split by SSE event boundaries (data: prefix)
                for line in full_response.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    # Handle SSE format: data: {...}
                    if line.startswith("data: "):
                        line = line[6:]  # Remove "data: " prefix
                    if line == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(line)
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            # Extract content from delta (image data is in content field)
                            if "content" in delta:
                                message_content += delta["content"]
                    except json.JSONDecodeError:
                        # Skip non-JSON lines
                        continue

        if not message_content:
            raise Exception("No content received from streaming response")

        print(f"Response content (first 500 chars): {message_content[:500]}")

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

    async def generate_image_chat(
        self,
        messages: list,
        aspect_ratio: str = "1:1",
        image_size: str = "1K"
    ) -> str:
        """
        Generate image using multi-turn chat conversation.
        Messages should be a list of {"role": "user"|"assistant", "content": "..."} dicts.
        Images in assistant messages should be in markdown format: ![image](data:image/png;base64,...)
        """
        import base64
        import re
        import json

        openai_url = get_openai_image_url_env() or get_openai_url_env()
        openai_api_key = get_openai_image_api_key_env() or get_openai_api_key_env()
        model = get_openai_image_model_env() or "gemini-3-pro-image-preview"

        print(f"OpenAI Chat Image Generation (Multi-turn) - Model: {model}, Messages: {len(messages)}, Aspect Ratio: {aspect_ratio}, Image Size: {image_size}")

        # Build the API URL
        if openai_url:
            base_url = openai_url.rstrip('/')
            if not base_url.endswith('/v1'):
                base_url = base_url.rstrip('/') + '/v1'
            api_url = f"{base_url}/chat/completions"
        else:
            api_url = "https://api.openai.com/v1/chat/completions"

        # Build request payload with conversation history
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": image_size
                }
            }
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if openai_api_key:
            headers["Authorization"] = f"Bearer {openai_api_key}"

        print(f"OpenAI Chat API URL: {api_url}")

        # Make async HTTP request
        message_content = ""
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.post(api_url, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API request failed with status {response.status}: {error_text}")

                full_response = await response.text()

                for line in full_response.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    if line == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(line)
                        if "choices" in chunk and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                message_content += delta["content"]
                    except json.JSONDecodeError:
                        continue

        if not message_content:
            raise Exception("No content received from streaming response")

        print(f"Response content (first 500 chars): {message_content[:500]}")

        # Extract image from response
        image_path = os.path.join(self.output_directory, f"{uuid.uuid4()}.png")

        # Try to find base64 image in markdown format
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
            return await download_file(image_url, self.output_directory)

        # If the entire content looks like base64
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

    async def generate_image_z_image(
        self,
        prompt: str,
        output_directory: str,
        aspect_ratio: str = "1:1"
    ) -> str:
        """
        Generate image using Tongyi-MAI/Z-Image-Turbo via Gradio API.
        This model only supports single-turn conversations.

        Args:
            prompt: The image generation prompt
            output_directory: Directory to save the generated image
            aspect_ratio: Aspect ratio in format "W:H" (e.g., "1:1", "16:9")

        Returns:
            Path to the generated image
        """
        import shutil
        from gradio_client import Client

        # Map aspect ratio to Z-Image resolution format
        # Z-Image uses format like "1024x1024 ( 1:1 )"
        aspect_ratio_map = {
            "1:1": "1024x1024 ( 1:1 )",
            "9:7": "1152x896 ( 9:7 )",
            "7:9": "896x1152 ( 7:9 )",
            "4:3": "1152x864 ( 4:3 )",
            "3:4": "864x1152 ( 3:4 )",
            "3:2": "1248x832 ( 3:2 )",
            "2:3": "832x1248 ( 2:3 )",
            "16:9": "1280x720 ( 16:9 )",
            "9:16": "720x1280 ( 9:16 )",
            "21:9": "1344x576 ( 21:9 )",
            "9:21": "576x1344 ( 9:21 )",
            # Additional larger resolutions
            "4:5": "1024x1280 ( 4:5 )",  # Map 4:5 to closest available
            "5:4": "1280x1024 ( 5:4 )",  # Map 5:4 to closest available
        }

        # Default to 1:1 if aspect ratio not found
        resolution = aspect_ratio_map.get(aspect_ratio, "1024x1024 ( 1:1 )")

        print(f"Z-Image Generation - Prompt: {prompt[:100]}..., Resolution: {resolution}")

        # Run gradio client in thread pool to avoid blocking
        def call_z_image():
            client = Client("Tongyi-MAI/Z-Image-Turbo")
            result = client.predict(
                prompt=prompt,
                resolution=resolution,
                seed=42,
                steps=8,
                shift=3,
                random_seed=True,
                gallery_images=[],
                api_name="/generate"
            )
            return result

        result = await asyncio.to_thread(call_z_image)

        print(f"Z-Image Result: {result}")

        # Extract image path from result
        # The result is a tuple: (gallery, seed_str, seed_int)
        # gallery is list[dict(image: dict(path: str, ...), ...)]
        gallery = result[0]
        if not gallery or len(gallery) == 0:
            raise Exception("Z-Image returned empty gallery")

        first_item = gallery[0]
        image_path = None

        # Handle potential variations in return structure
        if isinstance(first_item, dict):
            if 'image' in first_item and isinstance(first_item['image'], dict) and 'path' in first_item['image']:
                image_path = first_item['image']['path']
            elif 'image' in first_item and isinstance(first_item['image'], str):
                image_path = first_item['image']

        if not image_path or not os.path.exists(image_path):
            raise Exception(f"Could not extract valid image path from Z-Image result: {first_item}")

        # Copy image to output directory
        file_name = f"{uuid.uuid4()}.png"
        dest_path = os.path.join(output_directory, file_name)
        shutil.copy(image_path, dest_path)

        print(f"Z-Image: Image saved to {dest_path}")
        return dest_path
