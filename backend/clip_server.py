import os
from io import BytesIO

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
CORS(app, origins=["https://vision-trip-planner.vercel.app","http://localhost:5173"])

# --------------------
# Device
# --------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

# --------------------
# Lazy-loaded model
# --------------------

model = None
preprocess = None


def load_model():
    global model, preprocess

    if model is None:
        print("Loading CLIP model...")

        model_instance, _, preprocess_instance = open_clip.create_model_and_transforms(
            "ViT-B-32",
            pretrained="openai"
        )

        model_instance.to(device)
        model_instance.eval()

        model = model_instance
        preprocess = preprocess_instance

        print(f"Model loaded on {device}")


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

        model = genai.GenerativeModel("gemini-2.5-flash")

        contents = [prompt_text]
        if image_base64 and mime_type:
            contents.append({
                "mime_type": mime_type,
                "data": image_base64
            })

        response = model.generate_content(
            contents,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
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

        # If there's an image, we can append it to the first user message if we want,
        # but the frontend might already pass the full messages structure including image_url!
        # If the frontend passes `messages` containing `image_url`, we don't need to do anything.
        # But let's check if they pass it explicitly as image_base64.
        
        # If the frontend passes `image_base64`, let's just make sure it's injected.
        # Actually, if frontend passes messages properly, we just pass it to API.
        
        # We will just pass the messages directly.
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"}
        )

        return jsonify({"text": response.choices[0].message.content})

    except Exception as e:
        print("OpenAI Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Railway entrypoint
# --------------------

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 8080))

    print(f"Starting server on port {port}")

    app.run(host="0.0.0.0", port=port)