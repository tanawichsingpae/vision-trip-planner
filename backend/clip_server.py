import os
from dotenv import load_dotenv
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
import json
import time
import datetime
from io import BytesIO
from pyexpat.errors import messages

from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
from PIL import Image
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass
import open_clip
import requests
import xml.etree.ElementTree as ET
import urllib.parse

import google.generativeai as genai
from openai import OpenAI

# --------------------
# AI Config
# --------------------

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AVIATIONSTACK_API_KEY = os.getenv("AVIATIONSTACK_API_KEY")
DUFFEL_API_KEY = os.getenv("DUFFEL_API_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "f5da5b71d4814a67b02fcef0b4525897")
MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")
FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")

# Primary AI Client: OpenRouter (OpenAI SDK compatible)
ai_api_key = OPENROUTER_API_KEY or OPENAI_API_KEY
if ai_api_key:
    openrouter_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=ai_api_key,
        default_headers={
            "HTTP-Referer": "https://vision-trip-planner.vercel.app",
            "X-Title": "Pixinerary",
        }
    )
else:
    openrouter_client = None

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)



# --------------------
# Flask setup
# --------------------

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = app.make_default_options_response()
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin"
        return res

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    return response

# --------------------
# Device
# --------------------

device = "cuda" if torch.cuda.is_available() else "cpu"
if device == "cpu":
    try:
        torch.set_num_threads(2)
    except Exception:
        pass

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

    data = request.get_json(silent=True)
    if not data or "url" not in data:
        return jsonify({"error": "No URL provided"}), 400

    raw_url = str(data["url"]).strip()
    if not raw_url:
        return jsonify({"error": "Empty URL provided"}), 400

    img = None
    try:
        # Case A: Base64 data URL
        if raw_url.startswith("data:image/"):
            import base64
            if "," in raw_url:
                _, b64_data = raw_url.split(",", 1)
            else:
                b64_data = raw_url
            img_bytes = base64.b64decode(b64_data)
            img = Image.open(BytesIO(img_bytes)).convert("RGB")

        # Case B: Local relative path or internal URL (e.g. /images/...)
        elif not raw_url.startswith("http://") and not raw_url.startswith("https://"):
            clean_path = raw_url.lstrip("/\\")
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            candidates = [
                os.path.join(base_dir, "frontend", "public", clean_path),
                os.path.join(base_dir, "frontend", "dist", clean_path),
                os.path.join(base_dir, "backend", clean_path),
                os.path.join(base_dir, clean_path),
            ]
            for c in candidates:
                if os.path.exists(c) and os.path.isfile(c):
                    try:
                        img = Image.open(c).convert("RGB")
                        break
                    except Exception:
                        pass

            if img is None:
                # Try fetching from local Vite dev server
                dev_url = f"http://127.0.0.1:5173/{clean_path}"
                try:
                    dev_res = requests.get(dev_url, timeout=3)
                    if dev_res.ok:
                        img = Image.open(BytesIO(dev_res.content)).convert("RGB")
                except Exception:
                    pass

            if img is None:
                print(f"[Warning /embedding_url] Local asset not found: '{raw_url}'")
                return jsonify({"error": f"Local image not found: {raw_url}"}), 404

        # Case C: Remote HTTP / HTTPS URL
        else:
            fetch_url = raw_url
            headers = {
                "User-Agent": "PixineraryBot/1.0 (https://vision-trip-planner.vercel.app; info@pixinerary.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "image/jpeg,image/png,image/webp,image/*,*/*;q=0.8",
                "Referer": "https://www.google.com/"
            }

            # Normalize Unsplash CDN image URLs
            if "images.unsplash.com" in fetch_url:
                if "auto=format" in fetch_url:
                    fetch_url = fetch_url.replace("auto=format", "fm=jpg")
                elif "fm=" not in fetch_url:
                    fetch_url += ("&" if "?" in fetch_url else "?") + "fm=jpg"

            try:
                response = requests.get(fetch_url, headers=headers, timeout=8)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content)).convert("RGB")
            except Exception as first_err:
                # Fallback 1: Wikimedia thumbnail error -> fetch original full image without /thumb/
                if "upload.wikimedia.org" in fetch_url and "/thumb/" in fetch_url:
                    try:
                        parts = fetch_url.split("/thumb/")
                        if len(parts) == 2:
                            orig_url = parts[0] + "/" + "/".join(parts[1].split("/")[:-1])
                            fb_res = requests.get(orig_url, headers=headers, timeout=8)
                            if fb_res.ok:
                                img = Image.open(BytesIO(fb_res.content)).convert("RGB")
                    except Exception:
                        pass

                # Fallback 2: Unsplash fallback URL
                if img is None and "images.unsplash.com" in raw_url:
                    try:
                        fallback_url = raw_url.split("?")[0] + "?w=800&q=80&fm=jpg"
                        fb_res = requests.get(fallback_url, headers=headers, timeout=8)
                        if fb_res.ok:
                            img = Image.open(BytesIO(fb_res.content)).convert("RGB")
                    except Exception:
                        pass

                if img is None:
                    print(f"[Warning /embedding_url] Could not download image from '{raw_url}': {first_err}")
                    return jsonify({"error": f"Failed to download image: {first_err}"}), 422

        if img is None:
            return jsonify({"error": "Unable to process image data"}), 422

        img_preprocessed = preprocess(img).unsqueeze(0).to(device)

        with torch.no_grad():
            image_features = model.encode_image(img_preprocessed)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            embedding_list = image_features.cpu().numpy().flatten().tolist()

        return jsonify(embedding_list)

    except Exception as e:
        print("[Error in /embedding_url]:", e)
        return jsonify({"error": str(e)}), 422


# --------------------
# Foursquare Places API Proxy (Bypasses Browser CORS)
# --------------------

@app.route("/foursquare/search", methods=["GET"])
def foursquare_search():
    query = request.args.get("query", "").strip()
    ll = request.args.get("ll", "").strip()
    radius = request.args.get("radius", "50000").strip()
    limit = request.args.get("limit", "1").strip()

    api_key = FOURSQUARE_API_KEY or os.getenv("FOURSQUARE_API_KEY", "")
    if not api_key or len(api_key) < 5:
        return jsonify({"results": []})

    auth_header = api_key if api_key.startswith("Bearer ") else f"Bearer {api_key.strip()}"
    headers = {
        "Authorization": auth_header,
        "X-Places-Api-Version": "2025-06-17",
        "Accept": "application/json"
    }
    params = {
        "query": query,
        "limit": limit
    }
    if ll:
        params["ll"] = ll
        params["radius"] = radius

    try:
        res = requests.get(
            "https://places-api.foursquare.com/places/search",
            headers=headers,
            params=params,
            timeout=10
        )
        if res.status_code in (429, 402):
            return jsonify({"results": [], "exhausted": True}), 200
        return jsonify(res.json()), res.status_code
    except Exception as e:
        print("Foursquare search error:", e)
        return jsonify({"error": str(e), "results": []}), 200


@app.route("/foursquare/photos/<place_id>", methods=["GET"])
def foursquare_photos(place_id):
    limit = request.args.get("limit", "10").strip()
    api_key = FOURSQUARE_API_KEY or os.getenv("FOURSQUARE_API_KEY", "")
    if not api_key or len(api_key) < 5:
        return jsonify([])

    auth_header = api_key if api_key.startswith("Bearer ") else f"Bearer {api_key.strip()}"
    headers = {
        "Authorization": auth_header,
        "X-Places-Api-Version": "2025-06-17",
        "Accept": "application/json"
    }
    params = {"limit": limit}
    try:
        res = requests.get(
            f"https://places-api.foursquare.com/places/{place_id}/photos",
            headers=headers,
            params=params,
            timeout=10
        )
        if res.status_code == 200:
            return jsonify(res.json()), 200
        else:
            return jsonify([]), 200
    except Exception as e:
        print("Foursquare photos error:", e)
        return jsonify([]), 200


import html

import re
import urllib.parse

def extract_clean_user_query(raw_text: str) -> str:
    """Extracts the actual user question if embedded in a larger system prompt."""
    if not raw_text:
        return ""
    text = raw_text.strip()
    if "User:" in text:
        text = text.split("User:")[-1].strip()
    elif "Human:" in text:
        text = text.split("Human:")[-1].strip()
    # Strip any trailing JSON or markdown blocks
    if "```" in text:
        text = text.split("```")[0].strip()
    return text[:200].strip()

def search_web_duckduckgo(query: str, max_results: int = 4):
    """
    Fetches real-time web search results from DuckDuckGo HTML Search, Instant API & Wikipedia.
    Zero extra dependencies required.
    """
    clean_q = extract_clean_user_query(query)
    if not clean_q or len(clean_q) < 2:
        return []

    results = []
    seen_urls = set()

    # 1. Query DuckDuckGo HTML Search for live organic web results
    try:
        ddg_html_url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        resp = requests.post(ddg_html_url, data={"q": clean_q}, headers=headers, timeout=5)
        if resp.status_code == 200 and resp.text:
            # Find result blocks
            raw_snippets = re.findall(r'<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)</a>', resp.text)
            raw_titles = re.findall(r'<a[^>]+class="result__url"[^>]*href="([^"]+)"[\s\S]*?<a[^>]+class="result__title"[^>]*>([\s\S]*?)</a>', resp.text)
            
            # Alternative title match
            alt_titles = re.findall(r'<a[^>]+class="result__snippet"[^>]*href="([^"]+)"', resp.text)

            for i, snip in enumerate(raw_snippets[:max_results]):
                clean_snip = html.unescape(re.sub(r'<[^>]+>', '', snip)).strip()
                title = clean_q
                url = "https://duckduckgo.com"

                if i < len(raw_titles):
                    url = raw_titles[i][0]
                    title = html.unescape(re.sub(r'<[^>]+>', '', raw_titles[i][1])).strip()
                elif i < len(alt_titles):
                    url = alt_titles[i]

                # Decode DDG redirect URL if needed (uddg=...)
                if "uddg=" in url:
                    try:
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
                        if "uddg" in parsed and parsed["uddg"]:
                            url = parsed["uddg"][0]
                    except Exception:
                        pass

                if clean_snip and url not in seen_urls:
                    seen_urls.add(url)
                    results.append({
                        "title": title or clean_q,
                        "snippet": clean_snip,
                        "url": url
                    })
    except Exception as e:
        print("[Search DDG HTML Error]", e)

    # 2. If results < max_results, Query DuckDuckGo Instant API
    if len(results) < max_results:
        try:
            ddg_url = "https://api.duckduckgo.com/"
            ddg_params = {"q": clean_q, "format": "json", "no_html": "1", "skip_disambig": "1"}
            resp = requests.get(ddg_url, params=ddg_params, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                abstract = data.get("Abstract")
                abstract_url = data.get("AbstractURL")
                if abstract and abstract_url not in seen_urls:
                    seen_urls.add(abstract_url)
                    results.append({
                        "title": data.get("Heading") or clean_q,
                        "snippet": abstract,
                        "url": abstract_url or "https://duckduckgo.com"
                    })
                for topic in data.get("RelatedTopics", [])[:3]:
                    if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                        t_url = topic.get("FirstURL", "")
                        if t_url not in seen_urls:
                            seen_urls.add(t_url)
                            results.append({
                                "title": topic.get("Text", "")[:50],
                                "snippet": topic.get("Text", ""),
                                "url": t_url
                            })
        except Exception as e:
            print("[Search DDG Instant Error]", e)

    # 3. Query Wikipedia API (Thai & English)
    if len(results) < max_results:
        try:
            for lang in ["th", "en"]:
                if len(results) >= max_results:
                    break
                wiki_url = f"https://{lang}.wikipedia.org/w/api.php"
                wiki_headers = {"User-Agent": "PixineraryBot/1.0 (https://pixinerary.com; dev@pixinerary.com)"}
                wiki_params = {"action": "query", "list": "search", "srsearch": clean_q, "format": "json", "utf8": "1"}
                wresp = requests.get(wiki_url, headers=wiki_headers, params=wiki_params, timeout=5)
                if wresp.status_code == 200:
                    wdata = wresp.json()
                    witems = wdata.get("query", {}).get("search", [])
                    for item in witems[:2]:
                        title = item.get("title", "")
                        snippet = html.unescape(re.sub(r'<[^>]+>', '', item.get("snippet", ""))).strip()
                        wiki_page_url = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title)}"
                        if title and snippet and wiki_page_url not in seen_urls:
                            seen_urls.add(wiki_page_url)
                            results.append({
                                "title": f"{title} ({lang.upper()})",
                                "snippet": snippet,
                                "url": wiki_page_url
                            })
        except Exception as e:
            print("[Search Wiki Error]", e)

    return results[:max_results]

LEGACY_MODEL_MAP = {
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-3.8-flash": "google/gemini-2.5-flash",
    "gemini-1.5-pro": "google/gemini-2.5-flash",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4o": "openai/gpt-4o",
    "claude-sonnet": "anthropic/claude-sonnet-5",
    "qwen-vl": "qwen/qwen3.8-flash",
    "qwen-vl-32b": "qwen/qwen3.8-flash",
    "qwen-38-flash": "qwen/qwen3.8-flash",
    "llama4": "meta-llama/llama-3.3-70b-instruct",
}

def clean_conversational_text(text: str, user_text: str = "") -> str:
    """
    Cleans chatbot output according to Pix style rules:
    - No link citations like [Pantip](https://...) unless user explicitly asks for links/sources
    - No markdown asterisks (**bold** or *item*)
    - Uses emojis for a clean, user-friendly reading experience
    """
    if not text:
        return ""

    import re
    cleaned = text

    # Check if user asked for links
    user_asked_for_links = bool(
        re.search(r"(ขอ|ดู|มี)?(ลิงก์|ลิ้งค์|ลิ้ง|link|url|source|ที่มา|แหล่งที่มา|แหล่งข่าว|เว็บ)", user_text, re.IGNORECASE)
    )

    if not user_asked_for_links:
        # Remove markdown link citations like [Pantip](https://...)
        cleaned = re.sub(r'\[([^\]]+)\]\((https?://[^\)]+)\)', '', cleaned)
        # Remove standalone URLs
        cleaned = re.sub(r'https?://\S+', '', cleaned)

    # Remove markdown bold/italic asterisks: **text** -> text, *text* -> text
    cleaned = re.sub(r'\*\*([^*]+)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*([^*]+)\*', r'\1', cleaned)
    cleaned = cleaned.replace("**", "").replace("*", "")

    # Clean double spaces caused by link removal
    cleaned = re.sub(r' +', ' ', cleaned)
    # Clean empty lines if more than 2 consecutive
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)

    return cleaned.strip()

