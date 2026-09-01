import requests

payload = {
    "model": "gpt-4o",
    "messages": [
        {"role": "user", "content": [
            {"type": "text", "text": "Analyze this image and return JSON: { \"places\": [\"a\"] }"},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="}}
        ]}
    ]
}

print("Testing OpenAI...")
res = requests.post("http://127.0.0.1:8080/openai", json=payload)
print(res.status_code)
print(res.text)
