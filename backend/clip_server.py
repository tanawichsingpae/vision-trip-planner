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

    data = request.get_json()

    if not data or "url" not in data:
        return jsonify({"error": "No URL provided"}), 400

    try:
        raw_url = data["url"]
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "image/jpeg,image/png,image/webp,*/*;q=0.8"
        }

        # Normalize Unsplash / CDN image URLs to explicitly request standard JPEG format (avoids unsupported AVIF)
        fetch_url = raw_url
        if "images.unsplash.com" in fetch_url:
            if "auto=format" in fetch_url:
                fetch_url = fetch_url.replace("auto=format", "fm=jpg")
            elif "fm=" not in fetch_url:
                fetch_url += ("&" if "?" in fetch_url else "?") + "fm=jpg"

        response = requests.get(fetch_url, headers=headers, timeout=10)
        response.raise_for_status()

        try:
            img = Image.open(BytesIO(response.content)).convert("RGB")
        except Exception as img_err:
            if "images.unsplash.com" in raw_url:
                fallback_url = raw_url.split("?")[0] + "?w=1000&q=80&fm=jpg"
                fb_res = requests.get(fallback_url, headers=headers, timeout=10)
                fb_res.raise_for_status()
                img = Image.open(BytesIO(fb_res.content)).convert("RGB")
            else:
                raise img_err

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
        print("Error in /embedding_url:", e)
        return jsonify({"error": str(e)}), 500


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
    "qwen-vl": "qwen/qwen-2.5-vl-72b-instruct:free",
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
                f"\n[กฎเหล็กและข้อบังคับสูงสุดในการตอบสำหรับ ChatBot พิกซ์]:\n"
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
                            "- You are 'พิกซ์ (Pix) - Your AI Travel Companion' — a polite, warm, smart, friendly Korean-inspired travel buddy.\n"
                            "- Always speak with polite Thai ending particles (ครับ), refer to yourself as 'ผม' or 'พิกซ์', and STRICTLY address the user ONLY as 'คุณ' (NEVER use 'คุณลูกค้า', 'ท่าน', 'เธอ', 'นาย', 'พี่', 'น้อง', 'เพื่อน', 'ยู' or any other pronoun; ALWAYS address the user ONLY as 'คุณ').\n"
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

        for current_model in candidate_models:
            try:
                print(f"[AI] Requesting model: {current_model} (expect_json={expect_json})")
                create_kwargs = {
                    "model": current_model,
                    "messages": formatted_messages,
                    "max_tokens": 8192,
                }
                response = openrouter_client.chat.completions.create(**create_kwargs)

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

                    if not cleaned.startswith(("{", "[")):
                        print(f"[AI] Model {current_model} non-JSON response: {cleaned[:150]}")
                        last_error = f"AI model {current_model} declined to output valid JSON"
                        continue

                    cleaned_content = cleaned
                    print(f"[AI] Successfully generated content using model: {current_model}")
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
            return jsonify({"text": cleaned_content})

        return jsonify({"error": last_error or f"AI model {model_name} returned empty content"}), 500

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


@app.route("/ai/buddy-live-check", methods=["POST"])
def buddy_live_check():
    """
    Search RAG Live Insights for Pix Travel Buddy using OpenRouter Gemini with live web search (:online).
    Gathers real-time transit disruption (BTS/MRT), traffic, road closures, weather alerts, and safety news.
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

        if not city and not places:
            return jsonify({
                "status": "empty",
                "has_disruption": False,
                "transit_status": "normal",
                "title": "ไม่มีข้อมูลสถานที่",
                "summary": "ไม่พบข้อมูลเมืองหรือสถานที่สำหรับตรวจสอบเหตุการณ์สด",
                "disruptions": [],
                "attraction_alerts": [],
                "special_events": [],
                "weather_traffic_alert": "",
                "advice_for_travelers": "",
                "local_tips_and_rules": "",
                "tips": [],
                "live_updates": [],
                "sources": [],
                "sources_count": 0
            })

        target_term = city or (places[0] if places else "กรุงเทพมหานคร")
        cache_key = f"{target_term}_{date_str}".lower()
        cached = get_cached_live_check(cache_key)
        if cached:
            return jsonify(cached)

        # 1. Primary: OpenRouter with live web search (google/gemini-2.5-flash:online)
        if openrouter_client:
            prompt = f"""คุณคือระบบตรวจสอบข้อมูลสดรอบด้านสำหรับการท่องเที่ยวและขนส่งสาธารณะ (Pix Live Travel & Safety Companion) ประจำเมือง {target_term}
