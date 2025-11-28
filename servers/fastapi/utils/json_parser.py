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
    cleaned_text = text.strip()

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
    return dict(dirtyjson.loads(cleaned_text))