@app.route("/ai", methods=["POST"])
@app.route("/openai", methods=["POST"])
@app.route("/gemini", methods=["POST"])
def call_ai():
    if not openrouter_client:
        return jsonify({"error": "AI client / OpenRouter key not configured"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    try:
        raw_model = data.get("model", "google/gemini-2.5-flash")
        # Resolve legacy model names if passed
        model_name = LEGACY_MODEL_MAP.get(raw_model, raw_model)
        expect_json = data.get("expect_json", True)
        allow_fallback = data.get("allow_fallback", True)
        temperature = data.get("temperature", None)
        top_p = data.get("top_p", None)

        messages = data.get("messages")
        if not messages:
            # Build messages from legacy Gemini format (prompt + optional image_base64)
            prompt_text = data.get("prompt", "")
            image_base64 = data.get("image_base64")
            mime_type = data.get("mime_type", "image/jpeg")

            if image_base64:
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ]
            else:
                messages = [{"role": "user", "content": prompt_text}]

        formatted_messages = list(messages)

        # ── Conversational ChatBot Handling with 4-Tier Real-Time Search (expect_json=False) ──
        if not expect_json:
            last_msg = formatted_messages[-1] if formatted_messages else {}
            user_text = ""
            if isinstance(last_msg.get("content"), list):
                for item in last_msg["content"]:
                    if item.get("type") == "text":
                        user_text += item.get("text", "")
            else:
                user_text = str(last_msg.get("content", ""))

            import re
            user_asked_for_links = bool(
                re.search(r"(ขอ|ดู|มี)?(ลิงก์|ลิ้งค์|ลิ้ง|link|url|source|ที่มา|แหล่งที่มา|แหล่งข่าว|เว็บ)", user_text, re.IGNORECASE)
            )
            link_rule = (
                "- ผู้ใช้ขอลิงก์: สามารถแนบลิงก์ URL อ้างอิงที่เกี่ยวข้องได้"
                if user_asked_for_links else
                "- 🚫 ห้ามใส่หรือแนบลิงก์ URL อ้างอิง เช่น [ชื่อเว็บ](url) หรือ https://... ในข้อความตอบรับเด็ดขาด!"
            )

            today_str = datetime.date.today().isoformat()
            date_anchor = (
                f"\n[กฎเหล็กและข้อบังคับสูงสุดในการตอบสำหรับ ChatBot พิกโซ่]:\n"
                f"- วันที่ปัจจุบันคือ {today_str} ให้ใช้ข้อมูลข่าวสารสดและเหตุการณ์ล่าสุดบนอินเทอร์เน็ตในการตอบ\n"
                f"{link_rule}\n"
                f"- 🚫 ห้ามใช้เครื่องหมายดอกจัน '**' หรือ '*' ในข้อความตอบรับเด็ดขาด (ห้ามทำตัวหนาด้วย ** หรือทำ bullet ด้วย *)!\n"
                f"- ✨ ให้ปรับไปใช้อีโมจิที่เข้ากับเนื้อหา (เช่น 📍, 🚗, 🚆, 🚌, ⏱️, 💰, 💡, 🏛️, 🏮, ✨) เป็นสัญลักษณ์นำหน้าหัวข้อและหัวข้อย่อย เพื่อความ User-Friendly สบายตา น่าอ่าน และอบอุ่น"
            )

            has_system = False
            for msg in formatted_messages:
                if msg.get("role") == "system":
                    msg["content"] = str(msg.get("content", "")) + date_anchor
                    has_system = True
                    break
            if not has_system:
                formatted_messages.insert(0, {"role": "system", "content": date_anchor})

            # 4-Tier Online Strategy:
            # 1. google/gemini-2.5-flash:online (Primary)
            # 2. google/gemini-2.0-flash-001:online (Secondary)
            # 3. openai/gpt-4o-mini:online (Tertiary)
            # 4. search_web_duckduckgo + base model (Fallback 4)
            online_models_to_try = [
                "google/gemini-2.5-flash:online",
                "google/gemini-2.0-flash-001:online",
                "openai/gpt-4o-mini:online",
            ]

            cleaned_content = None
            last_error = None

            for current_model in online_models_to_try:
                try:
                    print(f"[ChatBot Online AI] Requesting model: {current_model}")
                    response = openrouter_client.chat.completions.create(
                        model=current_model,
                        messages=formatted_messages,
                        max_tokens=4096,
                    )
                    if response and getattr(response, "choices", None):
                        choice = response.choices[0]
                        msg = getattr(choice, "message", None)
                        content = getattr(msg, "content", None) if msg else None
                        if content is None and msg and hasattr(msg, "reasoning_content"):
                            content = getattr(msg, "reasoning_content", None)
                        if content is not None and str(content).strip():
                            cleaned_content = str(content).strip()
                            print(f"[ChatBot Online AI] Successfully generated reply using model: {current_model}")
                            break
                except Exception as online_err:
                    print(f"[ChatBot Online AI Error on {current_model}]:", online_err)
                    last_error = str(online_err)

            # 4. Fallback if all 3 OpenRouter :online models fail
            if not cleaned_content:
                print("[ChatBot Online AI] All online models failed. Falling back to DuckDuckGo Search RAG.")
                if user_text and len(user_text.strip()) > 3:
                    search_results = search_web_duckduckgo(user_text, max_results=4)
                    if search_results:
                        context_blocks = []
                        for idx, res in enumerate(search_results):
                            context_blocks.append(f"[{idx+1}] Source: {res['url']}\nTitle: {res['title']}\nSnippet: {res['snippet']}")

                        search_context = (
                            "=== Real-Time Web Search Context (DuckDuckGo Fallback) ===\n"
                            "Use the up-to-date web search results below to inform your response if relevant. "
                            "Cite or refer to current details when answering questions about live events, weather, news, or places.\n"
                            "IMPORTANT PERSONA & FORMATTING RULES:\n"
                            "- You are 'พิกโซ่ (Pixo) - Your AI Travel Companion' — a polite, warm, smart, friendly travel buddy scout.\n"
                            "- Always speak with polite Thai ending particles (ครับ), refer to yourself as 'ผม' or 'พิกโซ่', and STRICTLY address the user ONLY as 'คุณ' (NEVER use 'คุณลูกค้า', 'ท่าน', 'เธอ', 'นาย', 'พี่', 'น้อง', 'เพื่อน', 'ยู' or any other pronoun; ALWAYS address the user ONLY as 'คุณ').\n"
                            "- Explain reasons clearly and concisely. Do NOT dump huge unrequested lists.\n"
                            "- 🚫 NEVER use markdown asterisks '*' or '**' for bold or bullet points in your response. Write clean, natural prose using line breaks and tasteful emojis instead.\n"
                            "- 🚫 DO NOT attach markdown link citations like [Site](url) unless explicitly requested.\n\n"
                            + "\n\n".join(context_blocks) + "\n"
                            "======================================================="
                        )
                        formatted_messages.insert(len(formatted_messages) - 1, {
                            "role": "system",
                            "content": search_context
                        })

                base_fallbacks = [
                    model_name,
                    "google/gemini-2.5-flash",
                    "openai/gpt-4o-mini",
                    "meta-llama/llama-3.3-70b-instruct"
                ]
                for fb_model in base_fallbacks:
                    try:
                        print(f"[ChatBot Fallback AI] Requesting model: {fb_model}")
                        response = openrouter_client.chat.completions.create(
                            model=fb_model,
                            messages=formatted_messages,
                            max_tokens=4096,
                        )
                        if response and getattr(response, "choices", None):
                            choice = response.choices[0]
                            msg = getattr(choice, "message", None)
                            content = getattr(msg, "content", None) if msg else None
                            if content is None and msg and hasattr(msg, "reasoning_content"):
                                content = getattr(msg, "reasoning_content", None)
                            if content is not None and str(content).strip():
                                cleaned_content = str(content).strip()
                                print(f"[ChatBot Fallback AI] Successfully generated reply using model: {fb_model}")
                                break
                    except Exception as fb_err:
                        print(f"[ChatBot Fallback AI Error on {fb_model}]:", fb_err)
                        last_error = str(fb_err)

            if cleaned_content:
                cleaned_content = clean_conversational_text(cleaned_content, user_text)
                return jsonify({"text": cleaned_content})

            return jsonify({"error": last_error or "AI model returned empty content"}), 500

        # ── Structured JSON Generation (expect_json=True) ──
        formatted_messages.insert(0, {
            "role": "system",
            "content": "You are a helpful AI assistant. You must respond ONLY with valid JSON matching the requested schema. Do not output any markdown headers, conversational text, or formatting outside of JSON."
        })

        candidate_models = [model_name]
        if allow_fallback:
            fallbacks = [
                "google/gemini-2.5-flash",
                "openai/gpt-4o-mini",
                "openai/gpt-4o",
                "meta-llama/llama-3.3-70b-instruct"
            ]
            for fb in fallbacks:
                if fb not in candidate_models:
                    candidate_models.append(fb)

        cleaned_content = None
        last_error = None
        call_metrics = None

        for current_model in candidate_models:
            try:
                print(f"[AI] Requesting model: {current_model} (expect_json={expect_json}, allow_fallback={allow_fallback}, temp={temperature})")
                create_kwargs = {
                    "model": current_model,
                    "messages": formatted_messages,
                    "max_tokens": 8192,
                }
                if temperature is not None:
                    try:
                        create_kwargs["temperature"] = float(temperature)
                    except (ValueError, TypeError):
                        pass
                if top_p is not None:
                    try:
                        create_kwargs["top_p"] = float(top_p)
                    except (ValueError, TypeError):
                        pass

                start_call_time = time.perf_counter()
                response = openrouter_client.chat.completions.create(**create_kwargs)
                latency_sec = time.perf_counter() - start_call_time

                if not response or not getattr(response, "choices", None):
                    print(f"[AI] Model {current_model} returned no choices object")
                    last_error = f"AI model {current_model} returned no choices"
                    continue

                choice = response.choices[0]
                msg = getattr(choice, "message", None)
                content = getattr(msg, "content", None) if msg else None

                if content is None and msg and hasattr(msg, "reasoning_content"):
                    content = getattr(msg, "reasoning_content", None)

                if content is not None and str(content).strip():
                    cleaned = str(content).strip()
                    if cleaned.startswith("```"):
                        lines = cleaned.splitlines()
                        if lines and lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        cleaned = "\n".join(lines).strip()

                    if expect_json and not cleaned.startswith(("{", "[")):
                        print(f"[AI] Model {current_model} non-JSON response: {cleaned[:150]}")
                        last_error = f"AI model {current_model} declined to output valid JSON"
                        continue

                    # Extract usage and cost metrics
                    prompt_tokens = 0
                    completion_tokens = 0
                    total_tokens = 0
                    cost_usd = 0.0

                    usage_obj = getattr(response, "usage", None)
                    if usage_obj:
                        if hasattr(usage_obj, "model_dump"):
                            u_dict = usage_obj.model_dump()
                        elif isinstance(usage_obj, dict):
                            u_dict = usage_obj
                        else:
                            u_dict = {}

                        prompt_tokens = getattr(usage_obj, "prompt_tokens", None) or u_dict.get("prompt_tokens", 0) or 0
                        completion_tokens = getattr(usage_obj, "completion_tokens", None) or u_dict.get("completion_tokens", 0) or 0
                        total_tokens = getattr(usage_obj, "total_tokens", None) or u_dict.get("total_tokens", 0) or (prompt_tokens + completion_tokens)
                        cost_usd = getattr(usage_obj, "cost", None) or u_dict.get("cost", 0.0) or 0.0

                    if not cost_usd and hasattr(response, "model_dump"):
                        try:
                            r_dump = response.model_dump()
                            cost_usd = r_dump.get("usage", {}).get("cost", 0.0) or 0.0
                        except Exception:
                            pass

                    tokens_per_sec = round(completion_tokens / latency_sec, 2) if latency_sec > 0 else 0.0
                    gen_id = getattr(response, "id", None) or ""

                    call_metrics = {
                        "prompt_tokens": int(prompt_tokens),
                        "completion_tokens": int(completion_tokens),
                        "total_tokens": int(total_tokens),
                        "latency_ms": round(latency_sec * 1000, 2),
                        "latency_sec": round(latency_sec, 3),
                        "cost_usd": float(cost_usd),
                        "tokens_per_sec": tokens_per_sec,
                        "model_used": current_model,
                        "openrouter_id": str(gen_id),
                        "temperature": float(temperature) if temperature is not None else None,
                        "allow_fallback": bool(allow_fallback)
                    }

                    cleaned_content = cleaned
                    print(f"[AI] Successfully generated content using model: {current_model} (tokens: in={prompt_tokens}, out={completion_tokens}, cost=${cost_usd:.6f}, time={latency_sec:.2f}s, temp={temperature})")
                    break
                else:
                    refusal = getattr(msg, "refusal", None) if msg else None
                    finish_reason = getattr(choice, "finish_reason", None)
                    print(f"[AI] Model {current_model} returned empty content (finish_reason={finish_reason}, refusal={refusal})")
                    last_error = f"AI model {current_model} returned empty content"
            except Exception as model_err:
                print(f"[AI] Exception calling model {current_model}: {model_err}")
                last_error = str(model_err)

        if cleaned_content:
            return jsonify({
                "text": cleaned_content,
                "metrics": call_metrics or {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "latency_ms": 0,
                    "latency_sec": 0,
                    "cost_usd": 0.0,
                    "tokens_per_sec": 0,
                    "model_used": model_name,
                    "openrouter_id": "",
                    "temperature": float(temperature) if temperature is not None else None,
                    "allow_fallback": bool(allow_fallback)
                }
            })

        return jsonify({
            "error": last_error or f"AI model {model_name} returned empty content or failed",
            "model_requested": model_name
        }), 500

    except Exception as e:
        print("AI Error:", e)
        return jsonify({"error": str(e)}), 500


# In-memory cache for live transit check (5-minute TTL per query)
_live_check_cache = {}

def get_cached_live_check(cache_key: str):
    now = time.time()
    if cache_key in _live_check_cache:
        entry, expiry = _live_check_cache[cache_key]
        if now < expiry:
            return entry
    return None

def set_cached_live_check(cache_key: str, data: dict, ttl_seconds: int = 300):
    _live_check_cache[cache_key] = (data, time.time() + ttl_seconds)


# In-memory cache for targeted disaster & incident news (10-minute TTL per city)
_disaster_news_cache = {}

def resolve_destination_context(city: str, places: list = None) -> dict:
    """
    Resolves the destination country, primary language, Google News RSS localization codes,
    and transit ecosystem mapping for any province in Thailand or any country worldwide.
    """
    combined_text = f"{city or ''} {' '.join(places or [])}".lower().strip()

    # 1. Japan
    if any(k in combined_text for k in [
        "tokyo", "โตเกียว", "kyoto", "เกียวโต", "osaka", "โอซาก้า", "sapporo", "ซัปโปโร",
        "fukuoka", "ฟุกุโอกะ", "nagoya", "นาโกย่า", "nara", "นารา", "okinawa", "โอกินาว่า",
        "japan", "ญี่ปุ่น", "shibuya", "shinjuku", "ginza", "akihabara", "asakusa"
    ]):
        return {
            "country": "JP",
            "country_name": "ญี่ปุ่น (Japan)",
            "lang": "ja",
            "gl": "JP",
            "hl": "ja",
            "ceid": "JP:ja",
            "is_thailand": False,
            "transit_apps": "GO App, Uber Taxi, JR Train, Tokyo Metro, Suica/Pasmo",
            "query_keywords": "(地震 OR 台風 OR 大雨 OR 洪水 OR 運休 OR 警報 OR 避難 OR 停電)"
        }

    # 2. South Korea
    if any(k in combined_text for k in [
        "seoul", "โซล", "busan", "ปูซาน", "incheon", "อินชอน", "jeju", "เชจู",
        "korea", "เกาหลี", "hongdae", "myeongdong", "gangnam"
    ]):
        return {
            "country": "KR",
            "country_name": "เกาหลีใต้ (South Korea)",
            "lang": "ko",
            "gl": "KR",
            "hl": "ko",
            "ceid": "KR:ko",
            "is_thailand": False,
            "transit_apps": "Kakao T, T-money, Seoul Metro",
            "query_keywords": "(홍수 OR 태풍 OR 지진 OR 지하철 지연 OR 폭우 OR 경보)"
        }

    # 3. France
    if any(k in combined_text for k in [
        "paris", "ปารีส", "nice", "นีซ", "lyon", "ลียง", "marseille", "มาร์แซย์",
        "france", "ฝรั่งเศส", "louvre", "eiffel"
    ]):
        return {
            "country": "FR",
            "country_name": "ฝรั่งเศส (France)",
            "lang": "fr",
            "gl": "FR",
            "hl": "fr",
            "ceid": "FR:fr",
            "is_thailand": False,
            "transit_apps": "RATP Metro, Citymapper, Uber, FreeNow, G7 Taxi",
            "query_keywords": "(inondation OR grève OR alerte météo OR perturbation OR tempête OR manifestation)"
        }

    # 4. United Kingdom
    if any(k in combined_text for k in [
        "london", "ลอนดอน", "manchester", "แมนเชสเตอร์", "edinburgh", "เอดินบะระ",
        "uk", "united kingdom", "อังกฤษ", "heathrow"
    ]):
        return {
            "country": "GB",
            "country_name": "สหราชอาณาจักร (UK)",
            "lang": "en",
            "gl": "GB",
            "hl": "en-GB",
            "ceid": "GB:en",
            "is_thailand": False,
            "transit_apps": "TfL Tube, Uber, Citymapper, Black Cab",
            "query_keywords": "(flood OR rail strike OR tube delay OR storm warning OR road closure)"
        }

    # 5. United States
    if any(k in combined_text for k in [
        "new york", "นิวยอร์ก", "los angeles", "ลอสแอนเจลิส", "san francisco", "ซานฟรานซิสโก",
        "las vegas", "ลาสเวกัส", "hawaii", "ฮาวาย", "chicago", "ชิคาโก", "usa", "america", "อเมริกา"
    ]):
        return {
            "country": "US",
            "country_name": "สหรัฐอเมริกา (USA)",
            "lang": "en",
            "gl": "US",
            "hl": "en-US",
            "ceid": "US:en",
            "is_thailand": False,
            "transit_apps": "Uber, Lyft, MTA Subway, Citymapper",
            "query_keywords": "(flood warning OR flash flood OR storm alert OR subway delay OR road closure OR wildfire)"
        }

    # 6. Singapore
    if any(k in combined_text for k in [
        "singapore", "สิงคโปร์", "marinabay", "changi", "orchard", "sentosa"
    ]):
        return {
            "country": "SG",
            "country_name": "สิงคโปร์ (Singapore)",
            "lang": "en",
            "gl": "SG",
            "hl": "en-SG",
            "ceid": "SG:en",
            "is_thailand": False,
            "transit_apps": "Grab, Gojek, ComfortDelGro, MRT",
            "query_keywords": "(flash flood OR heavy rain OR MRT breakdown OR haze OR air quality alert)"
        }

    # 7. China / Hong Kong / Taiwan
    if any(k in combined_text for k in [
        "hong kong", "ฮ่องกง", "taipei", "ไทเป", "taiwan", "ไต้หวัน",
        "beijing", "ปักกิ่ง", "shanghai", "เซี่ยงไฮ้", "guangzhou", "กวางโจว", "china", "จีน"
    ]):
        is_hk = "hong kong" in combined_text or "ฮ่องกง" in combined_text
        is_tw = "taiwan" in combined_text or "ไต้หวัน" in combined_text or "taipei" in combined_text or "ไทเป" in combined_text
        return {
            "country": "HK" if is_hk else ("TW" if is_tw else "CN"),
            "country_name": "จีน / ฮ่องกง / ไต้หวัน",
            "lang": "zh",
            "gl": "HK" if is_hk else ("TW" if is_tw else "CN"),
            "hl": "zh-TW" if (is_tw or is_hk) else "zh-CN",
            "ceid": "HK:zh-Hant" if is_hk else ("TW:zh-Hant" if is_tw else "CN:zh-Hans"),
            "is_thailand": False,
            "transit_apps": "Didi, MTR, MRT, WeChat Pay / Alipay",
            "query_keywords": "(暴雨 OR 洪水 OR 颱風 OR 地震 OR 停運 OR 警報)"
        }

    # 8. Vietnam
    if any(k in combined_text for k in [
        "vietnam", "เวียดนาม", "hanoi", "ฮานอย", "ho chi minh", "โฮจิมินห์", "da nang", "ดานัง"
    ]):
        return {
            "country": "VN",
            "country_name": "เวียดนาม (Vietnam)",
            "lang": "vi",
            "gl": "VN",
            "hl": "vi",
            "ceid": "VN:vi",
            "is_thailand": False,
            "transit_apps": "Grab, Be, Gojek, Mai Linh Taxi",
            "query_keywords": "(ngập lụt OR bão OR sạt lở OR kẹt xe OR cảnh báo mưa lớn)"
        }

    # 9. Thailand (Default for Thai provinces / script or empty city)
    is_thai_script = bool(re.search(r'[\u0e00-\u0e7f]', combined_text))
    thai_province_match = any(p in combined_text for p in [
        "bangkok", "กรุงเทพ", "chiang mai", "เชียงใหม่", "phuket", "ภูเก็ต", "krabi", "กระบี่",
        "pattaya", "พัทยา", "chonburi", "ชลบุรี", "samui", "สมุย", "surat thani", "สุราษฎร์",
        "hua hin", "หัวหิน", "ayutthaya", "อยุธยา", "chiang rai", "เชียงราย", "nan", "น่าน",
        "kanchanaburi", "กาญจนบุรี", "khon kaen", "ขอนแก่น", "udon", "อุดร", "hat yai", "หาดใหญ่",
        "songkhla", "สงขลา", "korat", "โคราช", "nakhon", "นคร", "ubon", "อุบล", "rayong", "ระยอง"
    ])

    if is_thai_script or thai_province_match or not city:
        return {
            "country": "TH",
            "country_name": "ไทย (Thailand)",
            "lang": "th",
            "gl": "TH",
            "hl": "th",
            "ceid": "TH:th",
            "is_thailand": True,
            "transit_apps": "BTS, MRT, SRT, ARL, เรือโดยสาร, Grab, Bolt, LINE MAN",
            "query_keywords": "(น้ำท่วม OR น้ำรอระบาย OR น้ำท่วมขัง OR ดินสไลด์ OR ดินถล่ม OR ปิดถนน OR รถไฟฟ้าขัดข้อง OR พายุ OR แผ่นดินไหว OR เตือนภัย)"
        }

    # 10. Global Default
    return {
        "country": "GLOBAL",
        "country_name": city or "Global Destination",
        "lang": "en",
        "gl": "US",
        "hl": "en-US",
        "ceid": "US:en",
        "is_thailand": False,
        "transit_apps": "Local Transit, Uber, Ride-hailing Apps",
        "query_keywords": "(flood OR flash flood OR storm warning OR earthquake OR transit strike OR road closure OR wildfire OR emergency)"
    }


def fetch_targeted_disaster_news(target_city: str, country_context: dict, is_today: bool, target_date: datetime.date) -> list:
    """
    Deterministic Multi-Source Real-Time News & Disaster Ingestion.
    Queries Google News RSS in the country's local language for breaking natural disasters,
    floods, storms, transit strikes, and emergency warnings in under 500ms.
    Caches results per city for 10 minutes (600s TTL).
    """
    clean_city = target_city.strip() if target_city else "กรุงเทพมหานคร"
    cache_key = f"{clean_city}_{country_context.get('country', 'TH')}".lower()
    now = time.time()

    if cache_key in _disaster_news_cache:
        entry, expiry = _disaster_news_cache[cache_key]
        if now < expiry:
            return entry

    news_items = []

    # 1. Google News RSS Retrieval
    try:
        keywords = country_context.get("query_keywords", "(flood OR storm OR emergency)")
        gl = country_context.get("gl", "TH")
        hl = country_context.get("hl", "th")
        ceid = country_context.get("ceid", "TH:th")

        search_query = f"{clean_city} {keywords} when:2d"
        encoded_q = urllib.parse.quote(search_query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_q}&hl={hl}&gl={gl}&ceid={ceid}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
        }

        resp = requests.get(rss_url, headers=headers, timeout=3.5)
        if resp.status_code == 200 and resp.content:
            root = ET.fromstring(resp.content)
            items = root.findall('./channel/item')
            for item in items[:6]:
                title_elem = item.find('title')
                source_elem = item.find('source')
                pubdate_elem = item.find('pubDate')

                raw_title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
                source_name = source_elem.text.strip() if source_elem is not None and source_elem.text else ""

                if raw_title:
                    clean_title = raw_title
                    if " - " in clean_title:
                        clean_title = clean_title.rsplit(" - ", 1)[0].strip()

                    source_label = f"[{source_name}] " if source_name else ""
                    news_items.append(f"{source_label}{clean_title}")
    except Exception as rss_err:
        print(f"[News RSS Ingestion Warning for {clean_city}]:", rss_err)

    # 2. Fallback to DuckDuckGo search if RSS returned empty
    if len(news_items) < 2:
        try:
            ddg_query = f"{clean_city} น้ำท่วม รถติด ข่าวด่วน" if country_context.get("is_thailand") else f"{clean_city} flood storm weather warning news"
            ddg_res = search_web_duckduckgo(ddg_query, max_results=3)
            for r in ddg_res:
                snip = r.get("snippet", "").strip()
                t = r.get("title", "").strip()
                if snip or t:
                    news_items.append(f"[{t}]: {snip[:160]}" if snip else t)
        except Exception as ddg_err:
            print(f"[News DDG Fallback Warning for {clean_city}]:", ddg_err)

    # Cache for 10 minutes (600s)
    _disaster_news_cache[cache_key] = (news_items, now + 600)
    return news_items


