from enum import Enum

class ImageProvider(Enum):
    PEXELS = "pexels"
    PIXABAY = "pixabay"
    GEMINI_FLASH = "gemini_flash"
    DALLE3 = "dall-e-3"
    OPENAI_CHAT = "openai_chat"  # For models that generate images via Chat Completions API
