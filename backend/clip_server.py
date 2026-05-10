import os
from io import BytesIO

from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
from PIL import Image
import open_clip
import requests

# --------------------
# Flask setup
# --------------------

app = Flask(__name__)
CORS(app)

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
# Railway entrypoint
# --------------------

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 8080))

    print(f"Starting server on port {port}")

    app.run(host="0.0.0.0", port=port)