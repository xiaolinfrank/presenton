import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from utils.asset_directory_utils import get_image_generation_logs_directory


class ImageGenerationLogger:
    """
    Logger service for image generation requests.
    Records chat history, access source, and request/response details.
    Logs are saved as JSON files in app_data/logs/image_generation/
    """

    def __init__(self):
        self.logs_directory = get_image_generation_logs_directory()

    def _get_log_file_path(self, log_id: str) -> str:
        """Generate log file path with date-based subdirectory."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        date_directory = os.path.join(self.logs_directory, date_str)
        os.makedirs(date_directory, exist_ok=True)
        return os.path.join(date_directory, f"{log_id}.json")

    def _sanitize_messages_for_log(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Sanitize messages for logging by truncating large base64 image data.
        This prevents log files from becoming too large.
        """
        sanitized = []
        for msg in messages:
            sanitized_msg = {"role": msg.get("role", "unknown")}
            content = msg.get("content", "")

            if isinstance(content, str):
                # Truncate base64 image data in content
                if "base64," in content and len(content) > 1000:
                    # Find and truncate base64 data
                    import re
                    sanitized_content = re.sub(
                        r'(data:image/[^;]+;base64,)[A-Za-z0-9+/=]{100,}',
                        r'\1[BASE64_IMAGE_DATA_TRUNCATED]',
                        content
                    )
                    sanitized_msg["content"] = sanitized_content
                else:
                    sanitized_msg["content"] = content
            elif isinstance(content, list):
                # Handle multimodal content array
                sanitized_content = []
                for item in content:
                    if isinstance(item, dict):
                        if item.get("type") == "image_url":
                            # Truncate image URL data
                            sanitized_item = {
                                "type": "image_url",
                                "image_url": {"url": "[IMAGE_DATA_TRUNCATED]"}
                            }
                        else:
                            sanitized_item = item.copy()
                        sanitized_content.append(sanitized_item)
                    else:
                        sanitized_content.append(item)
                sanitized_msg["content"] = sanitized_content
            else:
                sanitized_msg["content"] = str(content)

            sanitized.append(sanitized_msg)

        return sanitized

    def log_request(
        self,
        request_type: str,
        messages: Optional[List[Dict[str, Any]]] = None,
        prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        image_size: str = "1K",
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        referer: Optional[str] = None,
        origin: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Log an image generation request.

        Args:
            request_type: Type of request ("generate" or "chat/generate")
            messages: Chat messages for multi-turn conversation
            prompt: Simple prompt for single generation
            aspect_ratio: Image aspect ratio
            image_size: Image size configuration
            client_ip: Client IP address
            user_agent: User-Agent header
            referer: Referer header
            origin: Origin header
            extra_headers: Additional headers to log

        Returns:
            Log ID for later reference
        """
        log_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()

        # Build log entry
        log_entry = {
            "log_id": log_id,
            "timestamp": timestamp,
            "request_type": request_type,
            "parameters": {
                "aspect_ratio": aspect_ratio,
                "image_size": image_size,
            },
            "access_source": {
                "client_ip": client_ip,
                "user_agent": user_agent,
                "referer": referer,
                "origin": origin,
                "extra_headers": extra_headers or {},
            },
        }

        # Add chat history or prompt
        if messages:
            log_entry["chat_history"] = self._sanitize_messages_for_log(messages)
            log_entry["message_count"] = len(messages)
        elif prompt:
            log_entry["prompt"] = prompt

        # Write log file
        log_file_path = self._get_log_file_path(log_id)
        with open(log_file_path, "w", encoding="utf-8") as f:
            json.dump(log_entry, f, ensure_ascii=False, indent=2)

        return log_id

    def update_log_with_response(
        self,
        log_id: str,
        success: bool,
        result_path: Optional[str] = None,
        error_message: Optional[str] = None,
        duration_ms: Optional[float] = None,
    ) -> None:
        """
        Update an existing log entry with response information.

        Args:
            log_id: The log ID returned from log_request
            success: Whether the request was successful
            result_path: Path to the generated image (if successful)
            error_message: Error message (if failed)
            duration_ms: Request duration in milliseconds
        """
        # Find the log file
        date_str = datetime.now().strftime("%Y-%m-%d")
        log_file_path = os.path.join(self.logs_directory, date_str, f"{log_id}.json")

        if not os.path.exists(log_file_path):
            # Try to find in other date directories (in case of midnight crossing)
            for dirname in os.listdir(self.logs_directory):
                potential_path = os.path.join(self.logs_directory, dirname, f"{log_id}.json")
                if os.path.exists(potential_path):
                    log_file_path = potential_path
                    break
            else:
                print(f"Warning: Log file not found for log_id: {log_id}")
                return

        # Read existing log
        with open(log_file_path, "r", encoding="utf-8") as f:
            log_entry = json.load(f)

        # Update with response
        log_entry["response"] = {
            "success": success,
            "completed_at": datetime.now().isoformat(),
        }

        if result_path:
            log_entry["response"]["result_path"] = result_path
        if error_message:
            log_entry["response"]["error_message"] = error_message
        if duration_ms is not None:
            log_entry["response"]["duration_ms"] = duration_ms

        # Write updated log
        with open(log_file_path, "w", encoding="utf-8") as f:
            json.dump(log_entry, f, ensure_ascii=False, indent=2)


# Singleton instance for easy access
_logger_instance: Optional[ImageGenerationLogger] = None


def get_image_generation_logger() -> ImageGenerationLogger:
    """Get or create the image generation logger instance."""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = ImageGenerationLogger()
    return _logger_instance
