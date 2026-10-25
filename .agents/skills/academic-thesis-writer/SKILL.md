---
name: academic-thesis-writer
description: Guides the drafting, structuring, and academic composition of thesis chapters, research methodology (Chapter 3), system architecture, problem formulation, and research discussion. Enforces rigorous scholarly style and research question alignment.
---

# Academic Thesis & Research Writer Skill

คู่มือและกระบวนการทำงานสำหรับผู้ช่วยวิจัยในการยกร่าง ปรับปรุงโครงสร้าง และเรียบเรียงเนื้อหาเอกสารวิจัย วิทยานิพนธ์ และบทความวิชาการตามมาตรฐานสากล

---

## 1. วัตถุประสงค์และการเปิดใช้งาน (When to Use)
เปิดใช้งานสกิลนี้เมื่อ:
- ผู้ใช้ต้องการยกร่างหรือขยายความเนื้อหาของวิทยานิพนธ์ (เช่น บทที่ 1 บทนำ, บทที่ 3 วิธีดำเนินงานวิจัย, หรือบทที่ 5 สรุปและอภิปรายผล)
- ต้องการจัดหมวดหมู่คำถามวิจัย (Research Questions: RQ) ให้สอดคล้องกับการทดลองและตัวแปร
- ต้องการอธิบายสถาปัตยกรรมระบบ (System Architecture) อัลกอริทึม หรือโฟลว์การประมวลผลเชิงเทคนิคให้เป็นภาษาเขียนวิชาการ
- ต้องการตรวจสอบความรัดกุมเชิงระเบียบวิธีวิจัย (Methodological Rigor)

---

## 2. ขั้นตอนการยกร่างบทที่ 3 (Chapter 3: Research Methodology Workflow)

เมื่อต้องเขียนหรือทบทวนเนื้อหาบทที่ 3 ให้ปฏิบัติตามลำดับขั้น 9 หัวข้อย่อยมาตรฐานดังนี้:

### 3.1 ภาพรวมกระบวนการวิจัย (Research Design Overview)
- ประกาศระเบียบวิธีวิจัยแบบผสมผสาน (Dual-Track / Mixed-Methods): การพัฒนาระบบ (System Development) + การประเมินผลเชิงทดลอง (Experimental Evaluation)
- กำหนดตารางความสอดคล้องระหว่างคำถามวิจัย (RQ1–RQ6) กับชุดการทดลอง (Exp 1–Exp 6)
- เขียนผังขั้นตอนการดำเนินงานวิจัย (Research Workflow) ตั้งแต่การตั้งปัญหาจนถึงการสรุปผล
- กำหนดตัวแปรควบคุมร่วมและหน่วยการทดลอง (Experimental Unit)

### 3.2 สถาปัตยกรรมระบบ (System Architecture)
- แยกบรรยาย 3 องค์ประกอบหลัก:
  1. Frontend (React/TypeScript, UI interaction, Direct API call)
  2. Backend (Flask/Gunicorn, OpenCLIP ViT-B-32 feature extractor, automated logging)
  3. External APIs (OpenRouter, Geoapify, Foursquare, Wikimedia, Supabase)
- บรรยาย 2 โหมดของ Pipeline การรู้จำสถานที่อย่างชัดเจน:
  - Direct 1-Turn (Baseline โหมดทดสอบ)
  - Two-Turn + OpenCLIP Re-ranking (ระบบใช้งานจริง)
- บรรยายขั้นตอนวิธี Spatial Itinerary Optimization (Spatial Medoid Hub -> K-Means -> Greedy TSP -> LLM JSON Generator)
- ระบุรายชื่อโมเดล VLM ทั้ง 6 ตัวตาม OpenRouter ID ที่ใช้งานจริงในโค้ด

