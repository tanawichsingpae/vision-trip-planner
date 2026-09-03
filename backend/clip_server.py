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

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AVIATIONSTACK_API_KEY = os.getenv("AVIATIONSTACK_API_KEY")
DUFFEL_API_KEY = os.getenv("DUFFEL_API_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

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
CORS(app, resources={r"/*": {"origins": "*"}})



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
    "gemini-1.5-pro": "google/gemini-2.5-pro",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4o": "openai/gpt-4o",
}

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

        print(f"[AI] Calling OpenRouter model: {model_name} (expect_json={expect_json})")

        formatted_messages = list(messages)

        # ── Web Search RAG Integration for Conversational Requests (expect_json=False) ──
        if not expect_json and formatted_messages:
            last_msg = formatted_messages[-1]
            user_text = ""
            if isinstance(last_msg.get("content"), list):
                for item in last_msg["content"]:
                    if item.get("type") == "text":
                        user_text += item.get("text", "")
            else:
                user_text = str(last_msg.get("content", ""))

            if user_text and len(user_text.strip()) > 3:
                print(f"[Search RAG] Searching web for user query: '{user_text[:60]}...'")
                search_results = search_web_duckduckgo(user_text, max_results=4)
                if search_results:
                    context_blocks = []
                    for idx, res in enumerate(search_results):
                        context_blocks.append(f"[{idx+1}] Source: {res['url']}\nTitle: {res['title']}\nSnippet: {res['snippet']}")

                    search_context = (
                        "=== Real-Time Web Search Context (Internet Results) ===\n"
                        "Use the up-to-date web search results below to inform your response if relevant. "
                        "Cite or refer to current details when answering questions about live events, weather, news, or places.\n"
                        "IMPORTANT PERSONA & FORMATTING RULES:\n"
                        "- You are 'พิกซ์ (Pix) - Your AI Travel Companion' — a polite, warm, smart, friendly Korean-inspired travel buddy.\n"
                        "- Always speak with polite Thai ending particles (ครับ), refer to yourself as 'ผม' or 'พิกซ์', and STRICTLY address the user ONLY as 'คุณ' (NEVER use 'คุณลูกค้า', 'ท่าน', 'เธอ', 'นาย', 'พี่', 'น้อง', 'เพื่อน', 'ยู' or any other pronoun; ALWAYS address the user ONLY as 'คุณ').\n"
                        "- Explain reasons clearly and concisely. Do NOT dump huge unrequested lists.\n"
                        "- NEVER use markdown asterisks '*' or '**' for bold or bullet points in your response. Write clean, natural prose using line breaks and tasteful emojis instead.\n\n"
                        + "\n\n".join(context_blocks) + "\n"
                        "======================================================="
                    )

                    formatted_messages.insert(len(formatted_messages) - 1, {
                        "role": "system",
                        "content": search_context
                    })
                    print(f"[Search RAG] Successfully injected {len(search_results)} search results into prompt!")

        if expect_json:
            # Ensure JSON output is requested
            formatted_messages.insert(0, {
                "role": "system",
                "content": "You are a helpful AI assistant. You must respond ONLY with valid JSON matching the requested schema. Do not output any markdown headers, conversational text, or formatting outside of JSON."
            })

        response = openrouter_client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
        )

        content = response.choices[0].message.content
        if content is None:
            message_obj = response.choices[0].message
            refusal = getattr(message_obj, "refusal", None)
            if refusal:
                print(f"[AI] Refusal from {model_name}: {refusal}")
                return jsonify({"error": f"AI model refused: {refusal}"}), 500
            return jsonify({"error": f"AI model {model_name} returned empty content"}), 500

        # Clean markdown code fences if present
        cleaned_content = content.strip()
        if cleaned_content.startswith("```"):
            lines = cleaned_content.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_content = "\n".join(lines).strip()

        if expect_json and not cleaned_content.startswith(("{", "[")):
            print(f"[AI] Refusal/non-JSON response from {model_name}: {cleaned_content[:200]}")
            return jsonify({"error": f"AI model declined to output valid JSON: {cleaned_content[:200]}"}), 400

        return jsonify({"text": cleaned_content})

    except Exception as e:
        print("AI Error:", e)
        return jsonify({"error": str(e)}), 500




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