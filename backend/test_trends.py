import requests

url = "http://127.0.0.1:8080/flight/trends"

print("Testing BKK to NRT, date 2026-09-15 via new getCalendarGrid backend:")
r = requests.post(url, json={"origin": "BKK", "destination": "NRT", "date": "2026-09-15"})
print("Status:", r.status_code)
if r.status_code == 200:
    data = r.json()
    trends = data.get("trends", [])
    print(f"Success! Got {len(trends)} days of prices.")
    if trends:
        print(f"  First: {trends[0]}")
        print(f"  Last: {trends[-1]}")
else:
    print("Error:", r.text)
