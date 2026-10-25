---
name: citation-manager
description: Standards and guidelines for academic referencing, citation styles (APA 7th, IEEE), BibTeX entry generation, and in-text citation placement for computer science and AI travel planning research.
---

# Academic Citation & Reference Manager Skill

คู่มือและข้อกำหนดมาตรฐานสำหรับการจัดการรายการอ้างอิง บรรณานุกรม และรูปแบบการอ้างอิงในเนื้อหา (In-text Citation) สำหรับงานวิจัยด้านวิทยาการคอมพิวเตอร์และปัญญาประดิษฐ์

---

## 1. วัตถุประสงค์และการเปิดใช้งาน (When to Use)
เปิดใช้งานสกิลนี้เมื่อ:
- ต้องการแทรกการอ้างอิงในเนื้อหา (In-text citations) ให้ถูกต้องตามหลักวิชาการ
- ต้องการสร้างหรือตรวจสอบรายการบรรณานุกรม (References List / Bibliography)
- ต้องการแปลงรายการอ้างอิงเป็นรูปแบบ $\text{Bib\TeX}$ สำหรับ $\LaTeX$ หรือรูปแบบข้อความสำหรับ Microsoft Word
- ต้องการอ้างอิงโมเดล AI ชุดข้อมูล ซอฟต์แวร์โอเพนซอร์ส หรือเอกสารรายงานทางเทคนิค

---

## 2. รูปแบบการอ้างอิงมาตรฐานที่รองรับ (Supported Citation Styles)

### 2.1 APA 7th Edition (Author-Date) — นิยมใช้ในวิทยานิพนธ์ระดับบัณฑิตศึกษา
* **การอ้างอิงในเนื้อหา (Parenthetical):**
  - ผู้แต่ง 1 คน: `(Radford, 2021)`
  - ผู้แต่ง 2 คน: `(Reynolds & McDonell, 2021)`
  - ผู้แต่ง 3 คนขึ้นไป: `(Brown et al., 2020)`
* **การอ้างอิงเชิงบรรยาย (Narrative):**
  - "Brown et al. (2020) ได้นำเสนอแนวคิด Zero-Shot Learning..."
  - "ตามการศึกษาของ Wei et al. (2022) เกี่ยวกับ Chain-of-Thought..."

### 2.2 IEEE Style (Numeric) — นิยมใช้ในการประชุมวิชาการและวารสารทางคอมพิวเตอร์
* ใช้หมายเลขลำดับในวงเล็บก้ามปู เช่น:
  - "...การเรียนรู้ภาพและภาษาแบบคอนทราสทีฟ [1] มีบทบาทสำคัญในการ..."
  - "วิธีการดังกล่าวได้รับการเสนอโดย Wei และคณะ [2]..."

---

## 3. รายการอ้างอิงหลักที่เกี่ยวข้องโดยตรงกับโปรเจค Pixinerary (Core References)

สำหรับใช้งานในบทที่ 1, 2, และ 3 เพื่ออ้างอิงทฤษฎีและงานพื้นฐาน:

1. **Foundational Prompt Paradigms (P1–P5):**
   - **P1 & P5 (Zero-shot & Few-shot):**
     > Brown, T., Mann, B., Ryder, N., Subbiah, M., Kaplan, J. D., Dhariwal, P., ... & Amodei, D. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems*, 33, 1877–1901.
   - **P2 (Expert Persona / Role-prompting):**
     > Reynolds, L., & McDonell, K. (2021). Prompt programming for large language models: Beyond the few-shot paradigm. *Extended Abstracts of the 2021 CHI Conference on Human Factors in Computing Systems*, 1–7.
   - **P3 (Chain-of-Thought Reasoning):**
     > Wei, J., Wang, X., Schuurmans, D., Bosma, M., Xia, F., Chi, E., Le, Q. V., & Zhou, D. (2022). Chain-of-thought prompting elicits reasoning in large language models. *Advances in Neural Information Processing Systems*, 35, 24824–24837.
   - **P4 (Cross-Lingual Evaluation):**
     > Shi, F., Suzgun, M., Freitag, M., Wang, X., Srivats, S., Vosoughi, S., Chung, H. W., Tay, Y., Ruder, S., Zhou, D., Das, D., & Wei, J. (2022). Language models are multilingual chain-of-thought reasoners. *arXiv preprint arXiv:2210.03057*.

2. **Visual Embedding & OpenCLIP:**
   - **CLIP Architecture:**
     > Radford, A., Kim, J. W., Hallacy, C., Ramesh, A., Goh, G., Agarwal, S., ... & Sutskever, I. (2021). Learning transferable visual models from natural language supervision. *International Conference on Machine Learning (ICML)*, 8748–8763.
   - **OpenCLIP Implementation:**
     > Ilharco, G., Wortsman, M., Wightman, R., Gordon, C., Carlini, N., Taori, R., ... & Schmidt, L. (2021). OpenCLIP: Open-source implementation of CLIP. *Zenodo*. https://doi.org/10.5281/zenodo.5143773

---

## 4. มาตรฐานการอ้างอิงโมเดลปัญญาประดิษฐ์เชิงพาณิชย์และเกตเวย์ API
เมื่อต้องอ้างอิงโมเดลที่เรียกผ่าน OpenRouter ในบทที่ 3 ให้ระบุทั้งชื่อทางการของผู้พัฒนา รุ่น และแหล่งที่มา เช่น:
* Anthropic. (2024). *Claude Sonnet 5* [Large language model]. OpenRouter API.
* OpenAI. (2024). *GPT-5.4 & GPT-5.4 Mini* [Large multimodal model]. OpenRouter API.
* Google. (2024). *Gemini 3.8 Flash* [Multimodal model]. OpenRouter API.
* Meta. (2024). *Llama 4 Maverick* [Open-weights multimodal model]. OpenRouter API.
* Alibaba Cloud. (2024). *Qwen 2.5 VL 72B Instruct* [Vision-language model]. OpenRouter API.
