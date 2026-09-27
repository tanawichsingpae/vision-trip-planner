import os

# Railway & Production Gunicorn Configuration
port = os.environ.get("PORT", "8080")
bind = f"0.0.0.0:{port}"

workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = 4
timeout = 120
keepalive = 5

accesslog = "-"
errorlog = "-"
capture_output = True
enable_stdio_inheritance = True