วันที่ปัจจุบัน: {date_str}
สถานที่สำคัญในทริป: {', '.join(places[:6]) if places else target_term}

กรุณาค้นหาข้อมูลสดล่าสุดบนอินเทอร์เน็ตแบบเรียลไทม์ (Real-time Online Web Search) ครอบคลุม 5 มิติสำคัญ:
1. [ขนส่ง & จราจร]: ระบบขนส่งสาธารณะ (รถไฟฟ้า BTS, MRT สายต่างๆ, รถไฟ, แอร์พอร์ตลิงก์ ARL, รถเมล์, เรือโดยสาร) มีจุดใดขัดข้อง ล่าช้า ปิดให้บริการ หรือถนนปิด น้ำท่วม อุบัติเหตุใหญ่ในวันนี้หรือไม่
2. [สภาพอากาศ & ภัยพิบัติ]: ฝนตกหนัก พายุ ลมกระโชกแรง หมอกควัน PM2.5 น้ำท่วมฉับพลัน หรือประกาศเตือนภัยจากกรมอุตุฯ/ปภ.
3. [สถานะสถานที่ท่องเที่ยวในทริป]: สถานที่เหล่านี้ ({', '.join(places[:6]) if places else target_term}) มีจุดใดปิดทำการชั่วคราว มีงานพระราชพิธี ปิดปรับปรุงซ่อมแซม หรือจำกัดเวลาเข้าชม/ต้องจองล่วงหน้าในวันนี้หรือไม่
4. [เทศกาล & อีเวนต์สด]: มีงานเทศกาลท้องถิ่น ตลาดนัดพิเศษ Pop-up Market งานวัด คอนเสิร์ตใหญ่ หรืองานกิจกรรมที่น่าสนใจหรือส่งผลให้คนหนาแน่นในวันนี้หรือไม่
5. [กลโกง & กฎระเบียบเฉพาะวัน]: ข้อควรระวังด้านความปลอดภัย กลโกงนักท่องเที่ยวในพื้นที่ (เช่น หลอกว่าวัดปิด, โก่งราคา) หรือกฎระเบียบพิเศษ (เช่น วันพระใหญ่งดจำหน่ายสุรา, ข้อห้ามบินโดรน)

