"""
Migrate local JSON files in experiment/ to Supabase database.
"""
import os
import json
import requests

# Load env variables from frontend/.env.local if present
EXPERIMENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "experiment"))
FRONTEND_ENV = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env.local"))

supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    if os.path.exists(FRONTEND_ENV):
        with open(FRONTEND_ENV, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("VITE_SUPABASE_URL="):
                    supabase_url = line.split("=", 1)[1].strip()
                elif line.startswith("VITE_SUPABASE_ANON_KEY="):
                    supabase_key = line.split("=", 1)[1].strip()

if not supabase_url or not supabase_key:
    print("[Error] SUPABASE_URL or SUPABASE_KEY not found in environment or frontend/.env.local")
    exit(1)

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def load_json(filename):
    path = os.path.join(EXPERIMENT_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def migrate_table(table_name, items, transform_fn=None):
    if not items:
        print(f"[-] No data to migrate for {table_name}")
        return
    
    url = f"{supabase_url.rstrip('/')}/rest/v1/{table_name}"
    payload = [transform_fn(x) if transform_fn else x for x in items]
    
    print(f"[*] Migrating {len(payload)} items to '{table_name}'...")
    res = requests.post(url, headers=headers, json=payload)
    if res.status_code in [200, 201]:
        print(f"[+] Successfully migrated {len(payload)} items to '{table_name}'!")
    else:
        print(f"[!] Failed migrating to '{table_name}'. Status: {res.status_code}, Response: {res.text}")

def transform_trip(t):
    return {
        "id": t.get("id"),
        "scenario_id": t.get("scenario_id"),
        "scenario_title": t.get("scenario_title") or t.get("scenario_id"),
        "scenario_notes": t.get("scenario_notes", ""),
        "actual_model": t.get("actual_model", "unknown"),
        "preferences": t.get("preferences", {}),
        "itinerary": t.get("itinerary", []),
        "typical_weather": t.get("typicalWeather"),
        "suggestions": t.get("suggestions", []),
        "accommodations": t.get("accommodations", []),
        "uploaded_locations": t.get("uploaded_locations", []),
    }

def transform_eval(e):
    return {
        "id": e.get("id"),
        "scenario_id": e.get("scenario_id"),
        "trip_id": e.get("trip_id"),
        "blind_label": e.get("blind_label"),
        "actual_model": e.get("actual_model"),
        "expert_id": e.get("expert_id"),
        "expert_name": e.get("expert_name"),
        "expert_profile": e.get("expert_profile", {}),
        "scores": e.get("scores", {}),
        "detailed_scores": e.get("detailed_scores", {}),
        "overall_pick": bool(e.get("overall_pick", False)),
        "feedback": e.get("feedback", ""),
    }

def transform_comp(c):
    return {
        "id": c.get("id"),
        "scenario_id": c.get("scenario_id"),
        "expert_id": c.get("expert_id"),
        "expert_name": c.get("expert_name"),
        "expert_profile": c.get("expert_profile", {}),
        "rankings": c.get("rankings", []),
        "best_for_practical_use": c.get("best_for_practical_use", {}),
        "qualitative_feedback": c.get("qualitative_feedback", {}),
    }

if __name__ == "__main__":
    print(f"Target Supabase URL: {supabase_url}")
    
    trips = load_json("blind_trips.json")
    migrate_table("blind_trips", trips, transform_trip)

    evals = load_json("blind_evaluations.json")
    migrate_table("blind_evaluations", evals, transform_eval)

    comps = load_json("blind_comparisons.json")
    migrate_table("blind_comparisons", comps, transform_comp)

    print("[*] Migration completed.")
