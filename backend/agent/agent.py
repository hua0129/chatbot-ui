import os
import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_TOKEN = os.getenv("GEMINI_TOKEN")
HF_TOKEN = os.getenv("HF_TOKEN")

# Route to correct model
def query_llm(user_input: str, model: str = "huggingface") -> str:
    if model == "gemini":
        return query_gemini(user_input)
    return query_huggingface(user_input)


# Gemini integration with retry
def query_gemini(user_input: str) -> str:
    if not GEMINI_TOKEN:
        return "Gemini API key is missing. Check your .env and variable name."

    API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_TOKEN}"

    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "contents": [
            {
                "parts": [{"text": user_input}]
            }
        ]
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print("Gemini API error:", e)
        return "Error fetching response from Gemini"

# Hugging Face model call
def query_huggingface(user_input: str) -> str:
    API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {
        "inputs": f"User: {user_input}\nAssistant:",
        "parameters": {"max_new_tokens": 200, "temperature": 0.4}
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        generated = response.json()
        if isinstance(generated, list):
            return generated[0]["generated_text"].split("Assistant:")[-1].strip()
        return "No response received from the model."
    except Exception as e:
        print("Hugging Face API error:", e)
        return "Error fetching response from Hugging Face"