"""Utility for parsing JSON from LLM responses with compatibility for various providers"""
import re
import dirtyjson


def clean_json_response(text: str) -> str:
    """
    Clean up JSON response text from LLM providers.

    Some providers (like Zhipu AI) wrap JSON in markdown code blocks.
    This function strips those markers for compatibility.

    Args:
        text: Raw text response from LLM

    Returns:
        Cleaned text ready for JSON parsing
    """
    import logging

    if text is None:
        logging.warning("[JSON Parser] Received None text, returning empty string")
        return ""

    if not isinstance(text, str):
        logging.warning(f"[JSON Parser] Received non-string text: {type(text)}, converting to string")
        text = str(text)

    cleaned_text = text.strip()

    logging.debug(f"[JSON Parser] Input text preview: {text[:200] if len(text) > 200 else text}")

    # Remove markdown code block wrappers like ```json...``` or ```...```
    if cleaned_text.startswith("```"):
        # Find the first newline after opening ```
        first_newline = cleaned_text.find("\n")
        if first_newline != -1:
            # Remove opening ```json or ```
            cleaned_text = cleaned_text[first_newline + 1:]

        # Remove closing ```
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3].rstrip()

    # Remove trailing commas before closing braces/brackets
    # This handles cases like: {"key": "value",} or ["item1", "item2",]
    cleaned_text = re.sub(r',\s*}', '}', cleaned_text)
    cleaned_text = re.sub(r',\s*]', ']', cleaned_text)

    # Fix duplicate opening braces (common LLM error)
    # Pattern like: { { "content" -> { "content"
    cleaned_text = re.sub(r'\{\s*\{(\s*")', r'{\1', cleaned_text)

    # Fix duplicate closing braces
    # Pattern like: } } -> }
    cleaned_text = re.sub(r'\}\s*\}(\s*[,\]\}])', r'}\1', cleaned_text)

    # Fix missing closing brace after icon/image nested objects
    # When LLM forgets to close the parent object after a nested object
    # Pattern: "__icon_query__": "..." }, { " -> "__icon_query__": "..." } }, { "
    # Pattern: "__image_prompt__": "..." }, { " -> "__image_prompt__": "..." } }, { "
    cleaned_text = re.sub(
        r'("__(?:icon_query|image_prompt)__"\s*:\s*"[^"]*"\s*\})\s*,\s*(\{)',
        r'\1 }, \2',
        cleaned_text
    )

    # Fix missing closing brace at end of array (last element)
    # When LLM forgets to close the parent object before array closing bracket
    # Pattern: "__icon_query__": "..." } ] -> "__icon_query__": "..." } } ]
    cleaned_text = re.sub(
        r'("__(?:icon_query|image_prompt)__"\s*:\s*"[^"]*"\s*\})\s*(\])',
        r'\1 } \2',
        cleaned_text
    )

    # Fix missing closing brace before __speaker_note__
    # When LLM forgets to close the media object after image/icon nested object
    # Pattern: "__image_prompt__": "..." }, "__speaker_note__" -> "__image_prompt__": "..." } }, "__speaker_note__"
    cleaned_text = re.sub(
        r'("__(?:icon_query|image_prompt)__"\s*:\s*"[^"]*"\s*\})\s*,\s*("__speaker_note__")',
        r'\1 }, \2',
        cleaned_text
    )

    return cleaned_text


def parse_json_response(text: str) -> dict:
    """
    Parse JSON from LLM response with automatic cleanup.

    Args:
        text: Raw text response from LLM

    Returns:
        Parsed JSON as dictionary

    Raises:
        ValueError: If JSON parsing fails
    """
    cleaned_text = clean_json_response(text)
    try:
        return dict(dirtyjson.loads(cleaned_text))
    except Exception as e:
        import logging
        logging.error(f"DEBUG: Failed to parse. Full response:\n{text}\n")
        raise