### 3.3 ชุดข้อมูลที่ใช้ในการทดสอบ (Evaluation Dataset)
- อธิบาย 4 ระดับความยาก (Iconic, Longtail, Nature, UGC/Social) และเหตุผลเชิงทฤษฎีในการแบ่ง
- อธิบายกระบวนการสร้างและตรวจสอบ Ground Truth ด้วย Multi-Alias Flexible Matcher (เกณฑ์ $\ge 0.72$)
- รายงานขนาดชุดข้อมูลโดยแยกตารางระหว่าง "จำนวนรันทั้งหมด (Total Runs)" กับ "จำนวนชื่อไฟล์ไม่ซ้ำ (Unique Files)"
- นิยาม Failure Modes 3 กลุ่ม (`visual_confusion`, `hallucination`, `degradation_rejection`)

### 3.4 การออกแบบการทดลอง (Experimental Design: Exp 1 - Exp 6)
- ในแต่ละการทดลอง ต้องระบุครบ 5 องค์ประกอบ:
  1. วัตถุประสงค์ (สอดคล้องกับ RQ ข้อใด)
  2. เหตุผลและความสำคัญในการออกแบบ
  3. วิธีการและเงื่อนไขการทดสอบ (โหมด, พรอมต์, อุณหภูมิ)
  4. ตัวแปรอิสระ ตัวแปรตาม และตัวแปรควบคุม
  5. ข้อสังเกตและข้อจำกัดของชุดข้อมูล

### 3.5 เมตริกการวัดผล (Evaluation Metrics)
- เมตริกความแม่นยำ: Top-1 Accuracy, Top-1 Strict, Top-3 Recall, Human Recovery Gain, Consistency Rate
- เมตริกประสิทธิภาพและต้นทุน: Client Time MS, Pure Generation Time MS, Tokens Per Sec, Cost USD
- เมตริกคุณภาพแผนเดินทาง: Rubric 5 มิติ (รวม 20 ข้อย่อย)

### 3.6 เครื่องมือและเทคโนโลยี (Tools & Technology)
- สรุปตารางเทคโนโลยีและไลบรารีที่ใช้ในงานวิจัย

### 3.7 กระบวนการรวบรวมและบันทึกข้อมูล (Data Collection Protocol)
- ขั้นตอนการส่งคำขอ การบันทึก CSV แบบ Transactional, ระบบแบ็กฟิลล์ OpenRouter stats, และ Automated Backup

### 3.8 กระบวนการประเมินคุณภาพแผนเดินทาง (Human Evaluation Protocol)
- อธิบายขั้นตอน Blind Evaluation, การติดฉลากภาพตามระดับความยาก (Easy, Medium, Hard, Social)

### 3.9 ข้อจำกัดของวิธีวิจัย (Limitations of the Method)
- เปิดเผยข้อจำกัดทางระเบียบวิธีวิจัยอย่างซื่อสัตย์ 10 ข้อ (เช่น ปัญหาชื่อไฟล์ซ้ำ, ข้อจำกัดของฮิวริสติกส์, การพึ่งพา API ภายนอก)

---

## 3. รายการตรวจสอบก่อนส่งมอบงานเขียน (Pre-flight Checklist)
ทุกครั้งที่ยกร่างเนื้อหาบทที่ 3 ให้ตรวจสอบตามเกณฑ์นี้:
- [ ] ไม่มีตัวเลขผลการทดลอง (เช่น % ความแม่นยำ, เวลาเฉลี่ย, คะแนนประเมิน) ปรากฏในบทที่ 3
- [ ] ชื่อโมเดลตรงกับ OpenRouter ID ในโค้ดจริง (ไม่มีการปนรุ่นเก่า เช่น GPT-4o หรือ Claude 3.5)
- [ ] ระบุว่า OpenCLIP ทำ Re-ranking เทียบกับรูปอ้างอิงภายนอก (ไม่ใช่ค้นใน Supabase Vector Store)
- [ ] Exp 3 ระบุชัดเจนว่าเป็นภาพถ่ายจริงในสภาวะ 5 กลุ่ม (ไม่ใช่ noise สังเคราะห์)
- [ ] พรอมต์มาตรฐานที่บันทึกใน CSV ของ Exp 1, 3, 5 ถูกระบุอย่างถูกต้องว่าเป็น P2 (Expert Persona)
- [ ] สูตรคณิตศาสตร์และตัวแปรเขียนในรูปแบบ $\LaTeX$ ถูกต้อง
