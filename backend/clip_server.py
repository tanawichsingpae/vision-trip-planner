from dotenv import load_dotenv
load_dotenv()
import os
from io import BytesIO
from pyexpat.errors import messages

from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
from PIL import Image
import open_clip
import requests

import google.generativeai as genai
from openai import OpenAI

# --------------------
# AI Config
# --------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None

# --------------------
# Flask setup
# --------------------

app = Flask(__name__)
CORS(app, origins=[
    "https://vision-trip-planner.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
])


# --------------------
# Device
# --------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

# --------------------
# Eager-load model
# --------------------

import threading

_model_lock = threading.Lock()
model = None
preprocess = None


def load_model():
    """Load CLIP model if not already loaded (thread-safe)."""
    global model, preprocess

    if model is not None:
        return

    with _model_lock:
        if model is None:
            print("Loading CLIP model...")

            model_instance, _, preprocess_instance = open_clip.create_model_and_transforms(
                "ViT-B-32",
                pretrained="openai"
            )

            model_instance.to(device)
            model_instance.eval()

            preprocess = preprocess_instance
            model = model_instance
            print(f"CLIP model loaded successfully on {device}!")


# --------------------
# Health check
# --------------------

@app.route("/")
def home():
    return jsonify({
        "status": "running"
    })


@app.route("/health")
def health():
    return jsonify({
        "status": "ok"
    })


# --------------------
# Embedding from upload
# --------------------

@app.route("/embedding", methods=["POST"])
def get_embedding():

    load_model()

    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    try:
        file = request.files["image"]

        img = Image.open(file).convert("RGB")

        img_preprocessed = preprocess(img).unsqueeze(0).to(device)

        with torch.no_grad():

            image_features = model.encode_image(img_preprocessed)

            image_features /= image_features.norm(dim=-1, keepdim=True)

            embedding_list = (
                image_features.cpu()
                .numpy()
                .flatten()
                .tolist()
            )

        return jsonify(embedding_list)

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Embedding from URL
# --------------------

@app.route("/embedding_url", methods=["POST"])
def get_embedding_url():

    load_model()

    data = request.get_json()

    if not data or "url" not in data:
        return jsonify({"error": "No URL provided"}), 400

    try:
        response = requests.get(data["url"], timeout=10)

        response.raise_for_status()

        img = Image.open(BytesIO(response.content)).convert("RGB")

        img_preprocessed = preprocess(img).unsqueeze(0).to(device)

        with torch.no_grad():

            image_features = model.encode_image(img_preprocessed)

            image_features /= image_features.norm(dim=-1, keepdim=True)

            embedding_list = (
                image_features.cpu()
                .numpy()
                .flatten()
                .tolist()
            )

        return jsonify(embedding_list)

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Gemini AI
# --------------------

@app.route("/gemini", methods=["POST"])
def call_gemini():
    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        prompt_text = data["prompt"]
        image_base64 = data.get("image_base64")
        mime_type = data.get("mime_type")
        expect_json = data.get("expect_json", True)

        model_name = data.get("model", "gemini-2.5-flash")
        model = genai.GenerativeModel(model_name)
        print(f"[Gemini] Using model: {model_name}")

        contents = [prompt_text]
        if image_base64 and mime_type:
            contents.append({
                "mime_type": mime_type,
                "data": image_base64
            })
            
        kwargs = {}
        if expect_json:
            kwargs["generation_config"] = genai.types.GenerationConfig(
                response_mime_type="application/json"
            )

        response = model.generate_content(
            contents,
            **kwargs
        )

        return jsonify({"text": response.text})

    except Exception as e:
        print("Gemini Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# OpenAI
# --------------------

@app.route("/openai", methods=["POST"])
def call_openai():
    if not openai_client:
        return jsonify({"error": "OpenAI not configured"}), 500

    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "No messages provided"}), 400

    try:
        messages = data["messages"]
        image_base64 = data.get("image_base64")
        mime_type = data.get("mime_type")
        expect_json = data.get("expect_json", True)

        # If there's an image, we can append it to the first user message if we want,
        # but the frontend might already pass the full messages structure including image_url!
        # If the frontend passes `messages` containing `image_url`, we don't need to do anything.
        # But let's check if they pass it explicitly as image_base64.
        
        # If the frontend passes `image_base64`, let's just make sure it's injected.
        # Actually, if frontend passes messages properly, we just pass it to API.
        
        model_name = data.get("model", "gpt-4o-mini")
        print(f"[OpenAI] Using model: {model_name}")

        kwargs = {}
        if expect_json:
            messages.insert(0, {
                "role": "system",
                "content": "You must return ONLY valid JSON."
            })
            # GPT-4o vision sometimes returns empty content when response_format is forced
            if "gpt-4o-mini" in model_name or "gpt-4o" not in model_name:
                kwargs["response_format"] = {"type": "json_object"}

        response = openai_client.chat.completions.create(
            model=model_name,
            messages=messages,
            **kwargs
        )
        content = response.choices[0].message.content
        if content is None:
            message_obj = response.choices[0].message
            print("[OpenAI] Error: Content is None. Message object:", message_obj)
            
            # Check for refusal
            refusal = getattr(message_obj, "refusal", None)
            if refusal:
                print("[OpenAI] Refusal:", refusal)
                return jsonify({"error": f"OpenAI refused: {refusal}"}), 500
                
            return jsonify({"error": "OpenAI returned empty content"}), 500
        
        # Clean up markdown JSON wrapper if it somehow appears
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()

        # If the caller expects JSON but got a plain-text refusal, return a 400
        if expect_json and not content.strip().startswith(("{", "[")):
            print(f"[OpenAI] Refusal/non-JSON response: {content[:200]}")
            return jsonify({"error": f"AI declined to analyze this image: {content[:200]}"}), 400

        return jsonify({"text": content})

    except Exception as e:
        print("OpenAI Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Railway entrypoint
# --------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))

    # Pre-load CLIP model BEFORE accepting requests
    # This prevents ERR_CONNECTION_RESET when multiple requests hit /embedding concurrently
    load_model()

    print(f"Starting server on port {port}")

    # threaded=True allows Flask to handle concurrent requests without blocking
    app.run(host="0.0.0.0", port=port, threaded=True)