import threading
import time
import requests
from clip_server import app

def run_server():
    app.run(host="127.0.0.1", port=8081, debug=False, threaded=True)

# Start server in thread
t = threading.Thread(target=run_server, daemon=True)
t.start()

# Give server time to load model and start
time.sleep(10)

url = "http://127.0.0.1:8081/flight/trends"

test_cases = [
    {"origin": "BKK", "destination": "NRT", "date": "2026-08-28"},  # Failed previously with 502, should now fallback or degrade to trends=[] (200 OK)
    {"origin": "BKK", "destination": "NRT", "date": "2026-08-29"},  # Success (200 OK)
    {"origin": "BKK", "destination": "NRT", "date": "2026-09-01"},  # Success (200 OK)
]

for idx, case in enumerate(test_cases):
    print(f"Test case {idx+1}: {case}")
    try:
        r = requests.post(url, json=case, timeout=15)
        print("  Status:", r.status_code)
        data = r.json()
        print("  Trends length:", len(data.get("trends", [])))
        if len(data.get("trends", [])) > 0:
            print("  First trend:", data["trends"][0])
    except Exception as e:
        print("  Exception:", e)