UNIVERSAL_SEASONAL_RULES = [
    {
        "name": "ตรุษจีน (Chinese New Year)",
        "keywords": ["ตรุษจีน", "chinese new year", "spring festival", "วันตรุษจีน"],
        "valid_months": [1, 2],
        "substitutes": [
            ("ช่วงเทศกาลตรุษจีน", "ช่วงเวลาปกติ"),
            ("ช่วงตรุษจีน", "ช่วงเย็น"),
            ("เทศกาลตรุษจีน", "ย่านการค้าและวัฒนธรรม"),
            ("บรรยากาศตรุษจีน", "บรรยากาศสตรีทฟู้ด"),
            ("งานตรุษจีน", "แหล่งรวมสตรีทฟู้ด"),
            ("ตรุษจีน", "เยาวราช"),
            ("Chinese New Year", "Chinatown"),
        ]
    },
    {
        "name": "สงกรานต์ (Songkran)",
        "keywords": ["สงกรานต์", "songkran", "สาดน้ำ", "ปีใหม่ไทย"],
        "valid_months": [4],
        "substitutes": [
            ("ช่วงเทศกาลสงกรานต์", "ช่วงเวลาปกติ"),
            ("เทศกาลสงกรานต์", "แหล่งท่องเที่ยวยอดนิยม"),
            ("เล่นน้ำสงกรานต์", "ท่องเที่ยวทั่วไป"),
            ("สงกรานต์", "เมืองเก่า"),
            ("Songkran", "Old Town"),
        ]
    },
    {
        "name": "เทศกาลกินเจ (Vegetarian Festival)",
        "keywords": ["กินเจ", "เทศกาลกินเจ", "vegetarian festival", "ถือศีลกินผัก"],
        "valid_months": [9, 10],
        "substitutes": [
            ("เทศกาลกินเจ", "แหล่งอาหารสตรีทฟู้ด"),
            ("กินเจ", "อาหารทั่วไป"),
        ]
    },
    {
        "name": "ลอยกระทง (Loy Krathong)",
        "keywords": ["ลอยกระทง", "loy krathong", "วันลอยกระทง", "ยี่เป็ง", "yi peng"],
        "valid_months": [11],
        "substitutes": [
            ("เทศกาลลอยกระทง", "จุดชมวิวริมแม่น้ำ"),
            ("ลอยกระทง", "ริมแม่น้ำ"),
            ("Loy Krathong", "Riverside"),
        ]
    },
    {
        "name": "ฤดูหนาว & ดอกไม้เมืองหนาว",
        "keywords": ["นางพญาเสือโคร่ง", "ซากุระเมืองไทย", "ดอกบัวตอง", "ทะเลหมอกหนาวจัด"],
        "valid_months": [11, 12, 1],
        "substitutes": [
            ("ดอกนางพญาเสือโคร่งบาน", "ธรรมชาติขุนเขา"),
            ("อากาศหนาวจัด", "สภาพอากาศบนดอย"),
        ]
    },
    {
        "name": "มรสุมปิดเกาะอุทยานแห่งชาติทางทะเล (Andaman Sea Closures)",
        "keywords": ["ปิดเกาะสิมิลัน", "ปิดเกาะสุรินทร์", "มรสุมอันดามัน"],
        "valid_months": [5, 6, 7, 8, 9, 10],
        "substitutes": []
    }
]


