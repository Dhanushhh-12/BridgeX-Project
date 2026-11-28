"""
backend/llm_config.py - Step 13.3: Free local Ollama LLM configuration.
Connects to the local Ollama service at http://localhost:11434 using
qwen2.5:0.5b without requiring any paid API keys or cloud subscriptions.
"""

import os
import ollama
from dotenv import load_dotenv

# Load optional local overrides from .env if present (no API key required)
load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60"))


def get_ollama_client() -> ollama.Client:
    """Create a configured Ollama client pointing to the local Ollama service."""
    return ollama.Client(host=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT_SECONDS)
