import requests

url = "http://127.0.0.1:8080/flight/trends"

# Let's test different combinations of origins and dates
test_cases = [
    {"origin": "BKK", "destination": "NRT", "date": "2026-08-28"},
    {"origin": "BKK", "destination": "NRT", "date": "2026-08-29"},
    {"origin": "BKK", "destination": "NRT", "date": "2026-08-30"},
    {"origin": "BKK", "destination": "NRT", "date": "2026-09-01"},
    {"origin": "bkk", "destination": "nrt", "date": "2026-08-29"},
]

for idx, case in enumerate(test_cases):
    print(f"Test case {idx+1}: {case}")
    try:
        r = requests.post(url, json=case, timeout=15)
        print("  Status:", r.status_code)
        if r.status_code == 200:
            print("  Trends length:", len(r.json().get("trends", [])))
        else:
            print("  Response:", r.text)
    except Exception as e:
        print("  Exception:", e)
