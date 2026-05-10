# 🧭 Vision Trip Planner – AI-Powered Place Recognition for Travel Planning

ระบบวางแผนการท่องเที่ยวที่ใช้ **Generative AI + Computer Vision**
ในการระบุสถานที่จากภาพ (Place Recognition) และแนะนำแผนการเดินทางอัตโนมัติ

---

## 📌 ภาพรวมระบบ (Overview)

Vision Trip Planner เป็น Web Application ที่สามารถ:

1. รับภาพจากผู้ใช้
2. วิเคราะห์ภาพด้วย AI เพื่อระบุ “สถานที่”
3. สร้างแผนการท่องเที่ยว (Itinerary) อัตโนมัติ

> 🎯 เป้าหมาย: เปลี่ยน “รูปภาพ” ให้กลายเป็น “แผนเที่ยว”

---

## 🧠 แนวคิดหลัก (Core Concept)

ระบบทำงานโดยใช้โมเดล AI เพื่อ:

* แปลงภาพ → เป็น vector (Image Embedding)
* เปรียบเทียบกับฐานข้อมูลสถานที่ (Place Matching)
* ใช้ Generative AI สร้างแผนเที่ยว

---

## ⚙️ Workflow การทำงาน

```text
[User Image]
      ↓
Image Encoder (CLIP / Vision Model)
      ↓
Image Embedding
      ↓
Place Recognition (Similarity Matching)
      ↓
Generative AI (สร้างแผนเที่ยว)
      ↓
[Travel Itinerary]
```

---

## ✨ ฟีเจอร์หลัก (Key Features)

* 🖼️ วิเคราะห์ภาพเพื่อระบุสถานที่ (Place Recognition)
* 🤖 ใช้ Generative AI สร้างแผนการท่องเที่ยว
* 📍 แนะนำสถานที่ใกล้เคียง
* 🗺️ สร้าง Itinerary อัตโนมัติ
* 🔎 รองรับการค้นหาจากภาพ (Image-based Search)

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

### AI / Machine Learning

* CLIP (Image Embedding)
* Generative AI (LLM)

### Backend

* Node.js / Python (ขึ้นอยู่กับ implementation)
* REST API

### Frontend

* HTML / CSS / JavaScript (หรือ React)

### Data

* Dataset สถานที่ท่องเที่ยว
* Image Embedding Database

---

## 📁 โครงสร้างโปรเจค (ตัวอย่าง)

```bash
vision-trip-planner/
│
├── frontend/        # UI สำหรับผู้ใช้งาน
├── backend/         # API และ logic
├── ai-model/        # โมเดล AI / embedding
├── dataset/         # ข้อมูลสถานที่
└── README.md
```

---

## ▶️ การใช้งาน (How It Works)

1. อัปโหลดภาพสถานที่
2. ระบบวิเคราะห์ภาพด้วย AI
3. แสดงชื่อสถานที่ที่คาดว่าเป็น
4. สร้างแผนการท่องเที่ยวให้ทันที

---

## 🚀 ตัวอย่าง Use Case

* ถ่ายรูปสถานที่ → ระบบบอกว่าเป็น “เชียงใหม่”
* ระบบแนะนำ:

  * สถานที่เที่ยวใกล้เคียง
  * ร้านอาหาร
  * แผนเที่ยว 1 วัน / 3 วัน

---

## 🎯 จุดเด่นของโปรเจค (Highlights)

* ใช้ **Computer Vision + Generative AI** ร่วมกัน
* ไม่ต้องพิมพ์ค้นหา → ใช้ “รูปภาพ” แทน
* สามารถต่อยอดเป็น:

  * Travel App
  * Smart Tourism System
  * AI Guide

---

## 🔐 ความท้าทาย (Challenges)

* ความแม่นยำของ Place Recognition
* คุณภาพของ Dataset
* การออกแบบ Prompt สำหรับ Generative AI
* Performance ของการค้นหา embedding

---

## 🚀 แนวทางพัฒนาเพิ่มเติม (Future Improvements)

* 📱 รองรับ Mobile App
* 🌍 เชื่อม Google Maps API
* 🧭 เพิ่ม Route Optimization
* 🗣️ รองรับ Voice Input
* 📊 Personalization (แผนเที่ยวตามผู้ใช้)

---

## 👨‍💻 ผู้พัฒนา

โปรเจคนี้พัฒนาขึ้นเพื่อศึกษาและประยุกต์ใช้
**Generative AI + Computer Vision ในด้านการท่องเที่ยว**

---
