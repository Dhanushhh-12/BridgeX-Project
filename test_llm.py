"""
test_llm.py - Step 13.3: Simple verification script for the free local Ollama LLM.
Connects to http://localhost:11434, sends a short test prompt to qwen2.5:0.5b,
prints the response, and handles connection or model errors cleanly.
"""

import httpx
import ollama

from backend.llm_config import OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_TIMEOUT_SECONDS, get_ollama_client


def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Local Ollama LLM Connection Test (Step 13.3)")
    print("=" * 65)
    print(f"Ollama Host : {OLLAMA_HOST}")
    print(f"Model Name  : {OLLAMA_MODEL}")
    print(f"Timeout     : {OLLAMA_TIMEOUT_SECONDS}s")

    prompt = "In two short sentences, how can weather and site photos help monitor bridge construction?"
    print(f"\nSending Prompt:\n  {prompt}\n")

    try:
        client = get_ollama_client()
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        )
        reply_text = response["message"]["content"].strip()
        print("Local LLM Reply:")
        print("-" * 65)
        print(reply_text)
        print("-" * 65)
        print("SUCCESS: Connected to local Ollama and received a valid response!")
    except (httpx.ConnectError, ConnectionError, OSError) as err:
        print(f"Connection Error: Could not reach Ollama at {OLLAMA_HOST}.")
        print("Fix: Start the Ollama app from Windows Start Menu (or run 'ollama serve').")
        print(f"Details: {err}")
    except httpx.TimeoutException:
        print(f"Timeout Error: Ollama took longer than {OLLAMA_TIMEOUT_SECONDS}s to respond.")
        print("Fix: Close unused heavy apps to free RAM and try again.")
    except ollama.ResponseError as err:
        print(f"Ollama Model Error ({err.status_code}): {err.error}")
        print(f"Fix: Make sure the model is downloaded using: ollama pull {OLLAMA_MODEL}")
    except Exception as err:
        print(f"Unexpected Error: {err}")


if __name__ == "__main__":
    main()
