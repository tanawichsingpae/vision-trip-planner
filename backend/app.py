from dotenv import load_dotenv
load_dotenv()
import os
import json
from io import BytesIO

# --------------------
# FastAPI Setup
# --------------------

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Any

import torch
from PIL import Image
import open_clip
import requests as http_requests

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
# FastAPI App + CORS
# --------------------

api = FastAPI()

api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vision-trip-planner.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------
# Device
# --------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

# --------------------
# Lazy-load CLIP Model (thread-safe)
# --------------------

import threading

_model_lock = threading.Lock()
_model = None
_preprocess = None


def load_model():
    """Load CLIP model if not already loaded (thread-safe)."""
    global _model, _preprocess

    if _model is not None:
        return

    with _model_lock:
        if _model is None:
            print("Loading CLIP model...")
            model_instance, _, preprocess_instance = open_clip.create_model_and_transforms(
                "ViT-B-32",
                pretrained="openai"
            )
            model_instance.to(device)
            model_instance.eval()
            _preprocess = preprocess_instance
            _model = model_instance
            print(f"CLIP model loaded successfully on {device}!")


# --------------------
# Health check
# --------------------

@api.get("/")
def home():
    return {"status": "running"}


@api.get("/health")
def health():
    return {"status": "ok"}


# --------------------
# Embedding from uploaded file
# --------------------

@api.post("/embedding")
async def get_embedding(image: UploadFile = File(...)):
    load_model()
    try:
        contents = await image.read()
        img = Image.open(BytesIO(contents)).convert("RGB")

        img_preprocessed = _preprocess(img).unsqueeze(0).to(device)

        with torch.no_grad():
            image_features = _model.encode_image(img_preprocessed)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            embedding_list = image_features.cpu().numpy().flatten().tolist()

        return JSONResponse(content=embedding_list)

    except Exception as e:
        print("Embedding Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# --------------------
# Embedding from URL
# --------------------

class EmbeddingUrlRequest(BaseModel):
    url: str


@api.post("/embedding_url")
async def get_embedding_url(body: EmbeddingUrlRequest):
    load_model()
    try:
        response = http_requests.get(body.url, timeout=10)
        response.raise_for_status()

        img = Image.open(BytesIO(response.content)).convert("RGB")
        img_preprocessed = _preprocess(img).unsqueeze(0).to(device)

        with torch.no_grad():
            image_features = _model.encode_image(img_preprocessed)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            embedding_list = image_features.cpu().numpy().flatten().tolist()

        return JSONResponse(content=embedding_list)

    except Exception as e:
        print("EmbeddingURL Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# --------------------
# Gemini AI
# --------------------

class GeminiRequest(BaseModel):
    prompt: str
    image_base64: Optional[str] = None
    mime_type: Optional[str] = None
    expect_json: Optional[bool] = True
    model: Optional[str] = "gemini-2.5-flash"


@api.post("/gemini")
async def call_gemini(body: GeminiRequest):
    try:
        model_name = body.model or "gemini-2.5-flash"
        gemini_model = genai.GenerativeModel(model_name)
        print(f"[Gemini] Using model: {model_name}")

        contents = [body.prompt]
        if body.image_base64 and body.mime_type:
            contents.append({
                "mime_type": body.mime_type,
                "data": body.image_base64
            })

        kwargs = {}
        if body.expect_json:
            kwargs["generation_config"] = genai.types.GenerationConfig(
                response_mime_type="application/json"
            )

        response = gemini_model.generate_content(contents, **kwargs)
        return {"text": response.text}

    except Exception as e:
        print("Gemini Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# --------------------
# OpenAI
# --------------------

class MessageItem(BaseModel):
    role: str
    content: Any


class OpenAIRequest(BaseModel):
    messages: List[MessageItem]
    image_base64: Optional[str] = None
    mime_type: Optional[str] = None
    expect_json: Optional[bool] = True
    model: Optional[str] = "gpt-4o-mini"


@api.post("/openai")
async def call_openai(body: OpenAIRequest):
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI not configured")

    try:
        model_name = body.model or "gpt-4o-mini"
        print(f"[OpenAI] Using model: {model_name}")

        messages = [m.model_dump() for m in body.messages]

        kwargs = {}
        if body.expect_json:
            messages.insert(0, {
                "role": "system",
                "content": "You must return ONLY valid JSON."
            })
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
            refusal = getattr(message_obj, "refusal", None)
            if refusal:
                raise HTTPException(status_code=500, detail=f"OpenAI refused: {refusal}")
            raise HTTPException(status_code=500, detail="OpenAI returned empty content")

        # Clean up markdown JSON wrapper
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()

        if body.expect_json and not content.strip().startswith(("{", "[")):
            print(f"[OpenAI] Non-JSON response: {content[:200]}")
            raise HTTPException(status_code=400, detail=f"AI declined to analyze this image: {content[:200]}")

        return {"text": content}

    except HTTPException:
        raise
    except Exception as e:
        print("OpenAI Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# --------------------
# Gradio wrapper (required for HF Spaces Gradio SDK)
# --------------------

import gradio as gr

# สร้าง Gradio app แบบเรียบง่าย (เพื่อให้ HF Spaces ยอมรับ)
with gr.Blocks() as demo:
    gr.Markdown("## Pixinerary Backend API\nThis Space hosts the backend API for Pixinerary.")

# Mount FastAPI ไว้ใต้ root "/" และ Gradio จะถูก mount ที่ "/gradio"
app = gr.mount_gradio_app(api, demo, path="/gradio")