ตอบกลับเป็น JSON เท่านั้น (Strict JSON) ในรูปแบบ:
{{
  "has_disruption": true หรือ false (เป็น true เฉพาะเมื่อมีเหตุขัดข้อง ล่าช้า ถนนปิด น้ำท่วม หรือสถานที่ในทริปปิดให้บริการจริง),
  "transit_status": "normal" | "warning" | "critical",
  "title": "หัวข้อสรุปสถานการณ์สดสั้นๆ เช่น ระบบการเดินทางปกติ หรือ แจ้งเตือนวัดพระแก้วปิดครึ่งวัน / MRT ล่าช้า",
  "summary": "สรุปภาพรวมสถานการณ์สดสั้นๆ 1-2 ประโยค",
  "disruptions": [
    {{
      "line": "ชื่อสายรถไฟฟ้าหรือเส้นทาง",
      "status": "normal" | "delayed" | "disrupted",
      "detail": "รายละเอียดเหตุการณ์สั้นๆ"
    }}
  ],
  "attraction_alerts": [
    {{
      "place_name": "ชื่อสถานที่",
      "status": "closed" | "restricted" | "crowded" | "normal",
      "note": "รายละเอียด เช่น ปิดทำการช่วงบ่ายเนื่องจากมีพิธีการ หรือ เปิดทำการปกติ"
    }}
  ],
  "special_events": [
    {{
      "event_name": "ชื่องานเทศกาลหรืออีเวนต์",
      "location": "สถานที่หรือย่านจัดงาน",
      "highlight": "จุดเด่นสั้นๆ หรือคำแนะนำเวลาที่ควรไป"
    }}
  ],
  "weather_traffic_alert": "ข้อความแจ้งเตือนสภาพอากาศหรือการจราจรที่ควรระวัง",
  "advice_for_travelers": "คำแนะนำสั้นๆ สำหรับผู้เดินทาง เช่น เผื่อเวลาเดินทาง หรือเลี่ยงเส้นทาง...",
  "local_tips_and_rules": "คำเตือนกลโกงหรือกฎระเบียบเฉพาะวันที่ควรรู้ (ถ้ามี)",
  "sources": ["URL หรือชื่อแหล่งข่าวที่ใช้อ้างอิง"]
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

                # Check if any attraction is closed or restricted, trigger disruption
                attraction_alerts = live_data.get("attraction_alerts", [])
                has_attraction_issue = any(
                    a.get("status") in ["closed", "restricted"] for a in attraction_alerts if isinstance(a, dict)
                )
                has_disruption = bool(live_data.get("has_disruption", False)) or has_attraction_issue

                result = {
                    "status": "success",
                    "city": city or target_term,
                    "has_disruption": has_disruption,
                    "transit_status": live_data.get("transit_status", "normal"),
                    "title": live_data.get("title", f"รายงานสดการเดินทางและสถานที่ {target_term}"),
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

        # 2. Fallback if OpenRouter unavailable
        query = f"{target_term} สภาพการจราจร รถไฟฟ้า รถติด สถานที่ท่องเที่ยว ข่าววันนี้"
        results = search_web_duckduckgo(query, max_results=4)
        live_updates = [r.get("snippet", "")[:180] for r in results if r.get("snippet")]
        fallback_res = {
            "status": "fallback",
            "city": city or target_term,
            "has_disruption": False,
            "transit_status": "normal",
            "title": f"ข้อมูลการเดินทาง {target_term}",
            "summary": live_updates[0] if live_updates else f"ข้อมูลการเดินทางใน {target_term}",
            "disruptions": [],
            "attraction_alerts": [],
            "special_events": [],
            "weather_traffic_alert": "",
            "advice_for_travelers": "ตรวจสอบเส้นทางและสภาพการจราจรก่อนออกเดินทาง",
            "local_tips_and_rules": "",
            "sources": [r.get("url", "") for r in results if r.get("url")],
            "tips": [f"ข้อมูลสดสำหรับ {target_term}: มีรายงานข้อมูลและการเดินทางในพื้นที่"] + live_updates[:2],
            "live_updates": live_updates,
            "sources_count": len(results)
        }
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
# Save/Read Experiment Results
# --------------------

@app.route("/experiment/save", methods=["POST"])
def save_experiment():
    """
    Appends experiment trial data to a local CSV file with multi-alias and recall rank support.
    """
    import csv
    import datetime

    data = request.get_json()
    if not data or "image_name" not in data or "ground_truth" not in data or "results" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    image_name = data["image_name"]
    ground_truth = data["ground_truth"]
    results = data["results"]

    # Ensure experiment directory exists
    os.makedirs("../experiment", exist_ok=True)
    csv_path = "../experiment/experiment_results.csv"
    file_exists = os.path.exists(csv_path)

    try:
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                # Write header with extended thesis metrics
                writer.writerow([
                    "Timestamp", "Image Name", "Ground Truth", "Model",
                    "Predicted Place", "Confidence", "Time MS", "Is Correct",
                    "Recall Rank", "Matched Alias"
                ])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for res in results:
                is_corr = res.get("is_correct")
                rank = res.get("recall_rank")
                if rank is None:
                    rank = 1 if (is_corr is True or is_corr == "True" or is_corr == "true" or is_corr == 1) else 0

                writer.writerow([
                    timestamp,
                    image_name,
                    ground_truth,
                    res.get("model"),
                    res.get("predicted"),
                    res.get("confidence"),
                    res.get("time_ms"),
                    res.get("is_correct"),
                    rank,
                    res.get("matched_alias") or ""
                ])
                
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
                    "model": row.get("Model"),
                    "predicted": row.get("Predicted Place"),
                    "confidence": float(row.get("Confidence") or 0.0),
                    "time_ms": int(row.get("Time MS") or 0),
                    "is_correct": is_correct,
                    "recall_rank": rank,
                    "matched_alias": row.get("Matched Alias") or None
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
    file_exists = os.path.exists(csv_path)

    try:
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow([
                    "Timestamp", "Image Name", "Ground Truth", "Model",
                    "Predicted (CLIP)", "Predicted (No CLIP)",
                    "Correct (CLIP)", "Correct (No CLIP)",
                    "Latency CLIP (ms)", "Latency No CLIP (ms)", "Delta Latency (ms)"
                ])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for res in data["results"]:
                writer.writerow([
                    timestamp,
                    data.get("image_name"),
                    data.get("ground_truth"),
                    res.get("model"),
                    res.get("predicted_clip"),
                    res.get("predicted_noclip"),
                    res.get("correct_clip"),
                    res.get("correct_noclip"),
                    res.get("latency_clip"),
                    res.get("latency_noclip"),
                    res.get("delta_latency")
                ])
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
                results.append(dict(row))
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
    file_exists = os.path.exists(csv_path)

    try:
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow([
                    "Timestamp", "Landmark Ground Truth", "Image Name",
                    "Condition Category", "Condition Label",
                    "Model", "Predicted Place", "Confidence", "Time MS", "Is Correct"
                ])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for res in data["results"]:
                writer.writerow([
                    timestamp,
                    data.get("ground_truth"),
                    res.get("image_name"),
                    res.get("condition_category"),
                    res.get("condition_label"),
                    res.get("model"),
                    res.get("predicted"),
                    res.get("confidence"),
                    res.get("time_ms"),
                    res.get("is_correct")
                ])
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
                results.append(dict(row))
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
    file_exists = os.path.exists(csv_path)

    try:
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow([
                    "Timestamp", "Image Name", "Ground Truth", "Model",
                    "Prompt Variant ID", "Prompt Variant Name",
                    "Predicted Place", "Confidence", "Time MS", "Is Correct", "AI Reasoning"
                ])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for res in data["results"]:
                writer.writerow([
                    timestamp,
                    data.get("image_name"),
                    data.get("ground_truth"),
                    res.get("model"),
                    res.get("variant_id"),
                    res.get("variant_name"),
                    res.get("predicted"),
                    res.get("confidence"),
                    res.get("time_ms"),
                    res.get("is_correct"),
                    res.get("reasoning")
                ])
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
                results.append(dict(row))
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
    file_exists = os.path.exists(csv_path)

    try:
        with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow([
                    "Timestamp", "Session ID", "Image Name", "Ground Truth", "Model",
                    "Run Number", "Total Runs", "Predicted Place", "Confidence", "Time MS", "Is Correct"
                ])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            session_id = data.get("session_id", datetime.datetime.now().strftime("%Y%m%d%H%M%S"))
            for res in data["results"]:
                writer.writerow([
                    timestamp,
                    session_id,
                    data.get("image_name"),
                    data.get("ground_truth"),
                    res.get("model"),
                    res.get("run_number"),
                    res.get("total_runs"),
                    res.get("predicted"),
                    res.get("confidence"),
                    res.get("time_ms"),
                    res.get("is_correct")
                ])
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
                results.append(dict(row))
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
            "expert_profile": expert_profile,
            "scores": {
                "spatial_feasibility": round(sr_avg),
                "temporal_pacing": round(pf_avg),
                "persona_alignment": round(cc_avg),
                "attraction_quality": round(de_avg),
                "information_accuracy": round(fa_avg),
            },
            "detailed_scores": {
                **detailed_scores,
                "fa_avg": round(fa_avg, 2),
                "cc_avg": round(cc_avg, 2),
                "pf_avg": round(pf_avg, 2),
                "sr_avg": round(sr_avg, 2),
                "de_avg": round(de_avg, 2),
                "ru_avg": round(ru_avg, 2),
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

        new_comp = {
            "id": comp_id,
            "scenario_id": scenario_id,
            "expert_id": data.get("expert_id", "anonymous_expert"),
            "expert_name": data.get("expert_name", "Anonymous Expert"),
            "expert_profile": data.get("expert_profile", {}),
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