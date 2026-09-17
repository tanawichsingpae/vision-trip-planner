web: python -c "import os; os.chdir('backend') if os.path.isdir('backend') else None" && gunicorn clip_server:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120
