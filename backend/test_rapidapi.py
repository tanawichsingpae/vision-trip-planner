import requests
import time

headers = {
    "x-rapidapi-key": "3d298e178bmsh0409592990a10ebp11dae1jsne9ef7a601681",
    "x-rapidapi-host": "google-flights2.p.rapidapi.com"
}

url_grid = "https://google-flights2.p.rapidapi.com/api/v1/getCalendarGrid"
params_grid = {
    "departure_id": "BKK",
    "arrival_id": "NRT",
    "outbound_date": "2026-09-15",
    "travel_class": "ECONOMY",
    "adults": "1",
    "currency": "THB",
    "country_code": "TH"
}

print("Running 3 test requests to getCalendarGrid...")
for i in range(3):
    try:
        t0 = time.time()
        r = requests.get(url_grid, headers=headers, params=params_grid, timeout=20)
        t1 = time.time()
        data = r.json()
        print(f"Req {i+1}: status={data.get('status')} msg={data.get('message')} time={t1-t0:.2f}s")
    except Exception as e:
        print(f"Req {i+1} failed: {e}")
    time.sleep(1)
