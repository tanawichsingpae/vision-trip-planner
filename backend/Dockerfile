FROM python:3.10-slim

# สร้าง user ที่ไม่ใช่ root (Hugging Face แนะนำเพื่อความปลอดภัย)
RUN useradd -m -u 1000 user

# ตั้งค่า Environment Variables ที่จำเป็น
ENV PATH="/home/user/.local/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# กำหนดโฟลเดอร์ทำงาน
WORKDIR /app

# (Optional) ลง dependencies พื้นฐานของระบบเผื่อไว้สำหรับ PyTorch/PIL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ก็อปปี้ไฟล์ requirements และติดตั้ง package
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ก็อปปี้โค้ดทั้งหมดในโฟลเดอร์ backend ไปไว้ใน Docker
COPY --chown=user:user . .

# สลับไปใช้ user ที่ไม่ใช่ root
USER user

# รัน Gunicorn บนพอร์ต 7860 (พอร์ตมาตรฐานที่ Hugging Face Spaces ใช้งาน)
CMD ["gunicorn", "clip_server:app", "--bind", "0.0.0.0:7860", "--workers", "1", "--threads", "2", "--timeout", "120"]
