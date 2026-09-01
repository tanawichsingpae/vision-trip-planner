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


import html
import re
import urllib.parse

def search_web_duckduckgo(query: str, max_results: int = 4):
    """
    Fetches real-time web search results from DuckDuckGo Instant API & Wikipedia Search API.
    Zero extra dependencies required. Zero disk space needed.
    """
    if not query or len(query.strip()) < 3:
        return []

    results = []

    # 1. Query DuckDuckGo Instant API
    try:
        ddg_url = "https://api.duckduckgo.com/"
        ddg_params = {"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"}
        resp = requests.get(ddg_url, params=ddg_params, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("Abstract")
            abstract_url = data.get("AbstractURL")
            if abstract:
                results.append({
                    "title": data.get("Heading") or query,
                    "snippet": abstract,
                    "url": abstract_url or "https://duckduckgo.com"
                })
            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                    results.append({
                        "title": topic.get("Text", "")[:40],
                        "snippet": topic.get("Text", ""),
                        "url": topic.get("FirstURL", "")
                    })
    except Exception as e:
        print("[Search DDG Error]", e)

    # 2. Query Wikipedia API (Thai & English)
    try:
        wiki_url = "https://th.wikipedia.org/w/api.php"
        wiki_headers = {"User-Agent": "PixineraryBot/1.0 (https://pixinerary.com; dev@pixinerary.com)"}
        wiki_params = {"action": "query", "list": "search", "srsearch": query, "format": "json", "utf8": "1"}
        wresp = requests.get(wiki_url, headers=wiki_headers, params=wiki_params, timeout=6)
        if wresp.status_code == 200:
            wdata = wresp.json()
            witems = wdata.get("query", {}).get("search", [])
            for item in witems[:3]:
                title = item.get("title", "")
                snippet = re.sub(r'<[^>]+>', '', item.get("snippet", "")).strip()
                if title and snippet:
                    results.append({
                        "title": title,
                        "snippet": snippet,
                        "url": f"https://th.wikipedia.org/wiki/{urllib.parse.quote(title)}"
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
                        "IMPORTANT TONE & FORMATTING RULES:\n"
                        "- Always address the user as 'คุณ' (NEVER use 'คุณลูกค้า').\n"
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

        return jsonify({"offers": results})

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

@app.route("/flight/trends", methods=["POST"])
def flight_trends():
    """
    Returns a 30-day price calendar for cheapest fares on each day.
    Uses Google Flights getCalendarGrid endpoint via RapidAPI.
    Body: { "origin": "BKK", "destination": "NRT", "date": "2026-09-01", "currency": "THB" }
    """
    if not RAPIDAPI_KEY:
        return jsonify({"error": "RapidAPI key not configured"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    origin = data.get("origin", "").strip().upper()
    destination = data.get("destination", "").strip().upper()
    departure_date = data.get("date", "")
    currency = data.get("currency", "THB")

    if not origin or not destination:
        return jsonify({"error": "origin and destination are required"}), 400

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
            timeout=20,
        )
        resp.raise_for_status()
        raw = resp.json()

        # Fallback: if the request fails (e.g. date is considered past/invalid), retry without outbound_date
        if not raw.get("status") and "outbound_date" in params:
            print(f"[Trends] Request with outbound_date={departure_date} returned status=False. Retrying without date...")
            params.pop("outbound_date")
            try:
                resp = requests.get(
                    "https://google-flights2.p.rapidapi.com/api/v1/getCalendarGrid",
                    headers=rapidapi_headers,
                    params=params,
                    timeout=20,
                )
                resp.raise_for_status()
                raw = resp.json()
            except Exception as e:
                print(f"[Trends] Fallback request failed: {e}")

        # Graceful degradation: if still status=False, return empty trends instead of 502
        if not raw.get("status"):
            print(f"[Trends] Google Flights API returned status=False: {raw.get('message')}. Returning empty trends.")
            return jsonify({"trends": [], "currency": currency})

        # data is a list of { departure, return, price }
        calendar = raw.get("data", [])
        trends = [
            {"date": item["departure"], "price": item["price"]}
            for item in calendar
            if item.get("departure") and item.get("price") is not None
        ]

        return jsonify({"trends": trends, "currency": currency})

    except Exception as e:
        print("[Trends] Graceful recovery from flight_trends error:", e)
        return jsonify({"trends": [], "currency": currency})





# --------------------
# Save/Read Experiment Results
# --------------------

@app.route("/experiment/save", methods=["POST"])
def save_experiment():
    """
    Appends experiment trial data to a local CSV file.
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
                # Write header
                writer.writerow(["Timestamp", "Image Name", "Ground Truth", "Model", "Predicted Place", "Confidence", "Time MS", "Is Correct"])
            
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for res in results:
                writer.writerow([
                    timestamp,
                    image_name,
                    ground_truth,
                    res.get("model"),
                    res.get("predicted"),
                    res.get("confidence"),
                    res.get("time_ms"),
                    res.get("is_correct")
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
                results.append({
                    "timestamp": row.get("Timestamp"),
                    "image_name": row.get("Image Name"),
                    "ground_truth": row.get("Ground Truth"),
                    "model": row.get("Model"),
                    "predicted": row.get("Predicted Place"),
                    "confidence": float(row.get("Confidence") or 0.0),
                    "time_ms": int(row.get("Time MS") or 0),
                    "is_correct": row.get("Is Correct") == "True" or row.get("Is Correct") == "true" or row.get("Is Correct") == "1"
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