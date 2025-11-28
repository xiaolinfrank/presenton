import asyncio
import os
import mimetypes
from typing import List, Optional
from urllib.parse import urlparse

import aiohttp

import uuid


async def download_file(
    url: str, save_directory: str, headers: Optional[dict] = None
) -> Optional[str]:
    try:
        os.makedirs(save_directory, exist_ok=True)

        parsed_url = urlparse(url)
        original_filename = os.path.basename(parsed_url.path)

        # Always use UUID for unique filename, but preserve the extension
        extension = ""
        if original_filename and "." in original_filename:
            extension = os.path.splitext(original_filename)[1]

        if not extension:
            # Try to get extension from Content-Type header
            async with aiohttp.ClientSession(trust_env=True) as session:
                async with session.head(url, headers=headers) as response:
                    if response.status == 200:
                        content_type = response.headers.get("Content-Type", "")
                        if content_type:
                            guessed_ext = mimetypes.guess_extension(
                                content_type.split(";")[0]
                            )
                            if guessed_ext:
                                extension = guessed_ext

        # Generate unique filename with UUID
        filename = f"{uuid.uuid4()}{extension or '.png'}"
        save_path = os.path.join(save_directory, filename)

        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    with open(save_path, "wb") as file:
                        async for chunk in response.content.iter_chunked(8192):
                            file.write(chunk)
                    print(f"File downloaded successfully: {save_path}")
                    return save_path
                else:
                    print(f"Failed to download file. HTTP status: {response.status}")
                    return None

    except Exception as e:
        print(f"Error downloading file from {url}: {e}")
        return None


async def download_files(
    urls: List[str], save_directory: str, headers: Optional[dict] = None
) -> List[Optional[str]]:
    print(f"Starting download of {len(urls)} files to {save_directory}")
    coroutines = [download_file(url, save_directory, headers) for url in urls]
    results = await asyncio.gather(*coroutines, return_exceptions=True)
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Exception during download of {urls[i]}: {result}")
            final_results.append(None)
        else:
            final_results.append(result)

    successful_downloads = sum(1 for result in final_results if result is not None)
    print(
        f"Download completed: {successful_downloads}/{len(urls)} files downloaded successfully"
    )

    return final_results