def build_buddy_search_query(target_term: str, places: list, target_date: datetime.date, is_today: bool) -> str:
    thai_months = [
        "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ]
    month_name = thai_months[target_date.month] if 1 <= target_date.month <= 12 else ""
    year_be = target_date.year + 543
    places_subset = " ".join([p.strip() for p in places[:3] if p.strip()]) if places else target_term

    if is_today:
        return f"{target_term} {places_subset} สภาพการจราจร รถไฟฟ้า รถติด น้ำท่วม ข่าวด่วนวันนี้ {target_date.day} {month_name} {year_be}"
    else:
        return f"{target_term} {places_subset} ประกาศปิดปรับปรุง ซ่อมแซม ตารางเวลา {month_name} {year_be}"


def strip_raw_markdown_noise(text: str) -> str:
    if not isinstance(text, str):
        return text
    # 1. Convert markdown link [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\((?:https?://[^\)]+|[^\)]+)\)', r'\1', text)
    # 2. Strip bracketed domain citations or lists like [lemon8-app.com], [a.com, b.com], [th.trip.com]
    text = re.sub(r'\[[^\]]*\.[a-zA-Z]{2,}[^\]]*\]', '', text)
    # 3. Strip raw URLs (http://... or https://...)
    text = re.sub(r'https?://[^\s\)\]]+', '', text)
    # 4. Clean empty parentheses or brackets left behind like () or []
    text = re.sub(r'\(\s*\)', '', text)
    text = re.sub(r'\[\s*\]', '', text)
    # 5. Clean excessive spaces
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def sanitize_buddy_live_data(live_data: dict, target_date: datetime.date, is_today: bool, target_term: str) -> dict:
    """
    Universal Deterministic Post-Processing Guardrail:
    1. Enforces Universal Seasonal Matrix across all nationwide festivals.
    2. Disaster Alert preservation, severity scoring, and markdown stripping.
    3. Implements Event vs Advance Notice Scoping:
       - Transient breaking incidents (e.g. today short circuits, today sudden storms) are purged for future dates.
       - Legitimate scheduled maintenance or ongoing multi-day disasters (floods) spanning target date are preserved.
    4. Enriches advice with multi-modal rapid transit and ride-hailing options.
    5. Strips raw markdown link noise and domain citations from text fields for clean, glanceable display.
    """
    month_num = target_date.month

    # 0. Disaster & Hazard Alert Preservation & Guardrail
    disaster_alert = live_data.get("disaster_alert")
    if isinstance(disaster_alert, dict) and disaster_alert.get("has_disaster"):
        sev = disaster_alert.get("severity", "warning")
        if sev in ["critical", "warning"]:
            live_data["has_disruption"] = True
            live_data["notice_type"] = "disaster_alert"
            if sev == "critical":
                live_data["transit_status"] = "critical"
            elif live_data.get("transit_status") == "normal":
                live_data["transit_status"] = "warning"
        if disaster_alert.get("headline"):
            disaster_alert["headline"] = strip_raw_markdown_noise(disaster_alert["headline"])
        if disaster_alert.get("action_advice"):
            disaster_alert["action_advice"] = strip_raw_markdown_noise(disaster_alert["action_advice"])

    # 1. Universal Seasonal Matrix Enforcement
    for rule in UNIVERSAL_SEASONAL_RULES:
        if month_num not in rule["valid_months"]:
            filtered_events = []
            for evt in live_data.get("special_events", []):
                if isinstance(evt, dict):
                    name = (evt.get("event_name") or "").lower()
                    hl = (evt.get("highlight") or "").lower()
                    loc = (evt.get("location") or "").lower()
                    if any(kw in name or kw in hl or kw in loc for kw in rule["keywords"]):
                        continue
                filtered_events.append(evt)
            live_data["special_events"] = filtered_events

            for old_s, new_s in rule["substitutes"]:
                for key in ["title", "summary", "weather_traffic_alert", "advice_for_travelers", "local_tips_and_rules"]:
                    val = live_data.get(key)
                    if isinstance(val, str) and old_s in val:
                        live_data[key] = val.replace(old_s, new_s)

    # 2. Advance Scoping & Event Classification Guard:
    if not is_today:
        transient_keywords = [
            "ไฟฟ้าลัดวงจร", "ขัดข้องเมื่อ", "หยุดให้บริการชั่วคราว", "หยุดให้บริการบางส่วน",
            "เมื่อวานนี้", "วันนี้", "เช้านี้", "บ่ายนี้", "สักครู่", "กะทันหัน", "สดวันนี้"
        ]
        disruptions = live_data.get("disruptions", [])
        has_real_scheduled_disruption = False
        for d in disruptions:
            if isinstance(d, dict):
                detail = d.get("detail", "")
                if any(kw in detail for kw in transient_keywords):
                    d["status"] = "normal"
                    d["detail"] = "ให้บริการตามปกติ (ตรวจสอบตารางเดินรถตามช่วงเวลา)"
                if d.get("status") in ["disrupted", "delayed"]:
                    has_real_scheduled_disruption = True

        attractions = live_data.get("attraction_alerts", [])
        has_real_scheduled_attraction_closure = False
        for a in attractions:
            if isinstance(a, dict):
                note = a.get("note", "")
                status = a.get("status", "normal")
                if any(kw in note for kw in ["วันนี้", "บ่ายนี้", "เช้านี้", "ชั่วคราว 1 ชั่วโมง"]):
                    if not any(lt in note for lt in ["ถึงวันที่", "ระหว่างวันที่", "บูรณะ", "ซ่อมแซมใหญ่", "ปิดปรับปรุง"]):
                        a["status"] = "normal"
                        a["note"] = "เปิดทำการตามปกติ"
                if a.get("status") in ["closed", "restricted"]:
                    has_real_scheduled_attraction_closure = True

        # Check if there is an active ongoing multi-day disaster
        has_active_disaster = bool(disaster_alert and isinstance(disaster_alert, dict) and disaster_alert.get("has_disaster") and disaster_alert.get("severity") in ["critical", "warning"])

        if not has_real_scheduled_disruption and not has_real_scheduled_attraction_closure and not has_active_disaster:
            live_data["has_disruption"] = False
            live_data["transit_status"] = "normal"
            live_data["notice_type"] = "regular_advisory"
            title = live_data.get("title", "")
            if any(w in title for w in ["หยุดให้บริการ", "ขัดข้อง", "ไฟฟ้าลัดวงจร", "เตือนด่วน", "สดวันนี้"]):
                live_data["title"] = f"แนะนำการเดินทางและระบบขนส่ง {target_term}"
        elif has_active_disaster:
            live_data["has_disruption"] = True
            live_data["notice_type"] = "disaster_alert"
        else:
            live_data["has_disruption"] = True
            live_data["notice_type"] = "scheduled_maintenance"
    else:
        # Today
        if live_data.get("has_disruption"):
            if disaster_alert and isinstance(disaster_alert, dict) and disaster_alert.get("has_disaster"):
                live_data["notice_type"] = "disaster_alert"
            else:
                live_data["notice_type"] = "live_incident"
        else:
            live_data["notice_type"] = "regular_advisory"

    # 3. Ride-hailing suggestion enrichment
    adv = live_data.get("advice_for_travelers", "")
    if adv and not any(rh in adv.lower() for rh in ["grab", "bolt", "line man", "uber", "go app", "เรียกรถ", "แอป"]):
        live_data["advice_for_travelers"] = adv.rstrip(" .") + " | หากการจราจรติดขัดหรือไม่มีรถไฟฟ้าผ่านโดยตรง แนะนำเรียกแอปเรียกรถเพื่อความสะดวกรวดเร็วครับ"

    # 4. Clean raw markdown noise, URLs, and citations from text fields
    for field in ["title", "summary", "weather_traffic_alert", "advice_for_travelers", "local_tips_and_rules"]:
        val = live_data.get(field)
        if isinstance(val, str):
            live_data[field] = strip_raw_markdown_noise(val)

    for d in live_data.get("disruptions", []):
        if isinstance(d, dict):
            if "detail" in d:
                d["detail"] = strip_raw_markdown_noise(d["detail"])
            if "line" in d:
                d["line"] = strip_raw_markdown_noise(d["line"])

    for a in live_data.get("attraction_alerts", []):
        if isinstance(a, dict):
            if "note" in a:
                a["note"] = strip_raw_markdown_noise(a["note"])
            if "place_name" in a:
                a["place_name"] = strip_raw_markdown_noise(a["place_name"])

    for e in live_data.get("special_events", []):
        if isinstance(e, dict):
            for k in ["eventName", "event_name", "highlight", "location"]:
                if k in e and isinstance(e[k], str):
                    e[k] = strip_raw_markdown_noise(e[k])

    return live_data


@app.route("/ai/buddy-live-check", methods=["POST"])
def buddy_live_check():
    """
    Universal Hybrid Disaster & News Intelligence for Pixo Travel Buddy.
    Combines Deterministic Multi-Source News Ingestion (Google News RSS / GDACS / DDG)
    with Context-Enriched LLM Disaster Synthesis via OpenRouter Cascade (Gemini 2.5 Flash -> Gemini 2.0 Flash -> GPT-4o Mini).
    Supports all situations (Floods, Storms, Earthquakes, Strikes, PM2.5, Protests),
    77 provinces of Thailand, and worldwide destinations.
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            try:
                raw_body = request.get_data(as_text=True)
                data = json.loads(raw_body) if raw_body else {}
            except Exception:
                data = {}

        city = (data.get("city") or "").strip()
        places = data.get("places") or []
        date_str = data.get("date") or datetime.date.today().isoformat()

        today_date = datetime.date.today()
        target_date = today_date
        try:
            if date_str:
                clean_date_str = str(date_str).split("T")[0]
                target_date = datetime.date.fromisoformat(clean_date_str)
        except Exception:
            target_date = today_date

        is_today = (target_date == today_date)
        is_future = (target_date > today_date)

        target_term = city or (places[0] if places else "กรุงเทพมหานคร")
        places_slug = "_".join(sorted([p.strip().lower() for p in places[:5]])) if places else "general"
        cache_key = f"{target_term}_{target_date.isoformat()}_{places_slug}".lower()
        cached = get_cached_live_check(cache_key)
        if cached:
            return jsonify(cached)

        if not city and not places:
            return jsonify({
                "status": "empty",
                "has_disruption": False,
                "transit_status": "normal",
                "notice_type": "regular_advisory",
                "title": "ไม่มีข้อมูลสถานที่",
                "summary": "ไม่พบข้อมูลเมืองหรือสถานที่สำหรับตรวจสอบเหตุการณ์สด",
                "disruptions": [],
                "attraction_alerts": [],
                "special_events": [],
                "weather_traffic_alert": "",
                "advice_for_travelers": "",
                "local_tips_and_rules": "",
                "disaster_alert": {"has_disaster": False, "disaster_type": "none", "severity": "none", "headline": "", "affected_areas": [], "action_advice": ""},
                "tips": [],
                "live_updates": [],
                "sources": [],
                "sources_count": 0
            })

        # 1. Geo & Country Context Resolution
        country_ctx = resolve_destination_context(target_term, places)
        is_thailand = country_ctx.get("is_thailand", True)

        # 2. Ingest Verified Real-Time Disaster & Emergency News (< 400ms)
        disaster_news_items = fetch_targeted_disaster_news(target_term, country_ctx, is_today, target_date)
        if disaster_news_items:
            news_context_block = (
                "\n=== รายงานข่าวสด & เหตุฉุกเฉิน/ภัยพิบัติล่าสุดจากสื่อท้องถิ่น (Real-Time Verified Local Feeds) ===\n"
                + "\n".join([f"- {item}" for item in disaster_news_items[:6]])
                + "\n========================================================================\n"
            )
        else:
            news_context_block = "\n(ไม่พบรายงานข่าวด่วนหรือภัยพิบัติรุนแรงจากสื่อท้องถิ่นในขณะนี้)\n"

        thai_months = [
            "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
        ]
        thai_days = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"]
        day_of_week_str = thai_days[target_date.weekday()]
        thai_month_str = thai_months[target_date.month] if 1 <= target_date.month <= 12 else ""
        thai_year_be = target_date.year + 543
        month_num = target_date.month

        date_description = (
            f"{target_date.isoformat()} ({day_of_week_str} ที่ {target_date.day} {thai_month_str} พ.ศ. {thai_year_be})"
            if is_thailand else
            f"{target_date.isoformat()} ({target_date.strftime('%A, %B %d, %Y')} - {country_ctx['country_name']})"
        )
        day_mode = "วันนี้ (เหตุการณ์สดจริงหน้างาน Real-time Live)" if is_today else f"วันข้างหน้าในแผนเดินทาง ({date_description} - เน้นคำแนะนำการวางแผนล่วงหน้า)"
        places_text = ', '.join(places[:6]) if places else target_term

        # 3. Primary: OpenRouter with live web search & disaster synthesis
        if openrouter_client:
            prompt = f"""คุณคือระบบตรวจสอบข้อมูลสด ภัยพิบัติ และการเดินทางอัจฉริยะ (Pixo Universal Live Disaster & Transit Companion) ประจำเมือง {target_term} ({country_ctx['country_name']})
วันที่ของทริปนี้: {date_description}
ประเภทวัน: {day_mode}
สถานที่ในทริปของวันดังกล่าว: {places_text}
ระบบขนส่งและแอปแนะนำในพื้นที่นี้: {country_ctx['transit_apps']}

{news_context_block}

กรุณาวิเคราะห์ข้อมูลจากข่าวสดด้านบนร่วมกับการตรวจสอบแบบ Fact-Checked เพื่อความปลอดภัยสูงสุดของผู้เดินทาง:

1. [ตรวจสอบภัยพิบัติและเหตุฉุกเฉิน (DISASTER & SAFETY EVALUATION) - สำคัญสูงสุด]:
   - ตรวจสอบว่าในเมือง {target_term} หรือสถานที่ {places_text} กำลังเผชิญเหตุการณ์เหล่านี้หรือไม่:
     * น้ำท่วม, น้ำรอระบาย, น้ำท่วมขังบนถนน (Floods / Urban Waterlogging / Flash Floods)
     * พายุ, ไต้ฝุ่น, ฝนตกหนักถึงหนักมาก (Severe Storm / Typhoon / Torrential Rain)
     * แผ่นดินไหว, สึนามิ, ดินโคลนถล่ม (Earthquake / Tsunami / Landslide)
     * รถไฟฟ้า/รถไฟใต้ดินหยุดวิ่ง, ขนส่งหยุดให้บริการ, การนัดหยุดงานประท้วง (Train Suspension / Strike)
     * ค่าฝุ่น PM2.5 วิกฤต, คลื่นความร้อนจัด (Hazardous PM2.5 / Extreme Heatwave)
     * การชุมนุมประท้วงปิดถนน, ประกาศเคอร์ฟิว (Civil Protests / Road Closures)
   - หากมีภัยพิบัติ/เหตุฉุกเฉินจริง:
     * ตั้ง "has_disruption": true
     * ตั้ง "notice_type": "disaster_alert"
     * ตั้ง "transit_status": "critical" (หากรุนแรง/น้ำท่วมสูง/ปิดเส้นทาง) หรือ "warning" (หากระดับปานกลาง/รอระบาย)
     * ใส่ข้อมูลใน "disaster_alert" ให้ครบถ้วน: has_disaster: true, disaster_type, severity, headline (สั้นกระชับไม่เกิน 10 คำ), affected_areas (ระบุถนนหรือย่านที่ได้รับผลกระทบ), action_advice (คำแนะนำสั้นๆ เช่น ให้เลี่ยงถนน ใช้รถไฟฟ้า หรือสลับแผน)
   - หากไม่มีภัยพิบัติ:
     * ตั้ง "disaster_alert": {{"has_disaster": false, "disaster_type": "none", "severity": "none", "headline": "", "affected_areas": [], "action_advice": ""}}

2. [การจำแนกประเภทเหตุการณ์และความเกี่ยวข้องกับวัน (Temporal Scoping)]:
   - {"[สำหรับวันปัจจุบัน]: รายงานเหตุฉุกเฉิน/ขัดข้องสดจริงในวันนี้เท่านั้น" if is_today else f"""[สำหรับวันข้างหน้า ({date_description})]:
     * ห้ามนำเหตุด่วนฉุกเฉินชั่วคราวสั้นๆ ของวันนี้ (เช่น รถไฟฟ้าขัดข้อง 1 ชม. วันนี้ หรืออุบัติเหตุรถชนวันนี้) ไปแจ้งเตือนวันข้างหน้า
     * ยกเว้นกรณีภัยพิบัติรุนแรงต่อเนื่องหลายวัน (เช่น น้ำท่วมขังเรื้อรัง, มรสุมปิดเกาะ) หรือการปิดซ่อมบำรุงระยะยาว ให้คงการแจ้งเตือนไว้และตั้ง notice_type: "scheduled_maintenance" หรือ "disaster_alert" """}

3. [การปรับให้เข้ากับประเทศและวัฒนธรรม (Localization & Transit)]:
   - {"กฎเทศกาลไทย: ตรุษจีนเฉพาะเดือน 1-2, สงกรานต์เฉพาะเดือน 4, กินเจปลายเดือน 9-10, ลอยกระทงเดือน 11 หากวันที่ระบุไม่มีเทศกาลใหญ่ให้ special_events เป็น []" if is_thailand else f"สำหรับ {country_ctx['country_name']}: ไม่ต้องใช้กฎเทศกาลไทย ให้ยึดตามเทศกาลหรือวันหยุดสากลที่ตรงกับวันดังกล่าวจริง"}
   - แนะนำระบบคมนาคมและแอปเรียกรถที่ใช้งานได้จริงในพื้นที่นี้ ({country_ctx['transit_apps']})

4. [สถานะสถานที่ท่องเที่ยวในทริป]:
   - ตรวจสอบว่าสถานที่ {places_text} มีจุดใดปิดปรับปรุง ปิดซ่อมแซม หรือได้รับผลกระทบจากภัยพิบัติหรือไม่

ตอบกลับเป็น JSON เท่านั้น (Strict JSON) สรุปฉับไวกระชับ **ห้ามใส่ URL หรือลิงก์ในเนื้อหาข้อความเด็ดขาด** (ให้ใส่ URL เฉพาะในฟิลด์ sources เท่านั้น):
{{
  "has_disruption": true หรือ false,
  "notice_type": "disaster_alert" | "live_incident" | "scheduled_maintenance" | "regular_advisory",
  "transit_status": "normal" | "warning" | "critical",
  "disaster_alert": {{
    "has_disaster": true หรือ false,
    "disaster_type": "flood" | "storm" | "earthquake" | "transit_strike" | "air_quality" | "protest" | "general_disaster" | "none",
    "severity": "critical" | "warning" | "info" | "none",
    "headline": "หัวข้อเตือนภัยสั้นๆ เช่น เตือนภัยน้ำท่วมขังรอการระบายหลายพื้นที่ หรือ ปล่อยว่างถ้าไม่มี",
    "affected_areas": ["ชื่อย่านหรือถนนที่ได้รับผลกระทบ"],
    "action_advice": "คำแนะนำสั้นๆ 1 ประโยค เช่น เลี่ยงการใช้ถนน ใช้ BTS/MRT แทน"
  }},
  "title": "หัวข้อสรุปฉับไวสั้นๆ ไม่เกิน 8-10 คำ",
  "summary": "สรุปภาพรวมแบบฉับไว 1 ประโยคสั้นๆ ตรงประเด็น (ห้ามมี URL)",
  "disruptions": [
    {{
      "line": "ชื่อสายรถไฟฟ้าหรือเส้นทาง",
      "status": "normal" | "delayed" | "disrupted",
      "detail": "รายละเอียดสั้นกระชับ 1 บรรทัด"
    }}
  ],
  "attraction_alerts": [
    {{
      "place_name": "ชื่อสถานที่",
      "status": "closed" | "restricted" | "crowded" | "normal",
      "note": "รายละเอียดสั้นๆ"
    }}
  ],
  "special_events": [
    {{
      "event_name": "ชื่องานเทศกาลที่ตรงกับเดือนดังกล่าวจริง (ถ้าไม่มีให้ปล่อยว่าง)",
      "location": "สถานที่จัดงาน",
      "highlight": "จุดเด่นสั้นๆ 1 บรรทัด"
    }}
  ],
  "weather_traffic_alert": "สภาพอากาศหรือการจราจรฉับไว 1 ประโยค",
  "advice_for_travelers": "คำแนะนำการเดินทางสั้นๆ 1-2 ประโยค (ระบุแอปหรือวิธีเดินทางที่เหมาะสม)",
  "local_tips_and_rules": "ข้อควรระวังหรือคำแนะนำสำคัญสั้นๆ 1-2 ข้อ (ห้ามใส่ URL)",
  "sources": ["ชื่อแหล่งข่าวหรือสำนักข่าว"]
}}
"""
            models_to_try = [
                "google/gemini-2.5-flash:online",
                "google/gemini-2.0-flash-001:online",
                "openai/gpt-4o-mini:online",
            ]
            live_data = None
            used_model = None

            for current_model in models_to_try:
                try:
                    resp = openrouter_client.chat.completions.create(
                        model=current_model,
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=2048,
                    )
                    content = (resp.choices[0].message.content or "").strip()
                    if content.startswith("```"):
                        lines = content.splitlines()
                        if lines and lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        content = "\n".join(lines).strip()

                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "has_disruption" in parsed:
                        live_data = parsed
                        used_model = current_model
                        break
                except Exception as model_err:
                    print(f"[OpenRouter Live Check Error on {current_model}]:", model_err)

            if live_data:
                live_data = sanitize_buddy_live_data(live_data, target_date, is_today, target_term)

                live_updates = []
                tips = []
                if live_data.get("summary"):
                    live_updates.append(live_data["summary"])
                    tips.append(live_data["summary"])
                if live_data.get("advice_for_travelers"):
                    tips.append(live_data["advice_for_travelers"])
                if live_data.get("local_tips_and_rules"):
                    tips.append(live_data["local_tips_and_rules"])
                if live_data.get("weather_traffic_alert"):
                    live_updates.append(live_data["weather_traffic_alert"])

                disaster_alert = live_data.get("disaster_alert") or {
                    "has_disaster": False, "disaster_type": "none", "severity": "none",
                    "headline": "", "affected_areas": [], "action_advice": ""
                }

                attraction_alerts = live_data.get("attraction_alerts", [])
                has_attraction_issue = any(
                    a.get("status") in ["closed", "restricted"] for a in attraction_alerts if isinstance(a, dict)
                )
                has_disaster_issue = bool(disaster_alert.get("has_disaster")) and disaster_alert.get("severity") in ["critical", "warning"]
                has_disruption = bool(live_data.get("has_disruption", False)) or has_attraction_issue or has_disaster_issue

                result = {
                    "status": "success",
                    "city": city or target_term,
                    "target_date": target_date.isoformat(),
                    "is_today": is_today,
                    "has_disruption": has_disruption,
                    "notice_type": live_data.get("notice_type", "disaster_alert" if has_disaster_issue else ("live_incident" if (is_today and has_disruption) else ("scheduled_maintenance" if (not is_today and has_disruption) else "regular_advisory"))),
                    "transit_status": live_data.get("transit_status", "normal"),
                    "disaster_alert": disaster_alert,
                    "title": live_data.get("title", f"ข้อมูลการเดินทาง {target_term}"),
                    "summary": live_data.get("summary", ""),
                    "disruptions": live_data.get("disruptions", []),
                    "attraction_alerts": attraction_alerts,
                    "special_events": live_data.get("special_events", []),
                    "weather_traffic_alert": live_data.get("weather_traffic_alert", ""),
                    "advice_for_travelers": live_data.get("advice_for_travelers", ""),
                    "local_tips_and_rules": live_data.get("local_tips_and_rules", ""),
                    "sources": live_data.get("sources", []),
                    "tips": tips,
                    "live_updates": live_updates,
                    "sources_count": len(live_data.get("sources", [])),
                    "model": used_model
                }
                set_cached_live_check(cache_key, result, ttl_seconds=300)
                return jsonify(result)

        # 4. Fallback if OpenRouter unavailable
        fallback_live_updates = [item[:180] for item in disaster_news_items] if disaster_news_items else []
        has_fallback_disaster = any(
            any(w in item for w in ["น้ำท่วม", "flood", "storm", "พายุ", "แผ่นดินไหว", "earthquake", "ปิดถนน", "closure", "strike", "grève"])
            for item in fallback_live_updates
        )

        fallback_res = {
            "status": "fallback",
            "city": city or target_term,
            "target_date": target_date.isoformat(),
            "is_today": is_today,
            "has_disruption": has_fallback_disaster,
            "notice_type": "disaster_alert" if has_fallback_disaster else "regular_advisory",
            "transit_status": "warning" if has_fallback_disaster else "normal",
            "disaster_alert": {
                "has_disaster": has_fallback_disaster,
                "disaster_type": "flood" if any("น้ำท่วม" in item or "flood" in item.lower() for item in fallback_live_updates) else ("general_disaster" if has_fallback_disaster else "none"),
                "severity": "warning" if has_fallback_disaster else "none",
                "headline": fallback_live_updates[0] if fallback_live_updates and has_fallback_disaster else "",
                "affected_areas": [target_term] if has_fallback_disaster else [],
                "action_advice": f"โปรดตรวจสอบเส้นทางก่อนออกเดินทาง หรือใช้ {country_ctx['transit_apps']}"
            },
            "title": f"ข้อมูลการเดินทาง {target_term}",
            "summary": fallback_live_updates[0] if fallback_live_updates else f"ข้อมูลการเดินทางใน {target_term}",
            "disruptions": [],
            "attraction_alerts": [],
            "special_events": [],
            "weather_traffic_alert": fallback_live_updates[0] if fallback_live_updates else "",
            "advice_for_travelers": f"ตรวจสอบเส้นทางและสภาพการจราจรก่อนออกเดินทาง แนะนำใช้งาน {country_ctx['transit_apps']}",
            "local_tips_and_rules": "",
            "sources": [item.split("]")[0].strip("[") for item in fallback_live_updates if "]" in item],
            "tips": [f"ข้อมูลสำหรับการเดินทาง {target_term}: วางแผนการเดินทางล่วงหน้า"] + fallback_live_updates[:2],
            "live_updates": fallback_live_updates,
            "sources_count": len(fallback_live_updates)
        }
        fallback_res = sanitize_buddy_live_data(fallback_res, target_date, is_today, target_term)
        return jsonify(fallback_res)

    except Exception as e:
        print("[Error in /ai/buddy-live-check]:", e)
        return jsonify({
            "tips": [],
            "live_updates": [],
            "sources": [],
            "sources_count": 0,
            "has_disruption": False,
            "transit_status": "normal",
            "notice_type": "regular_advisory",
            "disaster_alert": {"has_disaster": False, "disaster_type": "none", "severity": "none", "headline": "", "affected_areas": [], "action_advice": ""},
            "attraction_alerts": [],
            "special_events": [],
            "local_tips_and_rules": "",
            "error": str(e)
        }), 200


# --------------------
# Geoapify & Routing Proxy
# --------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

@app.route("/routing", methods=["GET"])
def proxy_routing():
    """
    Proxies routing requests to Geoapify. If Geoapify returns 400 (e.g. waypoint is off-road,
    in water, or on an unroutable peak like Mount Batur) or any network error,
    it automatically falls back to Haversine driving estimates, returning HTTP 200 JSON
    without polluting the browser console with red HTTP 400 errors.
    """
    try:
        waypoints = request.args.get("waypoints")  # format: "lat1,lon1|lat2,lon2"
        mode = request.args.get("mode", "drive")

        if not waypoints or "|" not in waypoints:
            return jsonify({"error": "Invalid waypoints format, expected lat1,lon1|lat2,lon2"}), 400

        parts = waypoints.split("|")
        origin_lat, origin_lon = map(float, parts[0].split(","))
        dest_lat, dest_lon = map(float, parts[1].split(","))

        # Check for same point
        if abs(origin_lat - dest_lat) < 0.0001 and abs(origin_lon - dest_lon) < 0.0001:
            return jsonify({
                "status": "ok",
                "distance": 0,
                "time": 60,
                "distanceText": "0 m",
                "durationText": "1 min",
                "source": "exact"
            })

        # Strategy 1: Mapbox Directions API v5 (Fast, accurate driving distance & duration)
        mapbox_token = os.getenv("MAPBOX_ACCESS_TOKEN", MAPBOX_ACCESS_TOKEN)
        if mapbox_token:
            mapbox_url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}?access_token={mapbox_token}&geometries=geojson"
            try:
                m_resp = requests.get(mapbox_url, timeout=5)
                if m_resp.ok:
                    m_data = m_resp.json()
                    routes = m_data.get("routes", [])
                    if routes:
                        r0 = routes[0]
                        distance_m = r0.get("distance", 0)
                        time_sec = r0.get("duration", 0)
                        dist_km = distance_m / 1000.0
                        mins = int(round(time_sec / 60))
                        dur_text = f"{mins} min" if time_sec < 3600 else f"{int(time_sec // 3600)}h {int(round((time_sec % 3600) / 60))}min"
                        dist_text = f"{dist_km:.1f} km" if distance_m >= 1000 else f"{int(distance_m)} m"
                        return jsonify({
                            "status": "ok",
                            "distance": distance_m,
                            "time": time_sec,
                            "distanceText": dist_text,
                            "durationText": dur_text,
                            "source": "mapbox"
                        })
                else:
                    print(f"[Routing Proxy] Mapbox returned {m_resp.status_code}: {m_resp.text[:100]}")
            except Exception as m_err:
                print(f"[Routing Proxy] Mapbox request error: {m_err}")

        # Strategy 2: Geoapify Routing API (Fallback)
        api_key = os.getenv("GEOAPIFY_API_KEY", GEOAPIFY_API_KEY)
        if api_key:
            url = f"https://api.geoapify.com/v1/routing?waypoints={waypoints}&mode={mode}&apiKey={api_key}"
            try:
                resp = requests.get(url, timeout=6)
                if resp.ok:
                    data = resp.json()
                    features = data.get("features", [])
                    if features and "properties" in features[0]:
                        props = features[0]["properties"]
                        distance_m = props.get("distance", 0)
                        time_sec = props.get("time", 0)
                        dist_km = distance_m / 1000.0
                        mins = int(round(time_sec / 60))
                        dur_text = f"{mins} min" if time_sec < 3600 else f"{int(time_sec // 3600)}h {int(round((time_sec % 3600) / 60))}min"
                        dist_text = f"{dist_km:.1f} km" if distance_m >= 1000 else f"{int(distance_m)} m"
                        return jsonify({
                            "status": "ok",
                            "distance": distance_m,
                            "time": time_sec,
                            "distanceText": dist_text,
                            "durationText": dur_text,
                            "source": "geoapify"
                        })
                else:
                    print(f"[Routing Proxy] Geoapify returned {resp.status_code} for {waypoints}: {resp.text[:100]}")
            except Exception as req_err:
                print(f"[Routing Proxy] Geoapify request error: {req_err}")

        # Haversine fallback (35 km/h avg speed + 3 min buffer)
        dist_km = _haversine_km(origin_lat, origin_lon, dest_lat, dest_lon)
        est_sec = int(round((dist_km / 35.0) * 3600)) + 180
        dist_m = int(round(dist_km * 1000))
        mins = int(round(est_sec / 60))
        dur_text = f"{mins} min" if mins < 60 else f"{mins // 60}h {mins % 60}min"
        dist_text = f"{dist_km:.1f} km" if dist_km >= 1.0 else f"{dist_m} m"

        return jsonify({
            "status": "ok",
            "distance": dist_m,
            "time": est_sec,
            "distanceText": dist_text,
            "durationText": dur_text,
            "source": "haversine_fallback"
        })
    except Exception as e:
        print(f"[Routing Proxy] General error: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500




# --------------------
# Flight: Status (AviationStack)
# --------------------

@app.route("/flight/status", methods=["POST"])
def flight_status():
    """
    Proxy to AviationStack – returns real-time status for a given flight.
    Body: { "flight_iata": "TG682" }
    """
    if not AVIATIONSTACK_API_KEY:
        return jsonify({"error": "AviationStack API key not configured"}), 500

    data = request.get_json()
    if not data or "flight_iata" not in data:
        return jsonify({"error": "flight_iata is required"}), 400

    flight_iata = data["flight_iata"].strip().upper()

    try:
        resp = requests.get(
            "http://api.aviationstack.com/v1/flights",
            params={
                "access_key": AVIATIONSTACK_API_KEY,
                "flight_iata": flight_iata,
                "limit": 1,
            },
            timeout=10,
        )
        resp.raise_for_status()
        raw = resp.json()

        flights = raw.get("data", [])
        if not flights:
            return jsonify({"error": f"No flight found for {flight_iata}"}), 404

        f = flights[0]

        # Normalize into a clean response
        result = {
            "flight_iata": f.get("flight", {}).get("iata", flight_iata),
            "airline": f.get("airline", {}).get("name", ""),
            "status": f.get("flight_status", "unknown"),
            "departure": {
                "airport": f.get("departure", {}).get("airport", ""),
                "iata": f.get("departure", {}).get("iata", ""),
                "scheduled": f.get("departure", {}).get("scheduled"),
                "actual": f.get("departure", {}).get("actual"),
                "estimated": f.get("departure", {}).get("estimated"),
                "terminal": f.get("departure", {}).get("terminal"),
                "gate": f.get("departure", {}).get("gate"),
                "delay": f.get("departure", {}).get("delay"),
            },
            "arrival": {
                "airport": f.get("arrival", {}).get("airport", ""),
                "iata": f.get("arrival", {}).get("iata", ""),
                "scheduled": f.get("arrival", {}).get("scheduled"),
                "actual": f.get("arrival", {}).get("actual"),
                "estimated": f.get("arrival", {}).get("estimated"),
                "terminal": f.get("arrival", {}).get("terminal"),
                "gate": f.get("arrival", {}).get("gate"),
                "baggage": f.get("arrival", {}).get("baggage"),
                "delay": f.get("arrival", {}).get("delay"),
            },
        }
        return jsonify(result)

    except requests.exceptions.RequestException as e:
        print("AviationStack Error:", e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print("flight_status Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Flight: Offers (Google Flights via RapidAPI)
# --------------------

import time as _time

_flight_offers_cache = {}  # key -> (timestamp, data)
_flight_trends_cache = {}  # key -> (timestamp, data)
_CACHE_TTL_SECONDS = 3600  # 1 hour cache to conserve RapidAPI quota

@app.route("/flight/offers", methods=["POST"])
def flight_offers():
    """
    Proxy to Google Flights (RapidAPI) – returns up to 5 cheapest one-way flight offers.
    Body: { "origin": "BKK", "destination": "NRT", "date": "2026-09-01", "passengers": 1, "currency": "THB" }
    """
    if not RAPIDAPI_KEY:
        return jsonify({"error": "RapidAPI key not configured"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    origin = data.get("origin", "").strip().upper()
    destination = data.get("destination", "").strip().upper()
    departure_date = data.get("date", "")
    passengers = int(data.get("passengers", 1))
    currency = data.get("currency", "THB")

    if not origin or not destination or not departure_date:
        return jsonify({"error": "origin, destination, and date are required"}), 400

    cache_key = f"{origin}_{destination}_{departure_date}_{passengers}_{currency}"
    cached = _flight_offers_cache.get(cache_key)
    if cached and (_time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        print(f"[Offers] Returning cached offers for {cache_key}")
        return jsonify(cached[1])

    try:
        rapidapi_headers = {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": "google-flights2.p.rapidapi.com",
        }

        params = {
            "departure_id": origin,
            "arrival_id": destination,
            "outbound_date": departure_date,
            "travel_class": "ECONOMY",
            "adults": str(passengers),
            "show_hidden": "1",
            "currency": currency,
            "language_code": "en-US",
            "country_code": "TH",
            "search_type": "best",
        }

        resp = requests.get(
            "https://google-flights2.p.rapidapi.com/api/v1/searchFlights",
            headers=rapidapi_headers,
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()

        if not raw.get("status"):
            return jsonify({"error": raw.get("message", "Google Flights returned no results")}), 502

        # Collect top flights + other flights, limited to 5
        itineraries = raw.get("data", {}).get("itineraries", {})
        all_flights = (
            itineraries.get("topFlights", []) +
            itineraries.get("otherFlights", [])
        )[:5]

        results = []
        for idx, flight in enumerate(all_flights):
            flights_list = flight.get("flights", [])
            first_flight = flights_list[0] if flights_list else {}
            last_flight = flights_list[-1] if flights_list else {}

            dep_airport = first_flight.get("departure_airport", {})
            arr_airport = last_flight.get("arrival_airport", {})

            # Normalize departure/arrival times: API returns "2026-9-1 23:35" format
            dep_time_raw = dep_airport.get("time", "")
            arr_time_raw = arr_airport.get("time", "")

            def normalize_time(t):
                """Convert '2026-9-1 23:35' -> '2026-09-01T23:35:00'"""
                if not t:
                    return ""
                try:
                    parts = t.split(" ")
                    date_parts = parts[0].split("-")
                    y, m, d = date_parts[0], date_parts[1].zfill(2), date_parts[2].zfill(2)
                    time_part = parts[1] if len(parts) > 1 else "00:00"
                    return f"{y}-{m}-{d}T{time_part}:00"
                except Exception:
                    return t

            # Duration: API gives raw minutes
            duration_raw = flight.get("duration", {}).get("raw", 0)
            duration_h = duration_raw // 60
            duration_m = duration_raw % 60
            duration_str = f"PT{duration_h}H{duration_m}M" if duration_raw else ""

            stops = flight.get("stops", 0)
            layovers = flight.get("layovers", None)
            if stops == 0 and layovers:
                stops = len(layovers)

            # Booking token for building a deep link
            booking_token = flight.get("booking_token", "")
            deep_link = (
                f"https://www.google.com/travel/flights?tfs={booking_token}"
                if booking_token
                else f"https://www.google.com/travel/flights?q=Flights+from+{origin}+to+{destination}"
            )

            results.append({
                "offer_id": f"gf_{departure_date}_{origin}_{destination}_{idx}",
                "airline": first_flight.get("airline", ""),
                "airline_logo": first_flight.get("airline_logo", ""),
                "flight_number": first_flight.get("flight_number", ""),
                "departure_iata": dep_airport.get("airport_code", origin),
                "arrival_iata": arr_airport.get("airport_code", destination),
                "departure_time": normalize_time(dep_time_raw),
                "arrival_time": normalize_time(arr_time_raw),
                "duration": duration_str,
                "stops": stops,
                "currency": currency,
                "total_amount": str(flight.get("price", 0)),
                "deep_link": deep_link,
            })

        response_payload = {"offers": results}
        _flight_offers_cache[cache_key] = (_time.time(), response_payload)
        return jsonify(response_payload)

    except requests.exceptions.HTTPError as e:
        err_body = ""
        try:
            err_body = e.response.json()
        except Exception:
            err_body = e.response.text
        print("Google Flights HTTPError:", err_body)
        return jsonify({"error": str(err_body)}), e.response.status_code
    except Exception as e:
        print("flight_offers Error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# Flight: Price Trends (Google Flights Calendar Grid)
# --------------------

def _generate_estimated_flight_trends(origin, destination, start_date_str, currency="THB"):
    """
    Generate realistic 30-day estimated flight trends when RapidAPI quota is exhausted or API is offline.
    """
    from datetime import datetime, timedelta
    import random
    
    base_price = 4500
    route = f"{origin}-{destination}"
    if any(k in route for k in ["NRT", "HND", "KIX", "ICN"]):
        base_price = 6500
    elif any(k in route for k in ["LHR", "CDG", "JFK", "LAX", "FRA"]):
        base_price = 18500
    elif any(k in route for k in ["HKT", "CNX", "KBV", "USM", "HDY"]):
        base_price = 1450
    elif any(k in route for k in ["SIN", "KUL", "HKG", "TPE"]):
        base_price = 3800
        
    try:
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
    except Exception:
        start_dt = datetime.now()
        
    trends = []
    seed_val = sum(ord(c) for c in route) + start_dt.month
    rng = random.Random(seed_val)
    
    for day_offset in range(30):
        current_dt = start_dt + timedelta(days=day_offset)
        weekday = current_dt.weekday()
        if weekday in [4, 6]:  # Fri, Sun
            day_factor = 1.18 + rng.uniform(-0.03, 0.05)
        elif weekday in [1, 2]: # Tue, Wed
            day_factor = 0.88 + rng.uniform(-0.04, 0.03)
        elif weekday == 5: # Sat
            day_factor = 1.08 + rng.uniform(-0.03, 0.04)
        else:
            day_factor = 0.95 + rng.uniform(-0.03, 0.03)
            
        final_price = int(round(base_price * day_factor / 50) * 50)
        trends.append({
            "date": current_dt.strftime("%Y-%m-%d"),
            "price": final_price
        })
    return trends


# --------------------
# Flight: Price Trends (Google Flights Calendar Grid)
# --------------------

@app.route("/flight/trends", methods=["POST"])
def flight_trends():
    """
    Returns a 30-day price calendar for cheapest fares on each day.
    Uses Google Flights getCalendarGrid endpoint via RapidAPI with graceful estimation fallback.
    Body: { "origin": "BKK", "destination": "NRT", "date": "2026-09-01", "currency": "THB" }
    """
    data = request.get_json() or {}
    origin = data.get("origin", "").strip().upper() or "BKK"
    destination = data.get("destination", "").strip().upper() or "NRT"
    departure_date = data.get("date", "")
    currency = data.get("currency", "THB")

    if not origin or not destination:
        return jsonify({"error": "origin and destination are required"}), 400

    cache_key = f"{origin}_{destination}_{departure_date}_{currency}"
    cached = _flight_trends_cache.get(cache_key)
    if cached and (_time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        print(f"[Trends] Returning cached calendar trends for {cache_key}")
        return jsonify(cached[1])

    if not RAPIDAPI_KEY:
        print("[Trends] RAPIDAPI_KEY not set. Using estimated trends fallback.")
        trends = _generate_estimated_flight_trends(origin, destination, departure_date, currency)
        return jsonify({"trends": trends, "currency": currency, "is_estimated": True})

    try:
        rapidapi_headers = {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": "google-flights2.p.rapidapi.com",
        }

        params = {
            "departure_id": origin,
            "arrival_id": destination,
            "travel_class": "ECONOMY",
            "adults": "1",
            "currency": currency,
            "country_code": "TH",
        }
        if departure_date:
            params["outbound_date"] = departure_date

        resp = requests.get(
            "https://google-flights2.p.rapidapi.com/api/v1/getCalendarGrid",
            headers=rapidapi_headers,
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json()

        # Fallback: if status=False, retry without outbound_date
        if not raw.get("status") and "outbound_date" in params:
            print(f"[Trends] Request with outbound_date={departure_date} returned status=False. Retrying without date...")
            params.pop("outbound_date")
            try:
                resp = requests.get(
                    "https://google-flights2.p.rapidapi.com/api/v1/getCalendarGrid",
                    headers=rapidapi_headers,
                    params=params,
                    timeout=15,
                )
                resp.raise_for_status()
                raw = resp.json()
            except Exception as e:
                print(f"[Trends] Fallback request failed: {e}")

        calendar = raw.get("data", [])
        trends = [
            {"date": item["departure"], "price": item["price"]}
            for item in calendar
            if item.get("departure") and item.get("price") is not None
        ]

        if not trends:
            print(f"[Trends] Google Flights returned empty data ({raw.get('message')}). Using estimated fallback.")
            trends = _generate_estimated_flight_trends(origin, destination, departure_date, currency)

        response_payload = {"trends": trends, "currency": currency}
        _flight_trends_cache[cache_key] = (_time.time(), response_payload)
        return jsonify(response_payload)

    except Exception as e:
        print("[Trends] Graceful recovery from flight_trends error:", e)
        trends = _generate_estimated_flight_trends(origin, destination, departure_date, currency)
        return jsonify({"trends": trends, "currency": currency, "is_estimated": True})





# --------------------
# Save/Read Experiment Results (Exp 1 - 5 with Token & Cost Benchmarking)
# --------------------

EXP1_FIELDNAMES = [
    "Timestamp", "Image Name", "Ground Truth", "Tier", "Model",
    "Predicted Place", "Confidence", "Time MS", "Is Correct",
    "Recall Rank", "Matched Alias", "Temperature", "Failure Mode",
    "Prompt Tokens", "Completion Tokens", "Total Tokens", "Cost USD", "Tokens Per Sec"
]

EXP2_FIELDNAMES = [
    "Timestamp", "Image Name", "Ground Truth", "Tier", "Model",
    "Predicted (CLIP)", "Predicted (No CLIP)",
    "Confidence (CLIP)", "Confidence (No CLIP)",
    "Correct (CLIP)", "Correct (No CLIP)",
    "Latency CLIP (ms)", "Latency No CLIP (ms)", "Delta Latency (ms)",
    "Temperature", "Failure Mode (CLIP)", "Failure Mode (No CLIP)",
    "Tokens CLIP", "Tokens No CLIP", "Cost CLIP (USD)", "Cost No CLIP (USD)", "Delta Cost (USD)"
]

EXP3_FIELDNAMES = [
    "Timestamp", "Landmark Ground Truth", "Image Name", "Tier",
    "Condition Category", "Condition Label",
    "Model", "Predicted Place", "Confidence", "Time MS", "Is Correct",
    "Temperature", "Failure Mode",
    "Prompt Tokens", "Completion Tokens", "Total Tokens", "Cost USD", "Tokens Per Sec"
]

EXP4_FIELDNAMES = [
    "Timestamp", "Image Name", "Ground Truth", "Tier", "Model",
    "Prompt Variant ID", "Prompt Variant Name",
    "Predicted Place", "Confidence", "Time MS", "Is Correct", "AI Reasoning",
    "Temperature", "Failure Mode",
    "Prompt Tokens", "Completion Tokens", "Total Tokens", "Cost USD", "Tokens Per Sec"
]

EXP5_FIELDNAMES = [
    "Timestamp", "Session ID", "Image Name", "Ground Truth", "Tier", "Model",
    "Run Number", "Total Runs", "Predicted Place", "Confidence", "Time MS", "Is Correct",
    "Temperature", "Failure Mode",
    "Prompt Tokens", "Completion Tokens", "Total Tokens", "Cost USD", "Tokens Per Sec"
]


def ensure_csv_file(csv_path, expected_fieldnames):
    """
    Ensures that csv_path exists with all expected_fieldnames.
    If the file exists with older/fewer columns, migrates existing data to the new header schema.
    """
    import csv
    if not os.path.exists(csv_path):
        os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
        with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(expected_fieldnames)
        return

    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            existing_header = next(reader, [])
    except Exception:
        existing_header = []

    if existing_header and existing_header != expected_fieldnames:
        old_rows = []
        try:
            with open(csv_path, mode="r", encoding="utf-8") as f:
                d_reader = csv.DictReader(f)
                for r in d_reader:
                    old_rows.append(r)

            with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
                d_writer = csv.DictWriter(f, fieldnames=expected_fieldnames, extrasaction="ignore")
                d_writer.writeheader()
                for r in old_rows:
                    row_dict = {}
                    for col in expected_fieldnames:
                        val = r.get(col)
                        if val in (None, "") and col == "Tier":
                            val = "tier1_iconic"
                        elif val in (None, "") and col in ("Failure Mode", "Failure Mode (CLIP)", "Failure Mode (No CLIP)"):
                            val = "none"
                        elif val in (None, "") and col == "Temperature":
                            val = "0.0"
                        elif val is None:
                            val = ""
                        row_dict[col] = val
                    d_writer.writerow(row_dict)
        except Exception as e:
            print(f"Warning: could not migrate CSV {csv_path}: {e}")


@app.route("/experiment/save", methods=["POST"])
def save_experiment():
    """
    Appends experiment trial data to a local CSV file with multi-alias, recall rank, tier, and token/cost metrics.
    """
    import csv
    import datetime

    data = request.get_json()
    if not data or "image_name" not in data or "ground_truth" not in data or "results" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    image_name = data["image_name"]
    ground_truth = data["ground_truth"]
    tier = data.get("tier") or "tier1_iconic"
    temperature = data.get("temperature", 0.0)
    results = data["results"]

    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/experiment_results.csv"

    try:
        ensure_csv_file(csv_path, EXP1_FIELDNAMES)
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=EXP1_FIELDNAMES, extrasaction="ignore")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            for res in results:
                is_corr = res.get("is_correct")
                rank = res.get("recall_rank")
                if rank is None:
                    rank = 1 if (is_corr is True or is_corr == "True" or is_corr == "true" or is_corr == 1) else 0

                writer.writerow({
                    "Timestamp": timestamp,
                    "Image Name": image_name,
                    "Ground Truth": ground_truth,
                    "Tier": res.get("tier") or tier,
                    "Model": res.get("model"),
                    "Predicted Place": res.get("predicted"),
                    "Confidence": res.get("confidence"),
                    "Time MS": res.get("time_ms"),
                    "Is Correct": res.get("is_correct"),
                    "Recall Rank": rank,
                    "Matched Alias": res.get("matched_alias") or "",
                    "Temperature": res.get("temperature", temperature),
                    "Failure Mode": res.get("failure_mode", "none"),
                    "Prompt Tokens": res.get("prompt_tokens", 0),
                    "Completion Tokens": res.get("completion_tokens", 0),
                    "Total Tokens": res.get("total_tokens", 0),
                    "Cost USD": res.get("cost_usd", 0.0),
                    "Tokens Per Sec": res.get("tokens_per_sec", 0.0)
                })

        return jsonify({"status": "success", "message": "Results saved successfully"})
    except Exception as e:
        print("Error saving experiment:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/experiment/results", methods=["GET"])
def get_experiment_results():
    """
    Reads the existing experiment results from the local CSV file.
    """
    import csv
    csv_path = "../experiment/experiment_results.csv"
    if not os.path.exists(csv_path):
        return jsonify({"results": []})

    try:
        results = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                is_correct = row.get("Is Correct") == "True" or row.get("Is Correct") == "true" or row.get("Is Correct") == "1"
                raw_rank = row.get("Recall Rank")
                rank = int(raw_rank) if raw_rank and raw_rank.isdigit() else (1 if is_correct else 0)

                results.append({
                    "timestamp": row.get("Timestamp"),
                    "image_name": row.get("Image Name"),
                    "ground_truth": row.get("Ground Truth"),
                    "tier": row.get("Tier") or "tier1_iconic",
                    "model": row.get("Model"),
                    "predicted": row.get("Predicted Place"),
                    "confidence": float(row.get("Confidence") or 0.0),
                    "time_ms": int(row.get("Time MS") or 0),
                    "is_correct": is_correct,
                    "recall_rank": rank,
                    "matched_alias": row.get("Matched Alias") or None,
                    "temperature": float(row.get("Temperature") or 0.0),
                    "failure_mode": row.get("Failure Mode") or "none",
                    "prompt_tokens": int(row.get("Prompt Tokens") or 0),
                    "completion_tokens": int(row.get("Completion Tokens") or 0),
                    "total_tokens": int(row.get("Total Tokens") or 0),
                    "cost_usd": float(row.get("Cost USD") or 0.0),
                    "tokens_per_sec": float(row.get("Tokens Per Sec") or 0.0)
                })
        return jsonify({"results": results})
    except Exception as e:
        print("Error reading experiment results:", e)
        return jsonify({"error": str(e)}), 500


# --------------------
# EXP 2: Pipeline Comparison Endpoints
# --------------------

@app.route("/experiment/save_exp2", methods=["POST"])
def save_exp2():
    import csv, datetime
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "Missing data"}), 400

    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/exp2_pipeline_comparison.csv"

    try:
        ensure_csv_file(csv_path, EXP2_FIELDNAMES)
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=EXP2_FIELDNAMES, extrasaction="ignore")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            tier = data.get("tier") or "tier1_iconic"
            temperature = data.get("temperature", 0.0)
            for res in data["results"]:
                writer.writerow({
                    "Timestamp": timestamp,
                    "Image Name": data.get("image_name"),
                    "Ground Truth": data.get("ground_truth"),
                    "Tier": res.get("tier") or tier,
                    "Model": res.get("model"),
                    "Predicted (CLIP)": res.get("predicted_clip"),
                    "Predicted (No CLIP)": res.get("predicted_noclip"),
                    "Confidence (CLIP)": res.get("confidence_clip", 0.0),
                    "Confidence (No CLIP)": res.get("confidence_noclip", 0.0),
                    "Correct (CLIP)": res.get("correct_clip"),
                    "Correct (No CLIP)": res.get("correct_noclip"),
                    "Latency CLIP (ms)": res.get("latency_clip"),
                    "Latency No CLIP (ms)": res.get("latency_noclip"),
                    "Delta Latency (ms)": res.get("delta_latency"),
                    "Temperature": res.get("temperature", temperature),
                    "Failure Mode (CLIP)": res.get("failure_mode_clip", "none"),
                    "Failure Mode (No CLIP)": res.get("failure_mode_noclip", "none"),
                    "Tokens CLIP": res.get("tokens_clip", 0),
                    "Tokens No CLIP": res.get("tokens_noclip", 0),
                    "Cost CLIP (USD)": res.get("cost_clip", 0.0),
                    "Cost No CLIP (USD)": res.get("cost_noclip", 0.0),
                    "Delta Cost (USD)": res.get("delta_cost", 0.0)
                })
        return jsonify({"status": "success"})
    except Exception as e:
        print("Error saving exp2:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/experiment/results_exp2", methods=["GET"])
def get_exp2_results():
    import csv
    csv_path = "../experiment/exp2_pipeline_comparison.csv"
    if not os.path.exists(csv_path):
        return jsonify({"results": []})
    try:
        results = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                d = dict(row)
                if not d.get("Tier"):
                    d["Tier"] = "tier1_iconic"
                results.append(d)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------
# EXP 3: Robustness Test Endpoints
# --------------------

@app.route("/experiment/save_exp3", methods=["POST"])
def save_exp3():
    import csv, datetime
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "Missing data"}), 400

    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/exp3_robustness.csv"

    try:
        ensure_csv_file(csv_path, EXP3_FIELDNAMES)
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=EXP3_FIELDNAMES, extrasaction="ignore")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tier = data.get("tier") or "tier1_iconic"
            temperature = data.get("temperature", 0.0)

            for res in data["results"]:
                writer.writerow({
                    "Timestamp": timestamp,
                    "Landmark Ground Truth": data.get("ground_truth"),
                    "Image Name": res.get("image_name"),
                    "Tier": res.get("tier") or tier,
                    "Condition Category": res.get("condition_category"),
                    "Condition Label": res.get("condition_label"),
                    "Model": res.get("model"),
                    "Predicted Place": res.get("predicted"),
                    "Confidence": res.get("confidence"),
                    "Time MS": res.get("time_ms"),
                    "Is Correct": res.get("is_correct"),
                    "Temperature": res.get("temperature", temperature),
                    "Failure Mode": res.get("failure_mode", "none"),
                    "Prompt Tokens": res.get("prompt_tokens", 0),
                    "Completion Tokens": res.get("completion_tokens", 0),
                    "Total Tokens": res.get("total_tokens", 0),
                    "Cost USD": res.get("cost_usd", 0.0),
                    "Tokens Per Sec": res.get("tokens_per_sec", 0.0)
                })
        return jsonify({"status": "success"})
    except Exception as e:
        print("Error saving exp3:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/experiment/results_exp3", methods=["GET"])
def get_exp3_results():
    import csv
    csv_path = "../experiment/exp3_robustness.csv"
    if not os.path.exists(csv_path):
        return jsonify({"results": []})
    try:
        results = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                d = dict(row)
                if not d.get("Tier"):
                    d["Tier"] = "tier1_iconic"
                results.append(d)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------
# EXP 4: Prompt Sensitivity Endpoints
# --------------------

@app.route("/experiment/save_exp4", methods=["POST"])
def save_exp4():
    import csv, datetime
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "Missing data"}), 400

    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/exp4_prompt_sensitivity.csv"

    try:
        ensure_csv_file(csv_path, EXP4_FIELDNAMES)
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=EXP4_FIELDNAMES, extrasaction="ignore")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tier = data.get("tier") or "tier1_iconic"
            temperature = data.get("temperature", 0.0)

            for res in data["results"]:
                writer.writerow({
                    "Timestamp": timestamp,
                    "Image Name": data.get("image_name"),
                    "Ground Truth": data.get("ground_truth"),
                    "Tier": res.get("tier") or tier,
                    "Model": res.get("model"),
                    "Prompt Variant ID": res.get("variant_id"),
                    "Prompt Variant Name": res.get("variant_name"),
                    "Predicted Place": res.get("predicted"),
                    "Confidence": res.get("confidence"),
                    "Time MS": res.get("time_ms"),
                    "Is Correct": res.get("is_correct"),
                    "AI Reasoning": res.get("reasoning"),
                    "Temperature": res.get("temperature", temperature),
                    "Failure Mode": res.get("failure_mode", "none"),
                    "Prompt Tokens": res.get("prompt_tokens", 0),
                    "Completion Tokens": res.get("completion_tokens", 0),
                    "Total Tokens": res.get("total_tokens", 0),
                    "Cost USD": res.get("cost_usd", 0.0),
                    "Tokens Per Sec": res.get("tokens_per_sec", 0.0)
                })
        return jsonify({"status": "success"})
    except Exception as e:
        print("Error saving exp4:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/experiment/results_exp4", methods=["GET"])
def get_exp4_results():
    import csv
    csv_path = "../experiment/exp4_prompt_sensitivity.csv"
    if not os.path.exists(csv_path):
        return jsonify({"results": []})
    try:
        results = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                d = dict(row)
                if not d.get("Tier"):
                    d["Tier"] = "tier1_iconic"
                results.append(d)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------
# EXP 5: Consistency / Operational Stability Endpoints
# --------------------

@app.route("/experiment/save_exp5", methods=["POST"])
def save_exp5():
    import csv, datetime
    data = request.get_json()
    if not data or "results" not in data:
        return jsonify({"error": "Missing data"}), 400

    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/exp5_consistency.csv"

    try:
        ensure_csv_file(csv_path, EXP5_FIELDNAMES)
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=EXP5_FIELDNAMES, extrasaction="ignore")
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            session_id = data.get("session_id", datetime.datetime.now().strftime("%Y%m%d%H%M%S"))
            tier = data.get("tier") or "tier1_iconic"
            temperature = data.get("temperature", 0.0)

            for res in data["results"]:
                writer.writerow({
                    "Timestamp": timestamp,
                    "Session ID": session_id,
                    "Image Name": data.get("image_name"),
                    "Ground Truth": data.get("ground_truth"),
                    "Tier": res.get("tier") or tier,
                    "Model": res.get("model"),
                    "Run Number": res.get("run_number"),
                    "Total Runs": res.get("total_runs"),
                    "Predicted Place": res.get("predicted"),
                    "Confidence": res.get("confidence"),
                    "Time MS": res.get("time_ms"),
                    "Is Correct": res.get("is_correct"),
                    "Temperature": res.get("temperature", temperature),
                    "Failure Mode": res.get("failure_mode", "none"),
                    "Prompt Tokens": res.get("prompt_tokens", 0),
                    "Completion Tokens": res.get("completion_tokens", 0),
                    "Total Tokens": res.get("total_tokens", 0),
                    "Cost USD": res.get("cost_usd", 0.0),
                    "Tokens Per Sec": res.get("tokens_per_sec", 0.0)
                })
        return jsonify({"status": "success"})
    except Exception as e:
        print("Error saving exp5:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/experiment/results_exp5", methods=["GET"])
def get_exp5_results():
    import csv
    csv_path = "../experiment/exp5_consistency.csv"
    if not os.path.exists(csv_path):
        return jsonify({"results": []})
    try:
        results = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                d = dict(row)
                if not d.get("Tier"):
                    d["Tier"] = "tier1_iconic"
                results.append(d)
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------
# Blind Evaluation & Role Management Endpoints
# --------------------
import json
import uuid
import datetime

parent_exp = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "experiment"))
if os.path.isdir(parent_exp):
    EXPERIMENT_DIR = parent_exp
else:
    EXPERIMENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "experiment"))
os.makedirs(EXPERIMENT_DIR, exist_ok=True)

BLIND_TRIPS_FILE = os.path.join(EXPERIMENT_DIR, "blind_trips.json")
BLIND_EVALS_FILE = os.path.join(EXPERIMENT_DIR, "blind_evaluations.json")
BLIND_COMPARISONS_FILE = os.path.join(EXPERIMENT_DIR, "blind_comparisons.json")
USER_ROLES_FILE = os.path.join(EXPERIMENT_DIR, "user_roles.json")

def _load_json_file(filepath, default_val):
    if not os.path.exists(filepath):
        return default_val
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return default_val

def _save_json_file(filepath, data):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.route("/blind_eval/save_trip", methods=["POST"])
def save_blind_trip():
    try:
        data = request.get_json() or {}
        scenario_id = (data.get("scenario_id") or "SC-DEFAULT").strip()
        scenario_title = data.get("scenario_title") or scenario_id
        scenario_notes = data.get("scenario_notes", "")
        actual_model = data.get("actual_model", "gpt-4o")
        itinerary = data.get("itinerary", [])
        preferences = data.get("preferences", {})
        typical_weather = data.get("typicalWeather")
        suggestions = data.get("suggestions", [])
        accommodations = data.get("accommodations", [])
        uploaded_locations = data.get("uploaded_locations", [])

        trips = _load_json_file(BLIND_TRIPS_FILE, [])
        trip_id = f"trip_{uuid.uuid4().hex[:8]}"

        new_trip = {
            "id": trip_id,
            "scenario_id": scenario_id,
            "scenario_title": scenario_title,
            "scenario_notes": scenario_notes,
            "actual_model": actual_model,
            "itinerary": itinerary,
            "preferences": preferences,
            "typicalWeather": typical_weather,
            "suggestions": suggestions,
            "accommodations": accommodations,
            "uploaded_locations": uploaded_locations,
            "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        trips.append(new_trip)
        _save_json_file(BLIND_TRIPS_FILE, trips)

        return jsonify({"status": "success", "trip_id": trip_id, "scenario_id": scenario_id})
    except Exception as e:
        print("[Error /blind_eval/save_trip]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/blind_eval/trips", methods=["GET"])
def get_blind_trips():
    try:
        user_role = request.args.get("role", "user")
        raw_trips = _load_json_file(BLIND_TRIPS_FILE, [])

        # Group by scenario to assign deterministic blind labels (แผน A, แผน B, etc.)
        scenario_map = {}
        for t in raw_trips:
            sc_id = t.get("scenario_id", "SC-DEFAULT")
            scenario_map.setdefault(sc_id, []).append(t)

        labeled_trips = []
        for sc_id, group in scenario_map.items():
            # Sort group by created_at or id for deterministic labeling
            sorted_group = sorted(group, key=lambda x: x.get("created_at", x.get("id")))
            for idx, item in enumerate(sorted_group):
                trip_copy = dict(item)
                blind_label = f"แผน {chr(65 + idx)}"  # แผน A, แผน B, แผน C
                trip_copy["blind_label"] = blind_label

                # Hide actual model unless user is dev
                if user_role != "dev":
                    trip_copy.pop("actual_model", None)

                labeled_trips.append(trip_copy)

        return jsonify({"trips": labeled_trips})
    except Exception as e:
        print("[Error /blind_eval/trips]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/blind_eval/trip/<trip_id>", methods=["DELETE"])
def delete_blind_trip(trip_id):
    try:
        trips = _load_json_file(BLIND_TRIPS_FILE, [])
        trips = [t for t in trips if t.get("id") != trip_id]
        _save_json_file(BLIND_TRIPS_FILE, trips)
        return jsonify({"status": "deleted", "trip_id": trip_id})
    except Exception as e:
        print("[Error /blind_eval/trip delete]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/blind_eval/submit_score", methods=["POST"])
def submit_blind_score():
    try:
        data = request.get_json() or {}
        scenario_id = data.get("scenario_id")
        trip_id = data.get("trip_id")
        blind_label = data.get("blind_label")
        expert_id = data.get("expert_id", "anonymous_expert")
        expert_name = data.get("expert_name", "Anonymous Expert")
        expert_profile = data.get("expert_profile", {})
        detailed_scores = data.get("detailed_scores") or {}
        scores = data.get("scores") or {}
        overall_pick = data.get("overall_pick", False)
        feedback = data.get("feedback", "")

        if not scenario_id or not trip_id:
            return jsonify({"error": "Missing scenario_id or trip_id"}), 400

        # Retrieve actual model for background audit (hidden from response)
        trips = _load_json_file(BLIND_TRIPS_FILE, [])
        matched_trip = next((t for t in trips if t.get("id") == trip_id), None)
        actual_model = matched_trip.get("actual_model", "unknown") if matched_trip else "unknown"

        # Calculate dimension averages from detailed_scores if present
        fa_avg = float(detailed_scores.get("fa_avg", 0)) or (
            sum([int(detailed_scores.get(f"fa{i}", 3)) for i in range(1, 6)]) / 5.0
            if "fa1" in detailed_scores else float(scores.get("information_accuracy", 3))
        )
        cc_avg = float(detailed_scores.get("cc_avg", 0)) or (
            sum([int(detailed_scores.get(f"cc{i}", 3)) for i in range(1, 6)]) / 5.0
            if "cc1" in detailed_scores else float(scores.get("persona_alignment", 3))
        )
        pf_avg = float(detailed_scores.get("pf_avg", 0)) or (
            sum([int(detailed_scores.get(f"pf{i}", 3)) for i in range(1, 6)]) / 5.0
            if "pf1" in detailed_scores else float(scores.get("temporal_pacing", 3))
        )
        sr_avg = float(detailed_scores.get("sr_avg", 0)) or (
            sum([int(detailed_scores.get(f"sr{i}", 3)) for i in range(1, 5)]) / 4.0
            if "sr1" in detailed_scores else float(scores.get("spatial_feasibility", 3))
        )
        de_avg = float(detailed_scores.get("de_avg", 0)) or (
            sum([int(detailed_scores.get(f"de{i}", 3)) for i in range(1, 6)]) / 5.0
            if "de1" in detailed_scores else float(scores.get("attraction_quality", 3))
        )
        ru_avg = float(detailed_scores.get("ru_avg", 0)) or (
            sum([int(detailed_scores.get(f"ru{i}", 3)) for i in range(1, 5)]) / 4.0
            if "ru1" in detailed_scores else 3.0
        )

        overall_percentage = detailed_scores.get("overall_percentage", 75)
        strengths = detailed_scores.get("strengths", "")
        weaknesses = detailed_scores.get("weaknesses", "")
        priority_improvement = detailed_scores.get("priority_improvement", "")
        priority_improvement_other = detailed_scores.get("priority_improvement_other", "")

        geo_fam = data.get("geographic_familiarity") or detailed_scores.get("geographic_familiarity") or expert_profile.get("geographic_familiarity") or 3
        vis_align = data.get("vision_alignment") or detailed_scores.get("vision_alignment") or detailed_scores.get("cc6") or 4

        evals = _load_json_file(BLIND_EVALS_FILE, [])
        eval_id = f"eval_{uuid.uuid4().hex[:8]}"

        new_eval = {
            "id": eval_id,
            "scenario_id": scenario_id,
            "trip_id": trip_id,
            "blind_label": blind_label,
            "actual_model": actual_model,
            "expert_id": expert_id,
            "expert_name": expert_name,
            "geographic_familiarity": geo_fam,
            "vision_alignment": vis_align,
            "expert_profile": {
                **expert_profile,
                "geographic_familiarity": geo_fam,
            },
            "scores": {
                "spatial_feasibility": round(sr_avg),
                "temporal_pacing": round(pf_avg),
                "persona_alignment": round(cc_avg),
                "attraction_quality": round(de_avg),
                "information_accuracy": round(fa_avg),
                "vision_alignment": vis_align,
                "geographic_familiarity": geo_fam,
            },
            "detailed_scores": {
                **detailed_scores,
                "fa_avg": round(fa_avg, 2),
                "cc_avg": round(cc_avg, 2),
                "pf_avg": round(pf_avg, 2),
                "sr_avg": round(sr_avg, 2),
                "de_avg": round(de_avg, 2),
                "ru_avg": round(ru_avg, 2),
                "cc6": detailed_scores.get("cc6", vis_align),
                "vision_alignment": vis_align,
                "geographic_familiarity": geo_fam,
                "overall_percentage": overall_percentage,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "priority_improvement": priority_improvement,
                "priority_improvement_other": priority_improvement_other,
            },
            "overall_pick": bool(overall_pick),
            "feedback": feedback or strengths or weaknesses,
            "submitted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        evals.append(new_eval)
        _save_json_file(BLIND_EVALS_FILE, evals)

        return jsonify({"status": "success", "eval_id": eval_id})
    except Exception as e:
        print("[Error /blind_eval/submit_score]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/blind_eval/submit_comparison", methods=["POST"])
def submit_blind_comparison():
    try:
        data = request.get_json() or {}
        scenario_id = data.get("scenario_id")
        if not scenario_id:
            return jsonify({"error": "Missing scenario_id"}), 400

        comparisons = _load_json_file(BLIND_COMPARISONS_FILE, [])
        comp_id = f"comp_{uuid.uuid4().hex[:8]}"

        expert_profile = data.get("expert_profile", {})
        geo_fam = data.get("geographic_familiarity") or expert_profile.get("geographic_familiarity") or 3

        new_comp = {
            "id": comp_id,
            "scenario_id": scenario_id,
            "expert_id": data.get("expert_id", "anonymous_expert"),
            "expert_name": data.get("expert_name", "Anonymous Expert"),
            "geographic_familiarity": geo_fam,
            "expert_profile": {
                **expert_profile,
                "geographic_familiarity": geo_fam,
            },
            "rankings": data.get("rankings", []),
            "best_for_practical_use": data.get("best_for_practical_use", {}),
            "qualitative_feedback": data.get("qualitative_feedback", {}),
            "submitted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        comparisons.append(new_comp)
        _save_json_file(BLIND_COMPARISONS_FILE, comparisons)

        return jsonify({"status": "success", "comparison_id": comp_id})
    except Exception as e:
        print("[Error /blind_eval/submit_comparison]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/blind_eval/results", methods=["GET"])
def get_blind_results():
    try:
        evals = _load_json_file(BLIND_EVALS_FILE, [])
        trips = _load_json_file(BLIND_TRIPS_FILE, [])
        comparisons = _load_json_file(BLIND_COMPARISONS_FILE, [])

        # Compute summary stats per model
        model_stats = {}
        for ev in evals:
            m = ev.get("actual_model", "unknown")
            if m not in model_stats:
                model_stats[m] = {
                    "model": m,
                    "count": 0,
                    "total_spatial": 0,
                    "total_temporal": 0,
                    "total_persona": 0,
                    "total_attraction": 0,
                    "total_accuracy": 0,
                    "total_fa": 0,
                    "total_cc": 0,
                    "total_pf": 0,
                    "total_sr": 0,
                    "total_de": 0,
                    "total_ru": 0,
                    "total_percentage": 0,
                    "total_overall": 0,
                    "wins": 0,
                }
            sc = ev.get("scores", {})
            det = ev.get("detailed_scores", {})
            st = model_stats[m]
            st["count"] += 1
            st["total_spatial"] += sc.get("spatial_feasibility", 0)
            st["total_temporal"] += sc.get("temporal_pacing", 0)
            st["total_persona"] += sc.get("persona_alignment", 0)
            st["total_attraction"] += sc.get("attraction_quality", 0)
            st["total_accuracy"] += sc.get("information_accuracy", 0)

            # Detailed 6 dimensions
            fa_val = float(det.get("fa_avg", sc.get("information_accuracy", 3)))
            cc_val = float(det.get("cc_avg", sc.get("persona_alignment", 3)))
            pf_val = float(det.get("pf_avg", sc.get("temporal_pacing", 3)))
            sr_val = float(det.get("sr_avg", sc.get("spatial_feasibility", 3)))
            de_val = float(det.get("de_avg", sc.get("attraction_quality", 3)))
            ru_val = float(det.get("ru_avg", 3.5))
            pct_val = float(det.get("overall_percentage", 70))

            st["total_fa"] += fa_val
            st["total_cc"] += cc_val
            st["total_pf"] += pf_val
            st["total_sr"] += sr_val
            st["total_de"] += de_val
            st["total_ru"] += ru_val
            st["total_percentage"] += pct_val

            avg_6 = (fa_val + cc_val + pf_val + sr_val + de_val + ru_val) / 6.0
            st["total_overall"] += avg_6
            if ev.get("overall_pick"):
                st["wins"] += 1

        summary = []
        for m, st in model_stats.items():
            c = st["count"] or 1
            summary.append({
                "model": m,
                "evaluations_count": st["count"],
                "avg_spatial": round(st["total_spatial"] / c, 2),
                "avg_temporal": round(st["total_temporal"] / c, 2),
                "avg_persona": round(st["total_persona"] / c, 2),
                "avg_attraction": round(st["total_attraction"] / c, 2),
                "avg_accuracy": round(st["total_accuracy"] / c, 2),
                "avg_fa": round(st["total_fa"] / c, 2),
                "avg_cc": round(st["total_cc"] / c, 2),
                "avg_pf": round(st["total_pf"] / c, 2),
                "avg_sr": round(st["total_sr"] / c, 2),
                "avg_de": round(st["total_de"] / c, 2),
                "avg_ru": round(st["total_ru"] / c, 2),
                "avg_overall_percentage": round(st["total_percentage"] / c, 1),
                "overall_score": round(st["total_overall"] / c, 2),
                "total_wins": st["wins"],
                "win_rate_percent": round((st["wins"] / c) * 100, 1)
            })

        return jsonify({
            "evaluations": evals,
            "comparisons": comparisons,
            "summary": summary,
            "total_trips": len(trips)
        })
    except Exception as e:
        print("[Error /blind_eval/results]:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/users/roles", methods=["GET", "POST"])
def manage_user_roles():
    try:
        # Default initial roles if file is missing
        default_roles = {
            "dev@pixinerary.com": {
                "email": "dev@pixinerary.com",
                "role": "dev",
                "name": "Developer Admin",
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            },
            "expert@pixinerary.com": {
                "email": "expert@pixinerary.com",
                "role": "expert",
                "name": "Tourism Expert",
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            },
            "user@pixinerary.com": {
                "email": "user@pixinerary.com",
                "role": "user",
                "name": "General Traveler",
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        roles = _load_json_file(USER_ROLES_FILE, default_roles)

        if request.method == "POST":
            data = request.get_json() or {}
            email = (data.get("email") or "").strip().lower()
            role = (data.get("role") or "user").strip().lower()
            name = (data.get("name") or email.split("@")[0]).strip()

            if not email:
                return jsonify({"error": "Email is required"}), 400
            if role not in ["dev", "expert", "user"]:
                return jsonify({"error": "Invalid role. Must be 'dev', 'expert', or 'user'"}), 400

            roles[email] = {
                "email": email,
                "role": role,
                "name": name,
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            _save_json_file(USER_ROLES_FILE, roles)
            return jsonify({"status": "success", "user": roles[email]})

        # GET request returns list of users
        return jsonify({"users": list(roles.values())})
    except Exception as e:
        print("[Error /users/roles]:", e)
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