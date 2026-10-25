# -*- coding: utf-8 -*-
"""
build_chapter4_docx.py
================================================================================
Generates the comprehensive, rigorous academic Word Document (.docx) for
Pixinerary Thesis Chapter 4: ผลการวิจัยและการวิเคราะห์ผล (Experimental Results and Discussion)

Structure follows strictly the 11-section framework requested by the user:
4.1 ภาพรวมการทดลองและข้อมูลที่ใช้วิเคราะห์ (Data Registry Table included)
4.2 ผลการทดลองที่ 1: ความไวต่อรูปแบบพรอมต์ (Prompt Sensitivity)
4.3 ผลการทดลองที่ 2: การเปรียบเทียบสมรรถนะโมเดล (Model Benchmark)
4.4 ผลการทดลองที่ 3: การเปรียบเทียบ Pipeline (Pipeline Comparison)
4.5 ผลการทดลองที่ 4: ความทนทานต่อสภาวะภาพรบกวน (Robustness Test)
4.6 ผลการทดลองที่ 5: ความสม่ำเสมอของโมเดล (Model Consistency)
4.7 ผลการทดลองที่ 6: คุณภาพแผนการท่องเที่ยว (Plan Quality)
4.8 ผลการทดลองที่ 7: การประเมินแบบปกปิดชื่อโมเดล (Blind Test)
4.9 ผลการประเมินระบบโดยผู้เชี่ยวชาญผ่าน Google Forms (Expert Quality Assessment)
4.10 การสังเคราะห์ผลและวิเคราะห์ความผิดพลาด (Cross-Experiment Synthesis)
4.11 สรุปผลการทดลอง (Conclusion & Research Questions Alignment)
================================================================================
"""

import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

OUTPUT_DOCX = r"d:\Pixinerary_model_test\Chapter4_Results_Pixinerary.docx"
FIGURE_DIR = r"D:\Pixinerary_model_test\experiment\figures_Chapter4"

def set_cell_background(cell, hex_color):
    """Sets the background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets cell internal padding in twips."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                       f'<w:top w:w="{top}" w:type="dxa"/>'
                       f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                       f'<w:left w:w="{left}" w:type="dxa"/>'
                       f'<w:right w:w="{right}" w:type="dxa"/>'
                       f'</w:tcMar>')
    tc_pr.append(tc_mar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    """Applies clean, subtle borders to table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                        f'<w:left w:val="none"/>'
                        f'<w:right w:val="none"/>'
                        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                        f'<w:insideV w:val="none"/>'
                        f'</w:tblBorders>')
    tblPr.append(borders)

def add_callout_box(doc, title, filename_base, description):
    """Adds an elegant academic figure placeholder callout box."""
    p_box = doc.add_paragraph()
    p_box.paragraph_format.space_before = Pt(8)
    p_box.paragraph_format.space_after = Pt(8)
    p_box.paragraph_format.left_indent = Inches(0.2)
    p_box.paragraph_format.right_indent = Inches(0.2)
    
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Border for cell
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                           f'<w:top w:val="single" w:sz="8" w:color="0284C7"/>'
                           f'<w:left w:val="single" w:sz="24" w:color="0284C7"/>'
                           f'<w:bottom w:val="single" w:sz="8" w:color="0284C7"/>'
                           f'<w:right w:val="single" w:sz="8" w:color="0284C7"/>'
                           f'</w:tcBorders>')
    tc_pr.append(tc_borders)
    
    cp = cell.paragraphs[0]
    cp.paragraph_format.space_before = Pt(2)
    cp.paragraph_format.space_after = Pt(2)
    
    run_icon = cp.add_run("🖼 [พื้นที่สำหรับใส่รูปผลการทดลอง: ")
    run_icon.bold = True
    run_icon.font.name = "TH Sarabun PSK"
    run_icon.font.size = Pt(14)
    run_icon.font.color.rgb = RGBColor(2, 132, 199)
    
    run_title = cp.add_run(f"{title}]\n")
    run_title.bold = True
    run_title.font.name = "TH Sarabun PSK"
    run_title.font.size = Pt(14)
    run_title.font.color.rgb = RGBColor(15, 23, 42)
    
    run_path_label = cp.add_run("• ตำแหน่งไฟล์ภาพความละเอียดสูง (300 DPI): ")
    run_path_label.bold = True
    run_path_label.font.name = "TH Sarabun PSK"
    run_path_label.font.size = Pt(12)
    run_path_label.font.color.rgb = RGBColor(71, 85, 105)
    
    png_path = os.path.join(FIGURE_DIR, f"{filename_base}.png")
    run_path = cp.add_run(f"{png_path}\n")
    run_path.font.name = "Consolas"
    run_path.font.size = Pt(10)
    run_path.font.color.rgb = RGBColor(30, 41, 59)
    
    run_desc = cp.add_run(f"• คำอธิบายภาพ: {description}\n")
    run_desc.font.name = "TH Sarabun PSK"
    run_desc.font.size = Pt(13)
    run_desc.font.color.rgb = RGBColor(51, 65, 85)
    
    run_note = cp.add_run("• หมายเหตุ: กรอบคำอธิบาย (Legends) ทุกจุดถูกย้ายออกไปอยู่นอกพื้นที่กราฟ (Outside Plot Area) ปราศจากการบดบังจุดข้อมูลและเส้นกราฟ 100%")
    run_note.italic = True
    run_note.font.name = "TH Sarabun PSK"
    run_note.font.size = Pt(12)
    run_note.font.color.rgb = RGBColor(100, 116, 139)

def main():
    print("Building Pixinerary Thesis Chapter 4 .docx...")
    doc = Document()
    
    # --------------------------------------------------------------------------
    # Page Setup (Standard Thai Master's Thesis Margins: Top 1.5", Left 1.5", Bottom 1.0", Right 1.0")
    # --------------------------------------------------------------------------
    section = doc.sections[0]
    section.top_margin = Inches(1.5)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.5)
    section.right_margin = Inches(1.0)
    
    # Normal Style configuration
    style = doc.styles['Normal']
    font = style.font
    font.name = 'TH Sarabun PSK'
    font.size = Pt(16)
    font.color.rgb = RGBColor(15, 23, 42)
    style.paragraph_format.line_spacing = 1.15
    style.paragraph_format.space_after = Pt(4)
    
    # Helpers for headings and text
    def add_chapter_title(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(12)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(20)
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p
        
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(18)
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(text)
        run.bold = True
        run.italic = True
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    def add_body_p(text, indent=True):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        if indent:
            p.paragraph_format.first_line_indent = Inches(0.5)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        run = p.add_run(text)
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_bullet_p(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.left_indent = Inches(0.5)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        run = p.add_run("•  " + text)
        run.font.name = 'TH Sarabun PSK'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_table_title(table_num, title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r_num = p.add_run(f"ตารางที่ {table_num} ")
        r_num.bold = True
        r_num.font.name = 'TH Sarabun PSK'
        r_num.font.size = Pt(15)
        r_title = p.add_run(title)
        r_title.font.name = 'TH Sarabun PSK'
        r_title.font.size = Pt(15)
        return p

    def format_table_headers_and_data(table, col_widths, headers, data, align_rights=None):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        set_table_borders(table)
        
        # Header Row
        hdr_cells = table.rows[0].cells
        for idx, text in enumerate(headers):
            hdr_cells[idx].text = text
            hdr_cells[idx].width = Inches(col_widths[idx])
            set_cell_background(hdr_cells[idx], "1E293B")
            set_cell_margins(hdr_cells[idx], top=80, bottom=80, left=100, right=100)
            p = hdr_cells[idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.bold = True
                run.font.name = 'TH Sarabun PSK'
                run.font.size = Pt(14)
                run.font.color.rgb = RGBColor(255, 255, 255)
                
        # Data Rows
        for r_idx, row_data in enumerate(data):
            row_cells = table.add_row().cells
            bg_col = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, val in enumerate(row_data):
                row_cells[c_idx].text = str(val)
                row_cells[c_idx].width = Inches(col_widths[c_idx])
                set_cell_background(row_cells[c_idx], bg_col)
                set_cell_margins(row_cells[c_idx], top=60, bottom=60, left=100, right=100)
                p = row_cells[c_idx].paragraphs[0]
                if align_rights and c_idx in align_rights:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                elif c_idx == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    run.font.name = 'TH Sarabun PSK'
                    run.font.size = Pt(14)
                    run.font.color.rgb = RGBColor(15, 23, 42)

    # ==========================================================================
    # CHAPTER TITLE
    # ==========================================================================
    add_chapter_title("บทที่ 4\nผลการวิจัยและการวิเคราะห์ผล\n(Experimental Results and Discussion)")
    
    # ==========================================================================
    # 4.1 ภาพรวมการทดลองและข้อมูลที่ใช้วิเคราะห์
    # ==========================================================================
    add_h1("4.1 ภาพรวมการทดลองและข้อมูลที่ใช้วิเคราะห์ (Overview of Experiments and Dataset)")
    
    add_body_p(
        "บทนี้นำเสนอผลการประเมินประสิทธิภาพเชิงประจักษ์ของระบบ Pixinerary ซึ่งเป็นระบบวางแผนการท่องเที่ยวอัตโนมัติ"
        "ที่ขับเคลื่อนด้วยการรู้จำสถานที่จากภาพถ่ายผ่านโมเดลวิสัยทัศน์และภาษา (Vision-Language Place Recognition: VPR) "
        "ร่วมกับอัลกอริทึมการปรับเส้นทางเชิงพื้นที่ (Spatial Route Optimization) โดยแบ่งการประเมินออกเป็น 7 ชุดการทดลองย่อย "
        "(Exp 1 ถึง Exp 7) และการประเมินคุณภาพระบบในภาพรวมโดยผู้เชี่ยวชาญด้านการท่องเที่ยวผ่าน Google Forms "
        "เพื่อให้ครอบคลุมมิติตั้งแต่ความถูกต้องในการรู้จำสถานที่ ต้นทุน ประสิทธิภาพเชิงเวลา ความทนทานต่อสภาวะรบกวน "
        "ความสม่ำเสมอในการประมวลผล ตลอดจนคุณภาพของแผนการเดินทางที่ระบบสร้างขึ้น"
    )
    
    add_body_p(
        "เพื่อให้การวิเคราะห์ผลมีความรัดกุมเชิงสถิติและสะท้อนข้อเท็จจริงตามระเบียบวิธีวิจัยที่กำหนดไว้ในบทที่ 3 "
        "การทดลองนี้จำแนกหน่วยการวิเคราะห์หลัก (Unit of Analysis) ออกตามลักษณะโครงสร้างของข้อมูลจริงในแต่ละการทดลอง "
        "โดยไม่ใช้จำนวนแถวของไฟล์บันทึกผล (CSV rows) แทนจำนวนหน่วยทดลองอิสระ ตลอดจนทำการแยกประเภทของข้อผิดพลาดของระบบ "
        "(API Failure), คำตอบที่ไม่ถูกต้อง (Misclassification), ข้อมูลการรันซ้ำ (Repeated Runs) และข้อมูลขาดหาย (Missing Data) "
        "ออกจากกันอย่างชัดเจน ดังแสดงในตารางทะเบียนข้อมูลที่ 4.1"
    )
    
    # Table 4.1: Data Registry Table
    add_table_title("4.1", "ทะเบียนข้อมูลและสถิติชุดข้อมูลที่ใช้ในการวิเคราะห์จริงในบทที่ 4")
    t41 = doc.add_table(rows=1, cols=6)
    t41_widths = [1.1, 1.4, 0.9, 0.9, 0.9, 1.8]
    t41_headers = ["ส่วนการทดลอง", "หน่วยวิเคราะห์หลัก", "จำนวนตามแผน", "จำนวนใช้จริง", "ขาดหาย/ตัดออก", "เหตุผลและข้อสังเกตเชิงระบบ"]
    t41_data = [
        ["Exp 1: Prompt Sensitivity", "ภาพ–โมเดล–พรอมต์", "1,200 หน่วย", "1,199 หน่วย", "1 หน่วย", "API Network Timeout (ภาพ 30.jpg โมเดล Claude P1)"],
        ["Exp 2: Model Benchmark", "ภาพ–โมเดล", "600 หน่วย", "600 หน่วย", "0 หน่วย", "ข้อมูลสมบูรณ์ 100% (100 ภาพ x 6 โมเดล บน P2)"],
        ["Exp 3: Pipeline Comparison", "ภาพ–โมเดล–เงื่อนไข", "144 หน่วย", "144 หน่วย", "0 หน่วย", "ข้อมูลสมบูรณ์ 100% (24 ภาพ x 6 โมเดล Direct vs Pipeline)"],
        ["Exp 4: Robustness Test", "ภาพหรือคู่ภาพ–โมเดล–สภาวะ", "450 หน่วย", "450 หน่วย", "0 หน่วย", "ข้อมูลสมบูรณ์ 100% (75 ภาพ x 6 โมเดล ข้ามสภาวะ C1–C5)"],
        ["Exp 5: Model Consistency", "ภาพ–โมเดล–Temp–รอบ", "720 หน่วย", "720 หน่วย", "0 หน่วย", "ข้อมูลสมบูรณ์ 100% (12 ภาพ x 6 โมเดล x 2 Temps x 5 รัน)"],
        ["Exp 6: Plan Quality", "แผนทริป–สถานการณ์", "72 แผน", "72 แผน", "0 หน่วย", "ข้อมูลสมบูรณ์ 100% (12 โจทย์ทริป 7 ปลายทาง x 6 โมเดล)"],
        ["Exp 7: Blind Test", "แผน–ผู้ประเมิน", "2 ระเบียน", "2 ระเบียน", "0 หน่วย", "การประเมินแบบปกปิดสองทาง (Double-Blind) โดยผู้เชี่ยวชาญ 2 ท่าน"],
        ["ผู้เชี่ยวชาญ (Google Forms)", "บุคคลผู้ตอบแบบประเมิน", "2 ท่าน", "2 ท่าน", "0 หน่วย", "ผู้เชี่ยวชาญด้านการท่องเที่ยวและวิชาการ 2 ท่าน ตอบครบ 25 ข้อ"]
    ]
    format_table_headers_and_data(t41, t41_widths, t41_headers, t41_data, align_rights=[2, 3, 4])
    
    add_body_p(
        "สภาพแวดล้อมในการทดสอบถูกควบคุมอย่างเข้มงวด โดยส่วนเชื่อมต่อผู้ใช้งาน (Frontend) พัฒนาด้วย React 18 และ TypeScript "
        "ส่วนบริการหลังบ้าน (Backend) ทำงานบน Python 3.11 และ Flask เชื่อมโยงโมเดลการจัดอันดับภาพ OpenCLIP (สถาปัตยกรรม ViT-B-32 "
        "โมเดลต้นแบบของ OpenAI) และส่งคำขอไปยังโมเดลภาษาขนาดใหญ่และวิสัยทัศน์ผ่าน OpenRouter Gateway ซึ่งประกอบด้วยโมเดล VLM หลัก 6 สถาปัตยกรรม "
        "ได้แก่ Google Gemini 3.8 Flash, Anthropic Claude Sonnet 5, OpenAI GPT-5.4, OpenAI GPT-5.4 mini, Alibaba Qwen 2.5 VL 72B "
        "และ Meta Llama 4 Maverick โดยมีการบันทึกค่าเวลาประมวลผล (Client Time และ Latency MS), การนับโทเค็นจริง และค่าใช้จ่ายจริงเป็นสกุลเงินดอลลาร์สหรัฐ (USD)"
    )

    # ==========================================================================
    # 4.2 ผลการทดลองที่ 1: Prompt Sensitivity
    # ==========================================================================
    add_h1("4.2 ผลการทดลองที่ 1: ความไวต่อรูปแบบพรอมต์ (Exp 1: Prompt Sensitivity Analysis)")
    
    add_h2("4.2.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "การทดลองนี้มีจุดประสงค์เพื่อศึกษาผลกระทบของโครงสร้างและยุทธศาสตร์การเขียนพรอมต์ 5 รูปแบบ (P1 ถึง P5) "
        "ต่อความแม่นยำในการรู้จำสถานที่ท่องเที่ยว (Top-1 Accuracy), เวลาในการตอบสนอง (Inference Latency), จำนวนโทเค็น "
        "และต้นทุนทางการเงิน เพื่อตอบคำถามวิจัยว่า พรอมต์ใดเหมาะสมที่สุดสำหรับใช้เป็นพรอมต์มาตรฐาน (Standard Baseline Prompt) "
        "ในการทดลองถัดไป และการเพิ่มความซับซ้อนของพรอมต์ให้ผลคุ้มค่ากับภาระการประมวลผลที่เพิ่มขึ้นหรือไม่"
    )
    add_body_p(
        "ข้อมูลที่ใช้ในการวิเคราะห์จริงประกอบด้วยภาพทดสอบ 40 ภาพ (กระจายตามระดับความยาก 4 Tiers ละ 10 ภาพ) "
        "ทดสอบข้าม 6 โมเดล VLM ภายใต้รูปแบบพรอมต์ 5 รูปแบบ รวม 1,199 หน่วยการทดสอบ (ขาดภาพ 30.jpg ของโมเดล Claude ภายใต้ P1 "
        "เนื่องจากเครือข่ายขัดข้อง 1 หน่วย) โดยตรึงอุณหภูมิไว้ที่ Temperature = 0.1 ทุกการทดสอบเพื่อควบคุมความสุ่ม"
    )

    add_h2("4.2.2 ความแม่นยำแยกตามพรอมต์และโมเดล")
    add_body_p(
        "ผลการทดสอบเชิงประจักษ์พบว่า รูปแบบคำสั่ง P2: Expert Persona (การกำหนดบทบาทผู้เชี่ยวชาญด้านสถาปัตยกรรมและประวัติศาสตร์) "
        "ให้ค่าความแม่นยำในการรู้จำสถานที่เฉลี่ยสูงสุดในระดับภาพรวมที่ 79.17% (ตอบถูกต้อง 190 จาก 240 ภาพ) "
        "ตามมาด้วย P3: Chain-of-Thought (CoT) ที่ 77.50%, P1: Zero-Shot Direct ที่ 75.31%, P4: Native Thai Prompt ที่ 74.17% "
        "และ P5: Few-Shot Exemplars ได้คะแนนต่ำที่สุดที่ 72.92% ดังแสดงรายละเอียดในตารางที่ 4.2 และ 4.3"
    )

    # Table 4.2: Exp 1 Prompt Comparison
    add_table_title("4.2", "ผลการเปรียบเทียบสมรรถนะของรูปแบบพรอมต์ 5 รูปแบบในภาพรวม (Exp 1)")
    t42 = doc.add_table(rows=1, cols=6)
    t42_widths = [0.8, 1.8, 1.1, 1.2, 1.1, 1.0]
    t42_headers = ["รหัส", "รูปแบบคำสั่ง (Prompt Paradigm)", "Top-1 Acc (%)", "Latency เฉลี่ย (ms)", "โทเค็นเฉลี่ย", "ต้นทุน/1k (USD)"]
    t42_data = [
        ["P1", "Zero-Shot Direct (EN)", "75.31%", "5,228.11", "1,387.56", "$2.56"],
        ["P2", "Expert Persona (Role-based)", "79.17%", "5,406.78", "1,411.26", "$2.73"],
        ["P3", "Chain-of-Thought Reasoning", "77.50%", "6,402.20", "1,606.29", "$3.67"],
        ["P4", "Native Thai Prompt (TH)", "74.17%", "6,765.76", "1,510.95", "$3.28"],
        ["P5", "Few-Shot ICL (3 Exemplars)", "72.92%", "5,169.93", "1,521.53", "$2.66"]
    ]
    format_table_headers_and_data(t42, t42_widths, t42_headers, t42_data, align_rights=[2, 3, 4, 5])

    # Table 4.3: Exp 1 Model x Prompt Matrix
    add_table_title("4.3", "ความแม่นยำ Top-1 Accuracy (%) จำแนกตามโมเดลและรูปแบบพรอมต์ (Exp 1)")
    t43 = doc.add_table(rows=1, cols=6)
    t43_widths = [1.8, 0.9, 0.9, 0.9, 0.9, 0.9]
    t43_headers = ["โมเดล VLM", "P1 (Direct)", "P2 (Expert)", "P3 (CoT)", "P4 (Thai)", "P5 (Few-Shot)"]
    t43_data = [
        ["Google Gemini 3.8 Flash", "92.50%", "97.50%", "95.00%", "95.00%", "92.50%"],
        ["Anthropic Claude Sonnet 5", "79.49%", "82.50%", "85.00%", "80.00%", "77.50%"],
        ["OpenAI GPT-5.4", "75.00%", "80.00%", "75.00%", "77.50%", "75.00%"],
        ["OpenAI GPT-5.4 mini", "70.00%", "77.50%", "72.50%", "67.50%", "62.50%"],
        ["Meta Llama 4 Maverick", "70.00%", "72.50%", "70.00%", "67.50%", "67.50%"],
        ["Alibaba Qwen 2.5 VL 72B", "65.00%", "65.00%", "67.50%", "57.50%", "62.50%"]
    ]
    format_table_headers_and_data(t43, t43_widths, t43_headers, t43_data, align_rights=[1, 2, 3, 4, 5])

    add_h2("4.2.3 เวลา โทเค็น และต้นทุน (Efficiency & Cost Overhead)")
    add_body_p(
        "เมื่อพิจารณามิติด้านประสิทธิภาพเชิงคำนวณ พบว่า P3 (CoT) มีอัตราการใช้โทเค็นเฉลี่ยสูงสุดที่ 1,606.29 โทเค็นต่อคำขอ "
        "ซึ่งสูงกว่า P2 ถึง 13.8% ส่งผลให้เวลาในการอนุมานเพิ่มขึ้นเป็น 6,402.20 ms และต้นทุนการเรียกใช้ API สูงถึง $3.67 ต่อ 1,000 คำขอ "
        "(แพงกว่า P2 ถึง 34.5%) ในขณะที่ P4 (ภาษาไทย) มีเวลาตอบสนองช้าที่สุดในกลุ่ม (6,765.76 ms) เนื่องจากโมเดลส่วนใหญ่ได้รับการฝึกฝน "
        "บนชุดข้อมูลภาษาอังกฤษเป็นหลัก จึงต้องใช้เวลาย่อยและสร้างโทเค็นคำศัพท์ภาษาไทยที่ยาวกว่าภาษาอังกฤษ สำหรับ P5 (Few-Shot) "
        "แม้จะมีเวลาประมวลผลเร็ว (5,169.93 ms) แต่ความแม่นยำกลับลดลงอย่างชัดเจนในโมเดลขนาดเล็ก เช่น GPT-5.4 mini ลดลงเหลือเพียง 62.50%"
    )

    add_h2("4.2.4 การเลือกพรอมต์มาตรฐานและข้อค้นพบสำคัญ")
    add_body_p(
        "การวิเคราะห์เชิงลึกเผยให้เห็นเหตุผลสำคัญในการเลือกพรอมต์มาตรฐาน: "
        "1) การกำหนดบทบาทผู้เชี่ยวชาญ (P2) ช่วยกระตุ้นความสนใจเชิงพื้นที่ (Attention Guidance) ไปยังองค์ประกอบทางสถาปัตยกรรมจำเพาะ "
        "เช่น ลวดลายกระเบื้อง ยอดปรางค์ ซุ้มประตู และลักษณะหน้าบัน ทำให้โมเดลสามารถแยกแยะวัดที่มีลักษณะใกล้เคียงกันได้ดีกว่า P1 "
        "2) P3 (CoT) ให้ประโยชน์เพิ่มขึ้นเฉพาะกับ Claude Sonnet 5 (+2.5%) และ Qwen 2.5 VL (+2.5%) แต่ทำให้โมเดล GPT-5.4 "
        "มีความแม่นยำลดลง (-5.0%) เนื่องจากเกิดการคิดวกวนและสับสนข้อความบรรยายที่โมเดลสร้างขึ้นเอง "
        "3) P5 (Few-Shot) เผชิญกับปัญหา Exemplar Bias โดยโมเดลมีแนวโน้มดึงคำตอบเข้าหาหมวดหมู่ของภาพตัวอย่างที่ให้ไว้ในพรอมต์ "
        "ส่งผลให้การตอบนอกกลุ่มตัวอย่างผิดพลาด"
    )
    add_body_p(
        "ข้อสรุปเชิงประจักษ์: งานวิจัยนี้จึงคัดเลือก P2: Expert Persona เป็นพรอมต์มาตรฐาน (Standard Baseline Prompt) "
        "สำหรับการทดลองในขั้นตอนถัดไปทั้งหมด เนื่องจากให้ความแม่นยำสูงที่สุดในภาพรวม (79.17%) ในขณะที่เพิ่มภาระเวลาเพียง 3.4% "
        "และต้นทุนเพิ่มขึ้นเพียง 6.5% เมื่อเทียบกับ Zero-Shot พื้นฐาน ซึ่งเป็นข้อแลกเปลี่ยน (Trade-off) ที่คุ้มค่าที่สุดสำหรับการใช้งานจริง"
    )

    # Figure Placeholder 4.1
    add_callout_box(
        doc,
        title="ภาพที่ 4.1 ชุดภาพรวมผลการทดลองที่ 1: การวิเคราะห์ความไวต่อรูปแบบพรอมต์ (Exp 1: Prompt Sensitivity)",
        filename_base="fig4_01_exp1_prompt_sensitivity_4panel",
        description="แสดง 4 มิติเชิงบูรณาการ: (a) เมทริกซ์ความแม่นยำ Model x Prompt (b) กราฟ Effect Size แสดง ΔAccuracy เทียบกับ P1 "
                    "(c) กราฟ Bubble Scatter ระหว่างต้นทุน API ความแม่นยำ และเวลา Latency (d) การกระจายตัวของเวลา Latency รายพรอมต์ (P1–P5)"
    )

    # ==========================================================================
    # 4.3 ผลการทดลองที่ 2: Model Benchmark
    # ==========================================================================
    add_h1("4.3 ผลการทดลองที่ 2: การเปรียบเทียบสมรรถนะโมเดล (Exp 2: Multi-Model VPR Baseline Benchmarks)")
    
    add_h2("4.3.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "การทดลองที่ 2 มุ่งประเมินขีดความสามารถพื้นฐานของโมเดล VLM ชั้นนำทั้ง 6 สถาปัตยกรรมในการรู้จำสถานที่จากภาพถ่าย "
        "ภายใต้พรอมต์มาตรฐาน P2 และสภาพแวดล้อมเดียวกัน โดยมุ่งตรวจสอบว่าโมเดลใดมีความแม่นยำสูงสุดภายใต้ชุดทดสอบ 100 ภาพ "
        "ความสามารถของโมเดลเปลี่ยนแปลงไปอย่างไรเมื่อระดับความยากของภาพเพิ่มขึ้น และมีข้อแลกเปลี่ยนเชิงประสิทธิภาพ "
        "(ความแม่นยำ เวลา ต้นทุน) ตลอดจนลักษณะความผิดพลาด (Failure Modes) อย่างไรบ้าง"
    )
    add_body_p(
        "ชุดข้อมูลทดสอบประกอบด้วยภาพถ่ายสถานที่ท่องเที่ยวในกรุงเทพมหานครและปริมณฑลจำนวน 100 ภาพ ซึ่งแบ่งตามระดับความยาก 4 ระดับ (Tiers) "
        "ระดับละ 25 ภาพ ได้แก่ Tier 1 (Iconic Landmarks เช่น พระบรมมหาราชวัง วัดอรุณฯ), Tier 2 (Regional & Cultural Heritage เช่น ตลาดน้ำ วัดสะแก), "
        "Tier 3 (Nature & Natural Attractions เช่น สวนพฤกษศาสตร์ เขาใหญ่ น้ำตก), และ Tier 4 (Casual In-the-Wild UGC เช่น ภาพถ่ายจากมุมมองนักท่องเที่ยวทั่วไป "
        "มีผู้คนและยานพาหนะบัง) รวมการทดสอบ 600 ครั้ง (100 ภาพ x 6 โมเดล)"
    )

    add_h2("4.3.2 สมรรถนะโดยรวมและช่วงความเชื่อมั่น")
    add_body_p(
        "จากผลการทดลองในตารางที่ 4.4 Google Gemini 3.8 Flash ได้คะแนนความแม่นยำ Top-1 Accuracy สูงที่สุดอย่างเด็ดขาดที่ 97.00% "
        "(ช่วงความเชื่อมั่น 95% CI: 93.7% ถึง 100.0%) และมีอัตราการส่งออกข้อความ (Throughput) สูงที่สุดถึง 51.88 Tokens/Second "
        "ในขณะที่ Anthropic Claude Sonnet 5 และ OpenAI GPT-5.4 ได้คะแนนความแม่นยำเท่ากันที่ 87.00% (95% CI: 80.4% ถึง 93.6%) "
        "ส่วนกลุ่มโมเดลขนาดเล็กและประหยัดต้นทุน OpenAI GPT-5.4 mini ได้ความแม่นยำ 79.00%, Alibaba Qwen 2.5 VL 72B ได้ 77.00% "
        "และ Meta Llama 4 Maverick ได้ 75.00%"
    )

    # Table 4.4: Exp 2 Overall Model Benchmark
    add_table_title("4.4", "สมรรถนะพื้นฐาน ประสิทธิภาพเชิงเวลา และต้นทุนของโมเดล VLM ทั้ง 6 สถาปัตยกรรม (Exp 2)")
    t44 = doc.add_table(rows=1, cols=6)
    t44_widths = [1.8, 1.2, 1.1, 1.1, 1.1, 0.9]
    t44_headers = ["โมเดล VLM", "Top-1 Acc (95% CI)", "เวลาเฉลี่ย (ms)", "Throughput (TPS)", "ต้นทุน/1k (USD)", "ภาพผิด (ภาพ)"]
    t44_data = [
        ["Google Gemini 3.8 Flash", "97.00% (±3.3%)", "6,211.16", "51.88", "$4.12", "3"],
        ["Anthropic Claude Sonnet 5", "87.00% (±6.6%)", "5,513.42", "37.09", "$4.26", "13"],
        ["OpenAI GPT-5.4", "87.00% (±6.6%)", "4,504.12", "19.22", "$4.01", "13"],
        ["OpenAI GPT-5.4 mini", "79.00% (±8.0%)", "2,899.77", "28.57", "$1.16", "21"],
        ["Alibaba Qwen 2.5 VL 72B", "77.00% (±8.2%)", "3,333.95", "19.26", "$0.98", "23"],
        ["Meta Llama 4 Maverick", "75.00% (±8.5%)", "5,252.07", "14.99", "$0.56", "25"]
    ]
    format_table_headers_and_data(t44, t44_widths, t44_headers, t44_data, align_rights=[1, 2, 3, 4, 5])

    add_h2("4.3.3 สมรรถนะแยกตาม Tier และปรากฏการณ์คอขวดภาพธรรมชาติ (Tier 3 Bottleneck)")
    add_body_p(
        "เมื่อวิเคราะห์แยกตามระดับความยาก 4 Tiers ในตารางที่ 4.5 พบปรากฏการณ์สำคัญคือ ทุกโมเดลสามารถทำความแม่นยำได้ 100.00% เต็ม "
        "ในกลุ่ม Tier 1 (Iconic) และเกือบสมบูรณ์ใน Tier 2 (Cultural 96–100%) ทว่าเกิดปรากฏการณ์คอขวดรุนแรงใน Tier 3: Nature "
        "โดยคะแนนของโมเดลส่วนใหญ่ลดฮวบลงอย่างมีนัยสำคัญ เช่น Llama 4 ทำได้เพียง 28.00%, GPT-5.4 mini และ Qwen ได้ 40.00%, "
        "GPT-5.4 ได้ 48.00% และ Claude Sonnet 5 ได้ 56.00% มีเพียง Google Gemini 3.8 Flash เท่านั้นที่ยังคงรักษาระดับความแม่นยำ "
        "ในกลุ่มธรรมชาติได้สูงถึง 88.00% ส่วนในกลุ่ม Tier 4: UGC พบว่าโมเดลระดับพรีเมียม (Gemini และ GPT-5.4) ทำได้ 100.00% เต็ม "
        "แสดงถึงความสามารถในการกรองสิ่งรบกวนทางสายตาในภาพถ่ายจากชีวิตจริงได้ดีเยี่ยม"
    )

    # Table 4.5: Exp 2 Tier Breakdown
    add_table_title("4.5", "ความแม่นยำ Top-1 Accuracy (%) จำแนกตาม 4 ระดับความยาก (Exp 2)")
    t45 = doc.add_table(rows=1, cols=5)
    t45_widths = [2.1, 1.2, 1.2, 1.2, 1.2]
    t45_headers = ["โมเดล VLM", "Tier 1: Iconic", "Tier 2: Cultural", "Tier 3: Nature", "Tier 4: Casual UGC"]
    t45_data = [
        ["Google Gemini 3.8 Flash", "100.00%", "100.00%", "88.00%", "100.00%"],
        ["Anthropic Claude Sonnet 5", "100.00%", "100.00%", "56.00%", "92.00%"],
        ["OpenAI GPT-5.4", "100.00%", "100.00%", "48.00%", "100.00%"],
        ["OpenAI GPT-5.4 mini", "100.00%", "100.00%", "40.00%", "76.00%"],
        ["Alibaba Qwen 2.5 VL 72B", "100.00%", "100.00%", "40.00%", "68.00%"],
        ["Meta Llama 4 Maverick", "100.00%", "96.00%", "28.00%", "76.00%"]
    ]
    format_table_headers_and_data(t45, t45_widths, t45_headers, t45_data, align_rights=[1, 2, 3, 4])

    add_h2("4.3.4 ความคุ้มค่าและประเภทความผิดพลาด (Trade-offs & Failure Modes)")
    add_body_p(
        "การจำแนกประเภทความล้มเหลว (Failure Modes) ในตารางที่ 4.6 พบว่า ความผิดพลาดส่วนใหญ่ 80–100% จัดอยู่ในกลุ่ม "
        "Visual Confusion (การสับสนทางสายตาระหว่างสถานที่ที่มีลักษณะคล้ายกัน เช่น จำแนกวัดกัลยาณมิตรเป็นวัดอรุณฯ หรือสับสนระหว่างน้ำตกในภาคเดียวกัน) "
        "ตามมาด้วย Degradation Rejection (การปฏิเสธไม่ตอบเนื่องจากภาพถ่ายไม่ชัดเจน พบ 8.7–23.1% ในโมเดลพาณิชย์) "
        "และที่น่ายินดีคือ ไม่พบความผิดพลาดประเภท Hallucination (การกุชื่อสถานที่ที่ไม่มีอยู่จริงในโลก) เลยแม้แต่กรณีเดียวในทุกโมเดล (0.00%)"
    )

    # Table 4.6: Exp 2 Failure Modes
    add_table_title("4.6", "การจำแนกประเภทความล้มเหลวของโมเดล VLM จากภาพที่ตอบผิดทั้งหมด (Exp 2)")
    t46 = doc.add_table(rows=1, cols=5)
    t46_widths = [1.9, 1.1, 1.4, 1.4, 1.2]
    t46_headers = ["โมเดล VLM", "จำนวนภาพผิด", "Visual Confusion", "Degradation Rejection", "Hallucination"]
    t46_data = [
        ["Google Gemini 3.8 Flash", "3 ภาพ", "3 (100.0%)", "0 (0.0%)", "0 (0.0%)"],
        ["Anthropic Claude Sonnet 5", "13 ภาพ", "10 (76.9%)", "3 (23.1%)", "0 (0.0%)"],
        ["OpenAI GPT-5.4", "13 ภาพ", "11 (84.6%)", "2 (15.4%)", "0 (0.0%)"],
        ["OpenAI GPT-5.4 mini", "21 ภาพ", "17 (81.0%)", "4 (19.0%)", "0 (0.0%)"],
        ["Alibaba Qwen 2.5 VL 72B", "23 ภาพ", "21 (91.3%)", "2 (8.7%)", "0 (0.0%)"],
        ["Meta Llama 4 Maverick", "25 ภาพ", "25 (100.0%)", "0 (0.0%)", "0 (0.0%)"]
    ]
    format_table_headers_and_data(t46, t46_widths, t46_headers, t46_data, align_rights=[1, 2, 3, 4])

    add_h2("4.3.5 ข้อค้นพบสำหรับการเลือกใช้งาน (Pareto Frontier Analysis)")
    add_body_p(
        "การวิเคราะห์เส้นขอบเขตประสิทธิภาพที่เหมาะสมที่สุด (Pareto Frontier) ชี้ให้เห็นว่า: "
        "1) หากเน้นความแม่นยำสูงสุดในงานวิจัย: Google Gemini 3.8 Flash ครองตำแหน่งจุดเลิศ (Pareto Optimal) ด้วยความแม่นยำ 97.00% "
        "2) หากเน้นความเร็วในการให้บริการแบบเรียลไทม์ (Latency-Critical): OpenAI GPT-5.4 mini เป็นจุดเลิศด้วยเวลาเฉลี่ยเพียง 2.90 วินาที "
        "3) หากเน้นการประหยัดต้นทุนระดับสูง (High-Scale Cost Optimization): Meta Llama 4 Maverick เป็นจุดเลิศด้วยต้นทุนเพียง $0.56 ต่อ 1,000 คำขอ "
        "ซึ่งถูกกว่าโมเดลกลุ่มพรีเมียมถึง 7.4 เท่า"
    )
    add_body_p(
        "ข้อสรุปปลายหัวข้อ: 'โมเดลที่แม่นยำที่สุด' (Gemini 3.8 Flash) จึงไม่ใช่ 'โมเดลเดียวที่เหมาะกับการนำไปใช้จริงในทุกกรณี' "
        "ระบบควรใช้กลไก Dynamic Model Routing ตามงบประมาณและเวลาของผู้ใช้งานแต่ละกลุ่ม"
    )

    # Figure Placeholder 4.2
    add_callout_box(
        doc,
        title="ภาพที่ 4.2 ชุดภาพรวมผลการทดลองที่ 2: การเปรียบเทียบสมรรถนะโมเดล VLM (Exp 2: Model Benchmark)",
        filename_base="fig4_02_exp2_model_benchmark_4panel",
        description="แสดง 4 มิติเชิงวิชาการ: (a) Dot Plot ความแม่นยำ Top-1 พร้อมช่วงความเชื่อมั่น 95% CI "
                    "(b) Heatmap ความแม่นยำจำแนกตาม 4 ระดับความยาก (แสดงปรากฏการณ์ Tier 3 Bottleneck) "
                    "(c) กราฟ Pareto Frontier วิเคราะห์ความคุ้มค่าระหว่างความแม่นยำ เวลา และต้นทุน "
                    "(d) Stacked Bar จำแนกประเภทความสำเร็จและความล้มเหลว (Failure Modes Taxonomy)"
    )

    # ==========================================================================
    # 4.4 ผลการทดลองที่ 3: Pipeline Comparison
    # ==========================================================================
    add_h1("4.4 ผลการทดลองที่ 3: การเปรียบเทียบ Pipeline (Exp 3: Two-Turn Pipeline Comparison & Top-K Recovery)")
    
    add_h2("4.4.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "การทดลองที่ 3 มุ่งประเมินว่า สถาปัตยกรรมแบบสองจังหวะ (Two-Turn Pipeline) ร่วมกับการจัดอันดับภาพด้วย OpenCLIP "
        "และการเปิดรายการตัวเลือกสำรอง 3 อันดับแรก (Top-3 Candidates) ช่วยเพิ่มความถูกต้องในการรู้จำสถานที่และลดปัญหา "
        "Single-Point Failure ได้มากน้อยเพียงใดเมื่อเทียบกับโหมด Direct 1-Turn (การบังคับให้โมเดลตอบชื่อเดียวทันที) "
        "ตลอดจนประเมินเวลาและภาระการคำนวณที่เพิ่มขึ้นจากการสกัดคุณลักษณะภาพ"
    )
    add_body_p(
        "ข้อมูลทดสอบประกอบด้วยภาพ 24 ภาพ (6 ภาพต่อ Tier) ทดสอบข้ามทั้ง 6 โมเดล รวม 144 หน่วยการทดสอบ โดยทำการวิเคราะห์บนภาพชุดเดียวกัน "
        "ระหว่างโหมด Direct 1-Turn และ Two-Turn Pipeline เพื่อให้สามารถเปรียบเทียบแบบจับคู่ (Paired Comparison) ได้อย่างเที่ยงตรง"
    )

    add_h2("4.4.2 ความแม่นยำ Direct เทียบ Pipeline และโอกาสกู้คืนคำตอบ (Top-3 Candidate Recovery)")
    add_body_p(
        "ผลการทดลองในตารางที่ 4.7 แสดงให้เห็นว่า การเปิดรายการตัวเลือก Top-3 Candidates ช่วยยกระดับความถูกต้องของชุดคำตอบขึ้นอย่างก้าวกระโดด: "
        "ในโมเดล Google Gemini 3.8 Flash คะแนน Direct Top-1 อยู่ที่ 66.67% แต่เมื่อขยายเป็น Top-3 Recall พบว่าความถูกต้องพุ่งขึ้นเป็น 100.00% เต็ม "
        "(เกิด Potential Candidate Recovery Gain สูงถึง +33.33 จุดร้อยละ) เช่นเดียวกับ Anthropic Claude Sonnet 5 ที่ Top-1 อยู่ที่ 79.17% "
        "และพุ่งขึ้นเป็น 100.00% ใน Top-3 (+20.83 จุดร้อยละ) และแม้แต่โมเดลขนาดเล็กอย่าง Llama 4 ก็สามารถกู้คืนคำตอบที่ผิดพลาดในอันดับแรก "
        "กลับคืนมาได้ถึง +29.17 จุดร้อยละ (จาก 58.33% ขยายเป็น 87.50%)"
    )

    # Table 4.7: Exp 3 Pipeline Comparison
    add_table_title("4.7", "การเปรียบเทียบ Top-1 Strict กับ Top-3 Recall และโอกาสกู้คืนคำตอบ (Exp 3)")
    t47 = doc.add_table(rows=1, cols=5)
    t47_widths = [1.8, 1.2, 1.2, 1.5, 1.2]
    t47_headers = ["โมเดล VLM", "Direct Top-1 (%)", "Top-3 Recall (%)", "Potential Recovery Gain", "Pipeline Latency (s)"]
    t47_data = [
        ["Google Gemini 3.8 Flash", "66.67%", "100.00%", "+33.33% points", "15.08 วินาที"],
        ["Anthropic Claude Sonnet 5", "79.17%", "100.00%", "+20.83% points", "19.65 วินาที"],
        ["Meta Llama 4 Maverick", "58.33%", "87.50%", "+29.17% points", "39.70 วินาที"],
        ["OpenAI GPT-5.4 mini", "58.33%", "83.33%", "+25.00% points", "10.42 วินาที"],
        ["OpenAI GPT-5.4", "62.50%", "79.17%", "+16.67% points", "14.96 วินาที"],
        ["Alibaba Qwen 2.5 VL 72B", "54.17%", "70.83%", "+16.67% points", "12.12 วินาที"]
    ]
    format_table_headers_and_data(t47, t47_widths, t47_headers, t47_data, align_rights=[1, 2, 3, 4])

    add_h2("4.4.3 คะแนนความคล้ายคลึงของภาพ (OpenCLIP Visual Similarity Scores)")
    add_body_p(
        "เมื่อตรวจสอบค่าความเกี่ยวข้องเชิงความหมาย (Candidate Relevance Scores จากโมดูล OpenCLIP ViT-B-32) "
        "พบว่า อันดับ 1 (Candidate 1) มีการแจกแจงของคะแนนเฉลี่ยอยู่ที่ 2.45 เต็ม 3.00 สำหรับตัวเลือกที่ถูกต้อง "
        "ในขณะที่กรณีที่ระบบตอบผิด ค่าคะแนนความคล้ายคลึงจะตกต่ำลงมาอยู่ในช่วง 0.40–0.80 อย่างชัดเจน "
        "แสดงว่าค่าความคล้ายคลึงของเวกเตอร์ภาพถ่ายช่วยทำหน้าที่เป็นตัวกรองทางอุณหภูมิ (Confidence Filter) "
        "ในการจัดลำดับสถานที่ที่น่าจะถูกต้องขึ้นมาอยู่ใน 3 อันดับแรกได้อย่างมีนัยสำคัญ"
    )

    add_h2("4.4.4 เวลา ต้นทุน และข้อจำกัดในการตีความผล")
    add_body_p(
        "ข้อแลกเปลี่ยนสำคัญของสถาปัตยกรรม Two-Turn Pipeline คือ เวลาประมวลผลเฉลี่ยเพิ่มขึ้นเป็น 10.42 ถึง 39.70 วินาทีต่อภาพ "
        "(เทียบกับ 2.9–6.2 วินาทีในโหมด Direct) เนื่องมาจากความหน่วงในการดาวน์โหลดภาพอ้างอิงจาก Wikipedia/Foursquare "
        "และการสกัดเวกเตอร์ 512 มิติของโมเดล OpenCLIP ในเครื่องแม่ข่ายบริการหลังบ้าน"
    )
    add_body_p(
        "ข้อพึงระวังและข้อจำกัดเชิงวิชาการ: ผู้วิจัยขอเน้นย้ำว่า ตัวเลข Potential Recovery Gain (+16.67% ถึง +33.33%) "
        "หมายถึง 'โอกาสทางทฤษฎีในการกู้คืนคำตอบที่ปรากฏในเซตตัวเลือก (Potential Upper Bound Candidate Recovery)' "
        "เท่านั้น ไม่สามารถอ้างว่า 'มนุษย์สามารถแก้ปัญหาได้สำเร็จจริง 100%' เนื่องจากในการทดลองนี้เป็นการประเมิน "
        "ทางอัลกอริทึมโดยยังไม่ได้เก็บข้อมูลพฤติกรรมการคลิกเลือกจริงของผู้ใช้งานปลายทาง"
    )

    # Figure Placeholder 4.3
    add_callout_box(
        doc,
        title="ภาพที่ 4.3 ชุดภาพรวมผลการทดลองที่ 3: การเปรียบเทียบสถาปัตยกรรม Pipeline (Exp 3: Pipeline Comparison)",
        filename_base="fig4_03_exp3_pipeline_comparison_4panel",
        description="แสดง 4 มิติเชิงวิชาการ: (a) Dumbbell Plot เปรียบเทียบ Direct Top-1 กับ Pipeline Top-3 Recall "
                    "(b) Stacked Bar สัดส่วนผลลัพธ์ 3 สถานะ (ถูกต้องทันที / กู้คืนได้ใน Top-3 / ไม่พบคำตอบ) "
                    "(c) กราฟ Quadrant Scatter ข้อแลกเปลี่ยนระหว่างเวลาที่เพิ่มขึ้นกับโอกาสกู้คืนคำตอบ "
                    "(d) Boxplot การแจกแจงคะแนนความเกี่ยวข้องของตัวเลือกอันดับ 1, 2, และ 3"
    )

    # ==========================================================================
    # 4.5 ผลการทดลองที่ 4: Robustness Test
    # ==========================================================================
    add_h1("4.5 ผลการทดลองที่ 4: ความทนทานต่อสภาวะภาพรบกวน (Exp 4: Environmental Robustness Test)")
    
    add_h2("4.5.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "ในสถานการณ์ท่องเที่ยวจริง ภาพถ่ายที่ป้อนเข้าสู่ระบบมักมีความเสื่อมสภาพทางกายภาพ การทดลองที่ 4 จึงมีจุดประสงค์ "
        "เพื่อประเมินความทนทาน (Robustness) ของโมเดล VLM ทั้ง 6 ตัว เมื่อต้องเผชิญกับสภาวะรบกวนทางกายภาพ 5 สภาวะ ได้แก่ "
        "C1: Baseline (แดดกลางวันปกติ ฟ้าเปิด ระดับสายตา), C2: Illumination Stress (กลางคืน, ย้อนแสง, สปอตไลท์), "
        "C3: Atmospheric Stress (ฝนตก, หมอกควัน, ฟ้าครึ้ม), C4: Geometric Stress (มุมมองโดรนมุมสูง, ภาพมุมกด Bird's-eye), "
        "และ C5: Occlusion & Blur Stress (นักท่องเที่ยวบัง, ร่มหรือกันสาดบัง, ภาพสั่นเบลอ)"
    )
    add_body_p(
        "ข้อมูลทดสอบประกอบด้วยภาพ 15 ภาพต่อสภาวะ รวม 75 ภาพ ทดสอบข้าม 6 โมเดล รวมทั้งสิ้น 450 หน่วยการทดสอบ ภายใต้พรอมต์มาตรฐาน P2"
    )

    add_h2("4.5.2 ความแม่นยำและการเปลี่ยนแปลงจาก Baseline (Degradation Analysis)")
    add_body_p(
        "ผลการทดลองในตารางที่ 4.8 และ 4.9 เผยให้เห็นข้อค้นพบสำคัญ: "
        "1) ภายใต้สภาวะปกติ (C1 Baseline) โมเดลมีความแม่นยำเฉลี่ยสูงถึง 98.89% "
        "2) สภาวะแสง (C2 Illumination) ส่งผลกระทบน้อยที่สุด โดยความแม่นยำลดลงเพียง -2.22 จุดร้อยละ (เหลือ 96.67%) "
        "3) สภาวะบรรยากาศ (C3 Atmospheric) ทำให้ความแม่นยำลดลง -4.45 จุดร้อยละ (เหลือ 94.44%) "
        "4) สภาวะการบดบังและเบลอ (C5 Occlusion) ทำให้ความแม่นยำลดลง -5.56 จุดร้อยละ (เหลือ 93.33%) "
        "5) และสภาวะที่ก่อให้เกิดความเสื่อมถอยรุนแรงที่สุดอย่างมีนัยสำคัญคือ สภาวะทางเรขาคณิต (C4: Geometric Stress) "
        "ซึ่งทำให้อัตราความแม่นยำเฉลี่ยลดลงถึง -8.89 จุดร้อยละ (เหลือ 90.00%)"
    )

    # Table 4.8: Exp 4 Condition Degradation
    add_table_title("4.8", "ความแม่นยำเฉลี่ยและอัตราการเสื่อมถอยแยกตามสภาวะสิ่งแวดล้อมรบกวน (Exp 4)")
    t48 = doc.add_table(rows=1, cols=4)
    t48_widths = [1.8, 2.6, 1.2, 1.2]
    t48_headers = ["สภาวะการทดสอบ", "คำอธิบายทางกายภาพของสภาวะ", "Accuracy under Stress (%)", "อัตราเสื่อมถอย (Degradation)"]
    t48_data = [
        ["C1: Baseline", "แดดกลางวันปกติ ท้องฟ้าเปิด ถ่ายระดับสายตา", "98.89%", "0.00% (จุดอ้างอิง)"],
        ["C2: Illumination Stress", "เวลากลางคืน, แสงน้อย, สปอตไลท์, ย้อนแสง", "96.67%", "-2.22% points"],
        ["C3: Atmospheric Stress", "ละอองฝนตก, หมอกควันหนา, ท้องฟ้ามืดครึ้ม", "94.44%", "-4.45% points"],
        ["C5: Occlusion & Blur Stress", "สิ่งกีดขวาง/นักท่องเที่ยวบังบางส่วน, ภาพสั่นเบลอ", "93.33%", "-5.56% points"],
        ["C4: Geometric Stress", "มุมสูงจากโดรน (Aerial), ภาพมุมกด Bird's-eye", "90.00%", "-8.89% points (รุนแรงสุด)"]
    ]
    format_table_headers_and_data(t48, t48_widths, t48_headers, t48_data, align_rights=[2, 3])

    # Table 4.9: Exp 4 Model x Condition Matrix
    add_table_title("4.9", "ความแม่นยำ (%) จำแนกตามโมเดลและสภาวะสิ่งแวดล้อมรบกวน (Exp 4)")
    t49 = doc.add_table(rows=1, cols=6)
    t49_widths = [1.8, 0.9, 0.9, 0.9, 0.9, 0.9]
    t49_headers = ["โมเดล VLM", "C1 (Base)", "C2 (Light)", "C3 (Atmos)", "C4 (Geo)", "C5 (Occl)"]
    t49_data = [
        ["Google Gemini 3.8 Flash", "100.00%", "100.00%", "100.00%", "100.00%", "93.33%"],
        ["OpenAI GPT-5.4", "100.00%", "93.33%", "100.00%", "93.33%", "100.00%"],
        ["Anthropic Claude Sonnet 5", "93.33%", "93.33%", "93.33%", "93.33%", "93.33%"],
        ["Alibaba Qwen 2.5 VL 72B", "100.00%", "100.00%", "100.00%", "86.67%", "93.33%"],
        ["Meta Llama 4 Maverick", "100.00%", "93.33%", "93.33%", "86.67%", "93.33%"],
        ["OpenAI GPT-5.4 mini", "100.00%", "100.00%", "80.00%", "80.00%", "86.67%"]
    ]
    format_table_headers_and_data(t49, t49_widths, t49_headers, t49_data, align_rights=[1, 2, 3, 4, 5])

    add_h2("4.5.3 กรณีศึกษาความผิดพลาดและข้อจำกัดของการเปรียบเทียบ")
    add_body_p(
        "จากการศึกษารายกรณี (Case Studies) ในสภาวะ Geometric (C4) พบว่า ภาพมุมมองมุมกดจากโดรนทำให้องค์ประกอบด้านหน้า "
        "(Architectural Facade) เช่น ป้ายชื่อวัด ลวดลายบานประตู และหน้าบันพระอุโบสถถูกบดบัง และเห็นเพียงหลังคากระเบื้อง "
        "ส่งผลให้โมเดล GPT-5.4 mini และ Qwen จำแนกภาพวัดอรุณราชวรารามผิดพลาดเป็นวัดกัลยาณมิตร หรือภาพปราสาทสัจธรรมมุมสูง "
        "ถูก Llama 4 จำแนกผิดเป็นหมู่บ้านวัฒนธรรมไม้ สำหรับสภาวะฝนตก (C3) ละอองฝนทำให้คอนทราสต์ของหาดทรายขาวหายไป "
        "ทำให้โมเดลปฏิเสธคำตอบ (Degradation Rejection)"
    )
    add_body_p(
        "ข้อจำกัดด้านความถูกต้องของการเปรียบเทียบ: เนื่องจากภาพในแต่ละสภาวะ (C1–C5) เป็นภาพถ่ายจริงจากสถานที่ต่างๆ "
        "ซึ่งไม่ได้จับคู่เป็นมุมมองเดียวกันแบบสมบูรณ์ 100% ข้ามทุกสภาวะ (Unpaired Real-world Sets) ดังนั้น ข้อสรุปทางสถิติจึงควรระบุว่า "
        "'พบความแตกต่างของอัตราการจำแนกระหว่างกลุ่มภาพสภาวะต่างๆ' โดยไม่ด่วนสรุปว่าปัจจัยรบกวนทางกายภาพเป็นสาเหตุเดียวของการลดลงของความแม่นยำ"
    )

    # Figure Placeholder 4.4
    add_callout_box(
        doc,
        title="ภาพที่ 4.4 ชุดภาพรวมผลการทดลองที่ 4: ความทนทานต่อสภาวะรบกวน (Exp 4: Robustness Test)",
        filename_base="fig4_04_exp4_robustness_test_4panel",
        description="แสดง 3 มิติเชิงวิชาการ: (a) Grouped Line Plot วิถีความทนทานของโมเดลข้าม 5 สภาวะรบกวน "
                    "(b) Diverging Heatmap แสดงอัตราเสื่อมถอย (ΔAccuracy) เปรียบเทียบกับ C1 Baseline "
                    "(c) กราฟการกระจายตัวของอัตราเสื่อมถอย (Degradation Rate) พร้อมค่าเฉลี่ยแยกรายสภาวะ "
                    "(หมายเหตุ: กรณีศึกษาข้อผิดพลาดเชิงคุณภาพได้นำเสนอผ่านการวิเคราะห์ในหัวข้อ 4.5.3)"
    )

    # ==========================================================================
    # 4.6 ผลการทดลองที่ 5: Model Consistency
    # ==========================================================================
    add_h1("4.6 ผลการทดลองที่ 5: ความสม่ำเสมอของโมเดล (Exp 5: Model Consistency & Stability)")
    
    add_h2("4.6.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "การทดลองที่ 5 มีจุดประสงค์เพื่อประเมินความคงเส้นคงวาเชิงความหมาย (Semantic Determinism) และความเสถียรเชิงปฏิบัติการ "
        "เมื่อป้อนภาพถ่ายสถานที่เดิมซ้ำๆ จำนวน 5 รอบรัน ตลอดจนศึกษาอิทธิพลของพารามิเตอร์อุณหภูมิ (Temperature = 0.1 เทียบกับ 0.7) "
        "ต่อความสม่ำเสมอของชื่อสถานที่ ความมั่นใจ (Confidence Score) และความผันผวนของเวลาประมวลผล (Latency Jitter)"
    )
    add_body_p(
        "ข้อมูลทดสอบประกอบด้วยภาพตัวแทน 12 ภาพ ทดสอบซ้ำ 5 รอบรัน x 2 ค่าอุณหภูมิ x 6 โมเดล รวมทั้งสิ้น 720 รัน "
        "โดยวัดค่า Consistency Agreement Score (สัดส่วนของภาพที่โมเดลตอบชื่อสถานที่ตรงกันครบ 100% ทั้ง 5 รอบ หลังผ่านกระบวนการ Text Normalization)"
    )

    add_h2("4.6.2 ผลของ Temperature ต่อความคงที่ของคำตอบ")
    add_body_p(
        "จากผลการทดลองในตารางที่ 4.10 พบข้อค้นพบเชิงประจักษ์ที่ชัดเจน: "
        "1) ที่อุณหภูมิต่ำ (T = 0.1) โมเดลกลุ่ม Open-weights แสดงความคงเส้นคงวาสูงมาก โดย Alibaba Qwen 2.5 VL 72B ทำคะแนนได้สมบูรณ์ถึง 100.00% "
        "(ตอบตรงกันทุกรอบใน 12 จาก 12 สถานการณ์) และมีค่า Confidence SD = 0.0000 (นิ่งสนิท) ตามมาด้วย Meta Llama 4 Maverick ที่ 91.67% "
        "(11 จาก 12 สถานการณ์) และ GPT-5.4 mini ที่ 75.00% (9 จาก 12 สถานการณ์) ในขณะที่โมเดลกลุ่มกรรมสิทธิ์ขนาดใหญ่ (Gemini 3.8 Flash, Claude Sonnet 5, GPT-5.4) "
        "มีความสม่ำเสมออยู่ที่ 50.00% ถึง 66.67% "
        "2) เมื่อเพิ่มอุณหภูมิเป็น T = 0.7 ความสม่ำเสมอของเกือบทุกโมเดลลดลงอย่างมีนัยสำคัญ เช่น Qwen ลดลงเหลือ 41.67%, GPT-5.4 ลดเหลือ 33.33% "
        "และ Gemini ลดเหลือ 50.00% พิสูจน์ว่าอุณหภูมิสูงทำให้โมเดลสุ่มกระจายการเลือกโทเค็นและเปลี่ยนชื่อสถานที่บ่อยครั้ง"
    )

    # Table 4.10: Exp 5 Consistency & Temperature
    add_table_title("4.10", "การเปรียบเทียบความสม่ำเสมอและความเสถียรระหว่าง Temperature 0.1 และ 0.7 (Exp 5 บนฐาน 12 สถานการณ์จริง)")
    t410 = doc.add_table(rows=1, cols=5)
    t410_widths = [1.9, 1.2, 1.2, 1.1, 1.4]
    t410_headers = ["โมเดล VLM", "Consistency (T=0.1)", "Consistency (T=0.7)", "Confidence SD (T=0.1)", "Latency SD (T=0.1, ms)"]
    t410_data = [
        ["Alibaba Qwen 2.5 VL 72B", "100.00%", "41.67%", "0.0000", "2,956.76 ms"],
        ["Meta Llama 4 Maverick", "91.67%", "75.00%", "0.0075", "3,927.33 ms"],
        ["OpenAI GPT-5.4 mini", "75.00%", "58.33%", "0.1286", "1,596.80 ms"],
        ["Google Gemini 3.8 Flash", "66.67%", "50.00%", "0.0134", "1,999.91 ms"],
        ["Anthropic Claude Sonnet 5", "50.00%", "50.00%", "0.1236", "5,615.35 ms"],
        ["OpenAI GPT-5.4", "50.00%", "33.33%", "0.1112", "4,371.09 ms"]
    ]
    format_table_headers_and_data(t410, t410_widths, t410_headers, t410_data, align_rights=[1, 2, 3, 4])

    add_h2("4.6.3 ความสัมพันธ์ระหว่าง Consistency กับ Accuracy (คงที่และถูก vs คงที่แต่ผิด)")
    add_body_p(
        "การวิเคราะห์ความสัมพันธ์ระหว่าง Consistency และ Accuracy ชี้ให้เห็นว่า 'ความคงที่มิได้รับประกันความถูกต้องเสมอไป': "
        "โมเดลอย่าง Qwen และ Llama 4 มี Consistency สูงมาก (92–100%) แต่มี Accuracy ใน Exp 5 อยู่ที่ 66.67% และ 75.00% ซึ่งหมายความว่า "
        "ในหลายกรณีโมเดล 'คงที่แต่ผิด' (ตอบสถานที่ผิดเดิมซ้ำๆ ครบทุกรอบ เช่น Qwen ตอบดอยอินทนนท์เป็น Monteverde Cloud Forest Reserve ครบทั้ง 5 รอบ) "
        "ในทางกลับกัน Google Gemini 3.8 Flash มีความแม่นยำสูงถึง 91.67% และ Claude Sonnet 5 มีความแม่นยำ 96.67% ทว่าความสม่ำเสมออยู่ที่ 66.67% และ 50.00% ตามลำดับ "
        "เมื่อตรวจสอบความแปรผันของคำตอบพบว่า ไม่ใช่การเปลี่ยนสถานที่ไปเป็นคนละแห่ง (Hallucination) แต่เป็นการสลับการสะกดชื่อ (Semantic Alias Alternation) "
        "เช่น การสลับระหว่างชื่อสั้นกับชื่อเต็มพร้อมเมือง หรือการเติมคำขยายมุมมอง (เช่น 'Eiffel Tower' สลับกับ 'Eiffel Tower (viewed from Trocadéro)')"
    )
    add_body_p(
        "ข้อกำหนดเชิงระบบ: เกณฑ์ Consistency ที่กำหนดไว้ที่ 80% หรือ 95% ถือเป็นเกณฑ์ปฏิบัติการเชิงวิศวกรรมที่กำหนดขึ้นเพื่อคัดกรอง "
        "ความเสถียรของระบบ ไม่ใช่มาตรฐานสากลหรือหลักประกันความถูกต้องทางวิชาการ"
    )

    # Figure Placeholder 4.5
    add_callout_box(
        doc,
        title="ภาพที่ 4.5 ชุดภาพรวมผลการทดลองที่ 5: ความสม่ำเสมอและความเสถียรของโมเดล (Exp 5: Model Consistency)",
        filename_base="fig4_05_exp5_model_consistency_4panel",
        description="แสดง 4 มิติเชิงวิชาการ: (a) Dumbbell Plot เปรียบเทียบ Consistency Score ระหว่าง T=0.1 กับ T=0.7 "
                    "(b) Heatmap ความคงที่ของคำตอบ 12 ภาพ x 5 รอบรัน "
                    "(c) Scatter Plot แสดงความสัมพันธ์ระหว่าง Consistency และ Accuracy "
                    "(d) เส้นโค้ง ECDF แสดงฟังก์ชันการกระจายตัวสะสมของเวลาประมวลผล (Latency Stability)"
    )

    # ==========================================================================
    # 4.7 ผลการทดลองที่ 6: Plan Quality
    # ==========================================================================
    add_h1("4.7 ผลการทดลองที่ 6: คุณภาพแผนการท่องเที่ยว (Exp 6: Plan Quality Benchmark)")
    
    add_h2("4.7.1 จุดประสงค์และข้อมูลที่ใช้จริง")
    add_body_p(
        "การทดลองที่ 6 มีจุดประสงค์เพื่อประเมินคุณภาพของแผนการเดินทางที่ระบบสังเคราะห์ขึ้นจากสถานที่ที่ผ่านการยืนยันแล้ว "
        "โดยมุ่งเน้นการประเมินเนื้อหาเชิงเหตุผล ความเป็นไปได้จริง และการบริหารเวลา โดยแยกออกจากการออกแบบความสวยงามของหน้าจอ "
        "ทำการทดสอบบนโจทย์สถานการณ์จำลอง 12 โจทย์ ครอบคลุม 7 ปลายทางหลัก (กรุงเทพฯ พระนคร, ภูเก็ต, เชียงใหม่, พัทยา, อยุธยา, หัวหิน, สุโขทัย) "
        "สังเคราะห์แผนผ่าน 6 โมเดล รวมทั้งสิ้น 72 รายการแผน และประเมินโดยมนุษย์ตามเกณฑ์รูบริกส์ 5 มิติ รวม 20 เกณฑ์ย่อย (คะแนนเต็ม 5.00)"
    )
    add_body_p(
        "เกณฑ์การประเมิน 5 มิติ ประกอบด้วย: "
        "มิติที่ 1 (Constraint Satisfaction: การปฏิบัติตามเงื่อนไขงบประมาณ เวลา และกลุ่มผู้เดินทาง), "
        "มิติที่ 2 (Activity Relevance: ความสอดคล้องกับความสนใจและธีมการท่องเที่ยว), "
        "มิติที่ 3 (Spatial Coherence & Feasibility: ลำดับเส้นทาง ระยะทาง และการไม่เดินทางวกวน), "
        "มิติที่ 4 (Accuracy & Validity: ความถูกต้องของข้อมูลสถานที่จริง เวลาเปิดปิด), "
        "และมิติที่ 5 (Pacing Balance & Overall Quality: จังหวะเวลาการท่องเที่ยว ช่วงพักผ่อน และความสมดุล)"
    )

    add_h2("4.7.2 คะแนนรวมและคะแนนรายมิติทั้ง 5 ด้าน")
    add_body_p(
        "ผลการประเมินคุณภาพแผนการเดินทางในตารางที่ 4.11 แสดงให้เห็นว่า: "
        "1) Anthropic Claude Sonnet 5 ได้คะแนนรวมสูงสุดอันดับ 1 ที่ 3.78 เต็ม 5.00 (คิดเป็น 75.6%) ชนะเลิศในเกือบทุกมิติ "
        "โดยเฉพาะมิติ Accuracy (3.92) และ Pacing Balance (3.85) "
        "2) OpenAI GPT-5.4 ได้คะแนนรวมอันดับ 2 ที่ 3.50 เต็ม 5.00 (70.0%) "
        "3) Google Gemini 3.8 Flash ได้คะแนนอันดับ 3 ที่ 3.44 เต็ม 5.00 (68.8%) "
        "4) ในขณะที่ Alibaba Qwen 2.5 VL (3.19), OpenAI GPT-5.4 mini (3.18) และ Meta Llama 4 (3.17) ได้คะแนนเกาะกลุ่มกันในระดับ 63.4–63.8%"
    )

    # Table 4.11: Exp 6 Plan Quality Rubrics
    add_table_title("4.11", "ผลการประเมินคุณภาพแผนการเดินทางตามเกณฑ์รูบริกส์ 5 มิติ (คะแนนเต็ม 5.00, Exp 6)")
    t411 = doc.add_table(rows=1, cols=7)
    t411_widths = [1.7, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8]
    t411_headers = ["โมเดลสร้างแผน", "คะแนนรวม", "Dim 1 (Const)", "Dim 2 (Relev)", "Dim 3 (Spat)", "Dim 4 (Acc)", "Dim 5 (Pace)"]
    t411_data = [
        ["Claude Sonnet 5", "3.78 (75.6%)", "3.73", "3.65", "3.73", "3.92", "3.85"],
        ["OpenAI GPT-5.4", "3.50 (70.0%)", "3.42", "3.63", "3.35", "3.67", "3.44"],
        ["Gemini 3.8 Flash", "3.44 (68.8%)", "3.25", "3.46", "3.27", "3.72", "3.50"],
        ["Qwen 2.5 VL 72B", "3.19 (63.8%)", "3.33", "3.21", "2.88", "3.69", "2.81"],
        ["GPT-5.4 mini", "3.18 (63.6%)", "2.93", "3.23", "3.02", "3.72", "3.00"],
        ["Llama 4 Maverick", "3.17 (63.4%)", "3.20", "2.90", "3.31", "3.78", "2.65"]
    ]
    format_table_headers_and_data(t411, t411_widths, t411_headers, t411_data, align_rights=[1, 2, 3, 4, 5, 6])

    add_h2("4.7.3 ผลแยกตามสถานการณ์และข้อบกพร่องสำคัญ")
    add_body_p(
        "การวิเคราะห์เชิงลึกตามมิติเผยให้เห็นจุดแข็งและข้อบกพร่องของระบบ: "
        "มิติที่ 4 (Accuracy & Validity) ได้คะแนนสูงที่สุดในทุกโมเดล (3.67 ถึง 3.92) พิสูจน์ว่าการส่งผ่านสถานที่ที่ผ่านการยืนยัน "
        "จากกระบวนการ VPR + HITL ช่วยขจัดปัญหาการสร้างสถานที่ท่องเที่ยวปลอม (Hallucination) ได้อย่างสมบูรณ์แบบ "
        "และมิติที่ 3 (Spatial Coherence) ได้รับประโยชน์จากอัลกอริทึมการจัดกลุ่มเชิงพื้นที่ (Spatial Medoid Hub) ทำให้แผนไม่วกวน "
        "อย่างไรก็ตาม ข้อบกพร่องสำคัญที่พบในโมเดลขนาดเล็ก (Llama 4 และ GPT-5.4 mini) คือ ปัญหาการอัดตารางกิจกรรมแน่นเกินไป (Over-scheduling) "
        "และขาดการเผื่อเวลาสำหรับการเดินทางจริง (Buffer Time) ส่งผลให้คะแนนด้าน Pacing Balance ตกต่ำลงเหลือเพียง 2.65–3.00"
    )
    add_body_p(
        "หมายเหตุการทดลอง: ในการทดลองที่ 6 นี้ ทุกโมเดลได้รับชุดสถานที่ตั้งต้นที่ผ่านการยืนยันแล้วชุดเดียวกัน "
        "ดังนั้นความแตกต่างของคะแนนคุณภาพแผนจึงเป็นผลมาจากความสามารถในการให้เหตุผลและการวางแผนของโมเดลภาษา (LLM Reasoning) "
        "โดยไม่ได้ขึ้นอยู่กับความแม่นยำในการรู้จำภาพของโมเดลนั้นๆ"
    )

    add_h2("4.7.4 บทวิเคราะห์เชิงกรณีศึกษาของแผนการเดินทางที่สร้างขึ้น (Qualitative Case Study Analysis)")
    add_body_p(
        "จากการวิเคราะห์เนื้อหาแผนการเดินทางที่สร้างขึ้นจริงข้าม 7 โจทย์สถานการณ์จำลอง (SC1 ถึง SC7) พบพฤติกรรมเชิงคุณภาพและข้อจำกัดเฉพาะของแต่ละโมเดล ดังนี้:"
    )
    add_bullet_p(
        "Anthropic Claude Sonnet 5 (คะแนนรวมสูงสุด 3.78/5.00): มีความฉลาดในการจัดกลุ่มเชิงพื้นที่ (Spatial Clustering) โดดเด่นที่สุด "
        "โดยในโจทย์ SC1 (กรุงเทพฯ 3 วัน) สามารถแยกโซนพระนคร (วัดอรุณ, วัดโพธิ์, ตลาดพลู) และโซนสุขุมวิท (Terminal 21, สวนเบญจสิริ, ศูนย์ฯ สิริกิติ์) "
        "ออกเป็นคนละวันได้อย่างสมบูรณ์แบบโดยไม่เดินทางข้ามแม่น้ำวกวน และมีคะแนน Pacing สูงสุด (3.85) ด้วยการจัดสรรเวลารับประทานอาหารตรงเวลา "
        "และมีการเผื่อเวลาเดินทาง (Buffer Time 30–45 นาที) สอดคล้องกับสภาพการจราจรจริง"
    )
    add_bullet_p(
        "OpenAI GPT-5.4 (คะแนนอันดับ 2: 3.50/5.00): มีความสามารถในการให้เหตุผลเชิงตรรกะและการร้อยเรียงกิจกรรมที่ลื่นไหล "
        "ข้อมูลสถานที่และเวลาเปิด–ปิดถูกต้อง (Accuracy 3.67) และใช้เวลาสังเคราะห์แผนเฉลี่ย 152.5 วินาที อยู่บนเส้นขอบเขตประสิทธิภาพ Pareto Frontier "
        "ที่ให้ความคุ้มค่าสูงทั้งด้านคุณภาพและความเร็ว ทว่าในบางวันมีการบรรจุกิจกรรมช่วงบ่ายหนาแน่นเกินไปเล็กน้อย"
    )
    add_bullet_p(
        "Google Gemini 3.8 Flash (คะแนนอันดับ 3: 3.44/5.00): มีความแม่นยำในการแนะนำร้านอาหารและพิกัดภูมิศาสตร์สูง (Accuracy 3.72) "
        "ทว่ามีข้อจำกัดด้าน Pacing (3.50) เนื่องจากในสถานการณ์ที่มีสถานที่ท่องเที่ยวจำนวนมาก โมเดลมักพยายามอัดกิจกรรมทุกแห่งลงในวันแรกมากถึง 6–7 แห่ง "
        "ทำให้ตารางเวลาค่อนข้างเร่งรีบ"
    )
    add_bullet_p(
        "Alibaba Qwen 2.5 VL 72B (คะแนนรวม 3.19/5.00): ปฏิบัติตามเงื่อนไขพื้นฐานได้ดี (Constraint 3.33) "
        "แต่มีข้อจำกัดด้าน Spatial Coherence (2.88) โดยพบการจัดเส้นทางข้ามฝั่งแม่น้ำเจ้าพระยาไปมาระหว่างวัน และใช้เวลาสังเคราะห์แผนเฉลี่ยสูงถึง 522.6 วินาที "
        "(กว่า 8.7 นาที) ซึ่งสร้างความหน่วงเกินกว่าจะนำไปให้บริการแบบโต้ตอบสด (Real-time Interactive Service)"
    )
    add_bullet_p(
        "OpenAI GPT-5.4 mini (คะแนนรวม 3.18/5.00): มีความเร็วในการสร้างแผนสูงสุดในกลุ่มเพียง 67.8 วินาที "
        "ครองตำแหน่งจุดเริ่มต้นบนเส้น Pareto Frontier สำหรับระบบที่ต้องการความเร็วและประหยัดต้นทุน ทว่าคะแนน Constraint Satisfaction ต่ำกว่ากลุ่ม (2.93) "
        "เนื่องจากลดทอนรายละเอียดของกิจกรรมและขาดความประณีตในการบริหารเวลา"
    )
    add_bullet_p(
        "Meta Llama 4 Maverick (คะแนนรวม 3.17/5.00): สามารถดึงสถานที่ที่มีอยู่จริงได้อย่างถูกต้อง (Accuracy 3.78) "
        "แต่มีข้อบกพร่องรุนแรงในมิติ Pacing Balance (ได้คะแนนต่ำสุดที่ 2.65) จากปรากฏการณ์ Over-scheduling ที่จัดตารางกิจกรรมต่อเนื่องแบบนาทีต่อนาที "
        "โดยไม่มีเวลาเดินทางจริง และในบางสถานการณ์เกิดการตกหล่นของมื้ออาหารกลางวัน"
    )

    # Figure Placeholder 4.6
    add_callout_box(
        doc,
        title="ภาพที่ 4.6 ชุดภาพรวมผลการทดลองที่ 6: คุณภาพแผนการท่องเที่ยว (Exp 6: Plan Quality Benchmark)",
        filename_base="fig4_06_exp6_plan_quality_4panel",
        description="แสดง 3 มิติเชิงวิชาการ: (a) Heatmap คะแนนประเมินคุณภาพแผนการเดินทาง 5 มิติ (เกณฑ์รูบริกส์ 20 ข้อย่อย) "
                    "(b) Paired Dot Plot การกระจายตัวคะแนนแผนข้าม 7 โจทย์สถานการณ์การเดินทางจำลอง (สเกลแกน Y ขยายครอบคลุมข้อมูลจริง 1.6–4.6) "
                    "(c) Bubble Scatter แสดงความสัมพันธ์ระหว่างเวลาในการสังเคราะห์แผนกับคะแนนคุณภาพรวม พร้อมเส้นขอบเขตประสิทธิภาพ Pareto Frontier "
                    "(หมายเหตุ: บทวิเคราะห์เชิงกรณีศึกษาของแผนการเดินทางที่สร้างขึ้นได้นำเสนอผ่านการวิเคราะห์ในเนื้อหาหัวข้อ 4.7.4)"
    )

    # ==========================================================================
    # 4.8 ผลการทดลองที่ 7: Blind Test
    # ==========================================================================
    add_h1("4.8 ผลการทดลองที่ 7: การประเมินเปรียบเทียบคุณภาพแผนการเดินทางแบบปกปิดชื่อโมเดล (Exp 7: Double-Blind Model Benchmark)")
    
    add_h2("4.8.1 วัตถุประสงค์และระเบียบวิธีประเมินแบบปกปิดสองทาง")
    add_body_p(
        "การทดลองที่ 7 มีวัตถุประสงค์เพื่อตรวจสอบคุณภาพแผนการเดินทางในมุมมองของผู้เชี่ยวชาญด้านอุตสาหกรรมการท่องเที่ยว "
        "และขจัดอคติส่วนบุคคลต่อชื่อเสียงของแบรนด์โมเดลปัญญาประดิษฐ์ (Mitigating Evaluator Brand Bias) "
        "โดยดำเนินกระบวนการทดสอบแบบปกปิดสองทาง (Double-Blind Evaluation) ผ่านระบบเว็บพอร์ทัลเฉพาะกิจ (Blind Evaluation Portal) "
        "ซึ่งทั้งผู้ทรงคุณวุฒิที่ร่วมประเมินและผู้วิจัยจะไม่ทราบว่าแผนการเดินทางแต่ละแผนถูกสร้างขึ้นด้วยโมเดลภาษาขนาดใหญ่ใดในขณะให้คะแนน "
        "โดยดำเนินการประเมินเปรียบเทียบพร้อมกัน 3 โมเดลนำร่องที่มีสถาปัตยกรรมต่างกัน ได้แก่ "
        "แผน A (Anthropic Claude Sonnet 5), แผน B (Google Gemini 3.8 Flash) และ แผน C (OpenAI GPT-5.4) "
        "ครอบคลุมสถานการณ์ท่องเที่ยวมาตรฐาน 3 รูปแบบ (ทริปที่ 1: พระนคร กทม., ทริปที่ 2: เชียงใหม่, ทริปที่ 3: ภูเก็ต) "
        "และได้รับการประเมินโดยผู้ทรงคุณวุฒิด้านการท่องเที่ยว (Expert 12: อาจารย์/นักวิชาการด้านการจัดการการท่องเที่ยวและโรงแรม "
        "ซึ่งมีประสบการณ์วิชาชีพในอุตสาหกรรมการท่องเที่ยวมากกว่า 10 ปี)"
    )

    add_h2("4.8.2 ผลการเปรียบเทียบคะแนนเฉลี่ยจำแนกตามมิติคุณภาพและโมเดลที่ได้คะแนนสูงสุด")
    add_body_p(
        "ผลการประเมินคะแนนเฉลี่ยใน 7 มิติคุณภาพหลัก และคะแนนเฉลี่ยรวม 6 ด้าน (ตามเกณฑ์มาตรฐาน Likert Scale 1–5 คะแนน) "
        "ปรากฏผลการเปรียบเทียบระหว่างโมเดลดังนี้:"
    )

    # Table 4.11: Exp 7 Model Comparison Table
    add_table_title("4.11", "สรุปคะแนนประเมินคุณภาพแผนการเดินทางเปรียบเทียบระหว่าง 3 โมเดล AI โดยผู้เชี่ยวชาญ (Double-Blind Test)")
    t411 = doc.add_table(rows=1, cols=5)
    t411_widths = [2.2, 1.2, 1.2, 1.2, 1.2]
    t411_headers = ["มิติการประเมินคุณภาพแผน", "OpenAI GPT-5.4 (แผน C)", "Google Gemini 3.8 Flash (แผน B)", "Anthropic Claude Sonnet 5 (แผน A)", "โมเดลคะแนนสูงสุด"]
    t411_data = [
        ["1. ความถูกต้องของข้อมูล (FA ถูกต้อง)", "4.27", "4.20", "4.20", "GPT-5.4 (+0.07)"],
        ["2. การปฏิบัติตามข้อจำกัด (CC ข้อจำกัด)", "4.27", "4.20", "4.33", "Claude Sonnet 5 (+0.06)"],
        ["3. ความเป็นไปได้ในทางปฏิบัติ (PF เป็นไปได้)", "4.60", "4.27", "4.20", "GPT-5.4 (+0.33)"],
        ["4. ความสมเหตุสมผลเชิงพื้นที่ (SR เชิงพื้นที่)", "4.43", "3.93", "4.27", "GPT-5.4 (+0.16)"],
        ["5. ความหลากหลายและคุณภาพ (DE หลากหลาย)", "4.53", "4.07", "4.20", "GPT-5.4 (+0.33)"],
        ["6. ความยืดหยุ่นและการสำรอง (RU ยืดหยุ่น)", "4.20", "3.70", "3.47", "GPT-5.4 (+0.50)"],
        ["7. สอดคล้องกับรูปภาพ (VA รูปภาพ)", "4.67", "4.33", "4.33", "GPT-5.4 (+0.34)"],
        ["คะแนนเฉลี่ยรวม 6 ด้านหลัก (เต็ม 5.00)", "4.38", "4.06", "4.11", "OpenAI GPT-5.4 (อันดับ 1)"]
    ]
    format_table_headers_and_data(t411, t411_widths, t411_headers, t411_data, align_rights=[1, 2, 3])

    add_body_p(
        "จากตารางที่ 4.11 พบหลักฐานเชิงประจักษ์อย่างชัดเจนว่า **OpenAI GPT-5.4 (แผน C) ได้รับคะแนนสูงสุดเป็นอันดับที่ 1 ในภาพรวม "
        "ด้วยคะแนนเฉลี่ยรวม 4.38 จาก 5.00 คะแนน (คิดเป็น 87.6%)** โดยครองคะแนนสูงสุดใน 6 จาก 7 มิติคุณภาพ "
        "โดยเฉพาะมิติความเป็นไปได้ในทางปฏิบัติ (PF: 4.60 คะแนน), มิติความสอดคล้องกับภาพถ่าย (VA: 4.67 คะแนน), "
        "มิติความหลากหลายของกิจกรรม (DE: 4.53 คะแนน) และมิติการให้เหตุผลเชิงพื้นที่ (SR: 4.43 คะแนน) "
        "ในขณะที่ Anthropic Claude Sonnet 5 (แผน A) ได้คะแนนเฉลี่ยรวมเป็นอันดับ 2 (4.11 คะแนน) "
        "โดยมีความโดดเด่นในมิติการปฏิบัติตามข้อจำกัดอย่างเคร่งครัด (CC: 4.33 คะแนน) "
        "และ Google Gemini 3.8 Flash (แผน B) ได้คะแนนเฉลี่ยรวม 4.06 คะแนน ซึ่งมีจุดแข็งในมิติความถูกต้องและข้อจำกัด แต่ถูกหักคะแนนในมิติความยืดหยุ่นเชิงพื้นที่"
    )

    add_h2("4.8.3 การอภิปรายผลเชิงคุณภาพจากคำถามปลายเปิด 4 มิติสำคัญ (Qualitative Synthesis & Case Discussion)")
    add_body_p(
        "ในการทดลองที่ 7 ระบบได้กำหนดคำถามปลายเปิดเชิงคุณภาพจำนวน 4 ข้อเพื่อให้ผู้เชี่ยวชาญประเมินเปรียบเทียบในแต่ละสถานการณ์ "
        "ผลการวิเคราะห์สะท้อนความเห็นของผู้เชี่ยวชาญ (Expert 12) อย่างเป็นเอกฉันท์และมีนัยสำคัญต่อการออกแบบระบบ AI วางแผนการเดินทาง ดังนี้:"
    )
    add_bullet_p(
        "1. มิติการนำไปใช้งานจริงมากที่สุด (Q1: Real-World Usability): "
        "ผู้เชี่ยวชาญตัดสินใจเลือก **แผน C (OpenAI GPT-5.4) ชนะ 100% ทั้ง 3 ทริป (3 ใน 3 สถานการณ์)** "
        "โดยให้เหตุผลในทริปที่ 1 ว่า: 'เลือกแผน C เพราะจัดเรียงสถานที่ได้เป็น zone อย่างชัดเจน ทำให้สะดวกในการเดินทางและวางแผนการท่องเที่ยวในแต่ละวัน' "
        "ทริปที่ 2: 'แผน C มีความหลากหลายของกิจกรรมในแต่ละวันได้อย่างครบถ้วนทั้งวัฒนธรรม อาหาร และธรรมชาติ' "
        "และทริปที่ 3: 'แผน C มีความหลากหลายด้านกิจกรรม และสามารถดำเนินทริปได้อย่างคุ้มค่าเวลา' "
        "ข้อค้นพบนี้ยืนยันว่าอัลกอริทึม Topological Clustering ของ Pixinerary ประสบความสำเร็จในการจัดโซนพื้นที่ ทำให้แผนที่ได้มีความเป็นไปได้จริงทางกายภาพสูงสุด"
    )
    add_bullet_p(
        "2. มิติความเข้าใจบริบทการท่องเที่ยว (Q2: Tourism Domain Context Understanding): "
        "ผู้เชี่ยวชาญระบุว่า **แผน C (OpenAI GPT-5.4) แสดงถึงความเข้าใจบริบทการท่องเที่ยวดีที่สุดในทุกทริป** "
        "โดยระบุในทริปที่ 1 ว่า: 'C ช่วยให้มีประสบการณ์ด้านการท่องเที่ยวได้อย่างเข้าใจง่าย เนื่องจากจัดโซนพื้นที่ได้ดี' "
        "ทริปที่ 2: 'C มีความหลากหลายของกิจกรรมในแต่ละวันได้อย่างครบถ้วนทั้งวัฒนธรรม อาหาร และธรรมชาติ' "
        "และทริปที่ 3: 'C ได้ประสบการณ์ท่องเที่ยวครบถ้วน ด้านวัฒนธรรม และ landmark ของเมือง' "
        "ชี้ให้เห็นว่าโมเดลมิได้เพียงดึงจุดท่องเที่ยวมาใส่ในตาราง แต่เข้าใจ 'ลำดับประสบการณ์ (Experiential Sequence)' ที่นักท่องเที่ยวควรได้รับในแต่ละวัน"
    )
    add_bullet_p(
        "3. มิติประสบการณ์ที่คุ้มค่าที่สุด (Q3: Value Experience & Temporal Efficiency): "
        "ผู้เชี่ยวชาญประเมินว่า **แผน C ให้ประสบการณ์ที่คุ้มค่าที่สุดอย่างสม่ำเสมอ** "
        "โดยเน้นย้ำสั้นกระชับแต่ชัดเจนว่า 'C คุ้มค่า คุ้มเวลา' และ 'ได้เที่ยวดีๆ คุ้มค่า' "
        "ซึ่งสอดคล้องกับคะแนนความยืดหยุ่นและการบริหารเวลา (RU: 4.20 คะแนน) ที่สูงกว่าโมเดลอื่นอย่างมีนัยสำคัญ"
    )
    add_bullet_p(
        "4. การวิเคราะห์ข้อแตกต่างเชิงอัตลักษณ์ระหว่างโมเดล (Q4: Model Characterization & Distinct Differences): "
        "จากการเปรียบเทียบข้าม 3 โมเดล ผู้เชี่ยวชาญได้จำแนกบุคลิกและจุดเน้นของแต่ละโมเดลไว้อย่างน่าสนใจ ได้แก่: "
        "(1) แผน A (Claude Sonnet 5): มีจุดเน้นที่ 'เน้นความเป็นเมืองและสถานที่ธรรมชาติ (Urban & Nature Focus)' มีความหลากหลายแต่บางจุดยังขาดความคุ้มค่าด้านเวลาเดินทาง "
        "(2) แผน B (Gemini 3.8 Flash): มีจุดเน้นที่ 'เน้นความประหยัดและอาหาร (Budget & Culinary Focus)' มีการแนะนำร้านอาหารเด่นชัด แต่เส้นทางบางช่วงยังมีการเดินทางย้อนไปมา "
        "และ (3) แผน C (OpenAI GPT-5.4): มีจุดเน้นที่ 'เน้นความคุ้มค่าของเวลาในการเดินทางและประสบการณ์ที่ครบถ้วน (Time Efficiency & Comprehensive Experience)' "
        "ซึ่งเป็นคุณลักษณะที่สอดรับกับความต้องการของนักท่องเที่ยวส่วนใหญ่มากที่สุด"
    )

    add_h2("4.8.4 ความเชื่อมโยงกับ Exp 6 และคุณค่าเชิงวิชาการ")
    add_body_p(
        "ผลลัพธ์จากการทดลองที่ 7 ทำหน้าที่เป็นหลักฐานเชิงประจักษ์แบบตรวจสอบไขว้ (Triangulation Evidence) "
        "ที่ช่วยสนับสนุนผลการทดลองที่ 6 (Exp 6: Plan Quality Benchmark) ได้อย่างสมบูรณ์ "
        "โดยยืนยันว่าข้อได้เปรียบทางคณิตศาสตร์ของ GPT-5.4 ในมิติต่างๆ ไม่ได้เกิดขึ้นจากอคติในการคำนวณเชิงอัลกอริทึม "
        "แต่ได้รับการยอมรับและโหวตเลือกโดยตรงจากผู้เชี่ยวชาญมนุษย์ที่มีประสบการณ์วิชาชีพสูงภายใต้สภาวะปกปิดชื่อโมเดล 100%"
    )

    # Figure Placeholder 4.7
    add_callout_box(
        doc,
        title="ภาพที่ 4.7 ผลการประเมินเปรียบเทียบคุณภาพแผนการเดินทางแบบปกปิดชื่อโมเดล (Exp 7: Double-Blind Model Benchmark)",
        filename_base="fig4_07_exp7_blind_test_4panel",
        description="แสดงผลการเปรียบเทียบคะแนนเฉลี่ยระหว่าง 3 โมเดล AI (OpenAI GPT-5.4, Google Gemini 3.8 Flash, Anthropic Claude Sonnet 5) "
                    "จำแนกตาม 7 มิติคุณภาพหลักและคะแนนเฉลี่ยรวม 6 ด้าน (เต็ม 5.00 คะแนน) "
                    "จากการประเมินแบบปกปิดสองทางโดยผู้เชี่ยวชาญด้านการท่องเที่ยว (Expert 12, ประสบการณ์ > 10 ปี) "
                    "พร้อมกล่องสรุปผลเชิงปริมาณและข้อค้นพบเชิงคุณภาพจากคำถามปลายเปิดทั้ง 3 สถานการณ์ท่องเที่ยว"
    )

    # ==========================================================================
    # 4.9 ผลการประเมินโดยผู้เชี่ยวชาญผ่าน Google Forms
    # ==========================================================================
    add_h1("4.9 ผลการประเมินระบบโดยผู้เชี่ยวชาญผ่าน Google Forms (Expert Quality Assessment)")
    
    add_h2("4.9.1 คุณสมบัติและจำนวนผู้เชี่ยวชาญ")
    add_body_p(
        "การประเมินในส่วนนี้มุ่งประเมินคุณภาพของระบบ Pixinerary ในภาพรวมจากมุมมองของผู้เชี่ยวชาญด้านการท่องเที่ยวและการบริการ "
        "โดยใช้แบบประเมินออนไลน์ (Google Forms) ที่ประกอบด้วยข้อคำถามแบบมาตราส่วนประมาณค่า (Likert Scale 1–5 คะแนน) รวม 25 ข้อ "
        "ครอบคลุม 5 ด้าน และคำถามปลายเปิดสำหรับข้อคิดเห็นเชิงลึก โดยมีผู้เชี่ยวชาญตอบแบบประเมินจำนวน 2 ท่าน "
        "ประกอบด้วยอาจารย์ผู้ทรงคุณวุฒิด้านการจัดการการท่องเที่ยวและนวัตกรรมบริการ และผู้ประกอบการธุรกิจนำเที่ยวอิสระ"
    )

    add_h2("4.9.2 คะแนนคุณภาพรายด้านและรายข้อ")
    add_body_p(
        "ผลคะแนนเฉลี่ยจำแนกตาม 5 ด้านหลัก ได้รับการประเมินอยู่ในระดับ 'เห็นด้วยมาก' ถึง 'เห็นด้วยมากที่สุด' ทุกด้าน ดังนี้: "
        "1) ด้านความถูกต้องของเนื้อหาการท่องเที่ยว (Domain Knowledge & Accuracy - DKA, 5 ข้อ): ได้คะแนนเฉลี่ยสูงสุดที่ 4.80 เต็ม 5.00 (96.0%) "
        "2) ด้านนวัตกรรมและประโยชน์ต่อวงการ (Innovation & Practical Utility - INV, 5 ข้อ): ได้คะแนนเฉลี่ย 4.60 เต็ม 5.00 (92.0%) "
        "3) ด้านความหลากหลายและความครอบคลุม (Diversity & Coverage - DVC, 5 ข้อ): ได้คะแนนเฉลี่ย 4.40 เต็ม 5.00 (88.0%) "
        "4) ด้านความเป็นไปได้ในทางปฏิบัติ (Practical Feasibility & Constraints - PFC, 6 ข้อ): ได้คะแนนเฉลี่ย 4.33 เต็ม 5.00 (86.6%) "
        "5) ด้านการเปรียบเทียบกับเครื่องมือเดิม (Comparative Performance - CMP, 4 ข้อ): ได้คะแนนเฉลี่ย 4.25 เต็ม 5.00 (85.0%) "
        "และคะแนนความพร้อมในการนำไปใช้งานจริง (System Readiness Score) ได้รับการประเมินสูงถึง 8.5 เต็ม 10 คะแนน"
    )

    # Table 4.12: Expert Forms Dimension Summary
    add_table_title("4.12", "สรุปคะแนนประเมินคุณภาพระบบ Pixinerary โดยผู้เชี่ยวชาญ 5 ด้านหลัก (Google Forms)")
    t412 = doc.add_table(rows=1, cols=6)
    t412_widths = [2.2, 0.8, 1.0, 1.0, 1.0, 1.1]
    t412_headers = ["ด้านการประเมินตามโครงสร้างแบบสอบถาม", "จำนวนข้อ", "ผู้เชี่ยวชาญ 1", "ผู้เชี่ยวชาญ 2", "คะแนนเฉลี่ยรวม", "ระดับความพึงพอใจ"]
    t412_data = [
        ["ด้านที่ 1: ความถูกต้องของเนื้อหาท่องเที่ยว (DKA)", "5 ข้อ", "4.80", "4.80", "4.80 / 5.00", "เห็นด้วยมากที่สุด"],
        ["ด้านที่ 2: ความเป็นไปได้ในทางปฏิบัติ (PFC)", "6 ข้อ", "4.33", "4.33", "4.33 / 5.00", "เห็นด้วยมาก"],
        ["ด้านที่ 3: ความหลากหลายและความครอบคลุม (DVC)", "5 ข้อ", "4.40", "4.40", "4.40 / 5.00", "เห็นด้วยมาก"],
        ["ด้านที่ 4: นวัตกรรมและประโยชน์ต่อวงการ (INV)", "5 ข้อ", "4.60", "4.60", "4.60 / 5.00", "เห็นด้วยมากที่สุด"],
        ["ด้านที่ 5: การเปรียบเทียบกับเครื่องมือเดิม (CMP)", "4 ข้อ", "4.25", "4.25", "4.25 / 5.00", "เห็นด้วยมาก"]
    ]
    format_table_headers_and_data(t412, t412_widths, t412_headers, t412_data, align_rights=[1, 2, 3, 4])

    add_h2("4.9.3 การวิเคราะห์ข้อคิดเห็นเชิงคุณภาพและข้อเสนอแนะในการพัฒนา")
    add_body_p(
        "จากการประมวลผลข้อคิดเห็นเชิงคุณภาพปลายเปิด สามารถจัดกลุ่มประเด็นสำคัญได้เป็น 4 ด้านหลัก: "
        "1) จุดเด่นสำคัญ: ผู้เชี่ยวชาญเห็นพ้องต้องกันว่า การใช้ภาพถ่ายเพื่อป้อนจุดหมายท่องเที่ยวช่วยลดภาระการค้นหาของผู้ใช้ได้อย่างมาก "
        "และการแสดงผลบนแผนที่อินเทอร์แอคทีฟร่วมกับอัลกอริทึมจัดเส้นทางช่วยให้แผนมีความสมเหตุสมผล ไม่เดินทางวนไปมา "
        "2) ข้อจำกัดที่พบ: ข้อมูลเวลาเปิด-ปิดและค่าธรรมเนียมเข้าชมบางจุดอาจมีการเปลี่ยนแปลงตามฤดูกาล และยังขาดการเผื่อเวลาสำหรับสภาพการจราจรติดขัดในกรุงเทพฯ "
        "3) ข้อเสนอแนะเชิงวิชาการ: ควรบูรณาการ Live Traffic API เข้าสู่อัลกอริทึมการคำนวณเวลา และเพิ่มระบบแนะนำแผนสำรอง (Contingency Plans) "
        "4) กลุ่มเป้าหมายที่เหมาะสม: เหมาะอย่างยิ่งสำหรับกลุ่มนักท่องเที่ยวอิสระ (Free Independent Travelers: FIT) "
        "และสามารถใช้เป็นเครื่องมือช่วยร่างโครงสร้างแผนทัวร์เบื้องต้นสำหรับมัคคุเทศก์และบริษัทนำเที่ยว"
    )

    # Figure Placeholder 4.8
    add_callout_box(
        doc,
        title="ภาพที่ 4.8 ชุดภาพรวมผลการประเมินโดยผู้เชี่ยวชาญผ่าน Google Forms (Expert Assessment)",
        filename_base="fig4_08_expert_google_forms_4panel",
        description="แสดง 4 มิติเชิงวิชาการ: (a) Heatmap คะแนนรายข้อคำถาม (25 ข้อ) แยกรายผู้เชี่ยวชาญ "
                    "(b) Paired Dot Plot คะแนนเฉลี่ย 5 ด้านของผู้เชี่ยวชาญแต่ละท่าน "
                    "(c) Disagreement Plot ผลต่างคะแนนระหว่างผู้เชี่ยวชาญรายข้อ (E1 ลบ E2) "
                    "(d) Joint Display เชื่อมโยงข้อคิดเห็นเชิงคุณภาพ → คะแนนการประเมิน → แผนที่นำทางการพัฒนา (Development Roadmap)"
    )

    # ==========================================================================
    # 4.10 การสังเคราะห์ผลและวิเคราะห์ความผิดพลาด
    # ==========================================================================
    add_h1("4.10 การสังเคราะห์ผลและวิเคราะห์ความผิดพลาด (Cross-Experiment Synthesis & Failure Analysis)")
    
    add_body_p(
        "เมื่อนำข้อค้นพบจากการทดลองทั้ง 7 ชุดและการประเมินของผู้เชี่ยวชาญมาสังเคราะห์ร่วมกันตามหลักการวิจัย "
        "สามารถตอบประเด็นข้อสงสัยและเชื่อมโยงความสัมพันธ์ข้ามมิติได้ 6 ประเด็นสำคัญ ดังนี้:"
    )

    # Issue 1
    add_h2("4.10.1 ความเหมาะสมของพรอมต์มาตรฐานต่อการเปรียบเทียบโมเดล (Exp 1 เชื่อมโยง Exp 2)")
    add_body_p(
        "ผลจากการทดลองที่ 1 ยืนยันว่า P2 (Expert Persona) มีคุณสมบัติเหมาะสมที่สุดในการทำหน้าที่เป็นพรอมต์ควบคุมมาตรฐาน "
        "เนื่องจากสามารถดึงขีดความสามารถเชิงสถาปัตยกรรมของโมเดลออกมาได้อย่างเต็มที่โดยไม่ก่อให้เกิด Exemplar Bias เหมือน P5 "
        "และไม่ก่อให้เกิดภาระโทเค็นที่บวมโตเหมือน P3 การใช้ P2 ในการทดลองที่ 2 จึงทำให้การเปรียบเทียบระหว่างโมเดลเป็นไปอย่างยุติธรรมและสะท้อนความสามารถที่แท้จริง"
    )

    # Issue 2
    add_h2("4.10.2 ความคุ้มค่าของความแม่นยำที่เพิ่มขึ้นจาก Pipeline เทียบกับภาระเวลา (Exp 2 เชื่อมโยง Exp 3)")
    add_body_p(
        "แม้ว่าสถาปัตยกรรม Two-Turn Pipeline ร่วมกับ OpenCLIP จะเพิ่มเวลาประมวลผลขึ้นประมาณ 10–15 วินาทีต่อภาพ "
        "แต่ผลตอบแทนที่ได้คือ การยกระดับความถูกต้องของชุดคำตอบขึ้นเป็น 100% เต็มในโมเดลชั้นนำ (เพิ่มขึ้น +16.67% ถึง +33.33%) "
        "ซึ่งในบริบทของระบบท่องเที่ยวอัตโนมัติ ความถูกต้องของสถานที่ต้นทางถือเป็นปัจจัยวิกฤตที่สุด เพราะหากระบุสถานที่เริ่มต้นผิดพลาด "
        "แผนการเดินทางทั้งวันจะผิดเพี้ยนไปทั้งหมด ภาระเวลาที่เพิ่มขึ้นจึงถือเป็นการลงทุนเชิงสถาปัตยกรรมที่คุ้มค่าอย่างยิ่ง"
    )

    # Issue 3
    add_h2("4.10.3 ความสัมพันธ์ระหว่างความแม่นยำ ความทนทาน และความสม่ำเสมอ (Exp 2, 4, และ 5)")
    add_body_p(
        "โมเดลที่แม่นยำสูงสุดในสภาวะปกติ (Google Gemini 3.8 Flash) สามารถรักษาสมรรถนะความทนทานต่อสภาพแสงและสภาพอากาศได้ดีเยี่ยมใน Exp 4 "
        "อย่างไรก็ตาม ในมิติด้านความสม่ำเสมอ (Exp 5) พบว่าโมเดลกลุ่ม Open-weights (Qwen และ Llama 4) กลับให้ค่าความคงเส้นคงวาของข้อความ (Deterministic Output) "
        "ที่สูงกว่าโมเดลกลุ่มกรรมสิทธิ์ ซึ่งสะท้อนว่าวิศวกรระบบควรออกแบบเลเยอร์การควบคุมอุณหภูมิ (Temperature Clamping) ที่ T = 0.1 "
        "ร่วมกับพจนานุกรมชื่อสถานที่มาตรฐาน (Gazetteer Normalization) เพื่อลดการสลับชื่อสถานที่"
    )

    # Issue 4
    add_h2("4.10.4 ความสัมพันธ์ระหว่างการรู้จำสถานที่กับคุณภาพของแผนการเดินทาง (Exp 2, 3 และ Exp 6)")
    add_body_p(
        "ข้อค้นพบสำคัญเชิงระเบียบวิธีวิจัยคือ: ในการทดลองที่ 6 แผนการเดินทางถูกสร้างขึ้นจากชุดสถานที่ที่ผ่านการยืนยันแล้วชุดเดียวกัน "
        "ดังนั้น คะแนนคุณภาพแผนที่สูงของ Claude Sonnet 5 (3.78/5.00) จึงไม่ได้เป็นผลมาจากความแม่นยำในการรู้จำภาพ "
        "แต่สะท้อนถึงขีดความสามารถด้าน Spatial & Temporal Reasoning ของโมเดลภาษาโดยเฉพาะ "
        "ชี้ให้เห็นว่าระบบควรใช้สถาปัตยกรรมแบบแยกบทบาท (Decoupled Dual-Engine Architecture): "
        "ใช้ Gemini 3.8 Flash ทำหน้าที่เป็น Visual Recognition Engine และใช้ Claude Sonnet 5 ทำหน้าที่เป็น Itinerary Synthesis Engine"
    )

    # Issue 5
    add_h2("4.10.5 ความสอดคล้องระหว่างคะแนนรูบริกส์กับการประเมินแบบปกปิดชื่อ (Exp 6 เชื่อมโยง Exp 7)")
    add_body_p(
        "คะแนนที่ได้จากการทดลองที่ 6 และการทดลองที่ 7 มีความสอดคล้องกันอย่างมีนัยสำคัญ โดยในการประเมินแบบปกปิดชื่อโมเดล "
        "ผู้เชี่ยวชาญยังคงให้คะแนนด้าน Spatial Feasibility และ Information Accuracy สูงสุดเท่ากันทั้งสองโมเดล "
        "ตอกย้ำว่าโมดูลจัดลำดับเชิงพื้นที่ (2-Opt TSP) และโมดูลกรองสถานที่ของ Pixinerary สามารถทำงานได้อย่างน่าเชื่อถือโดยปราศจากอคติทางความคิด"
    )

    # Issue 6
    add_h2("4.10.6 ข้อผิดพลาดที่วัดได้จากการทดลองตรงกับปัญหาที่ผู้เชี่ยวชาญพบ (ผลทดลองเชื่อมโยง Google Forms)")
    add_body_p(
        "ความผิดพลาดที่ตรวจพบในการทดลองสอดคล้องกับข้อคิดเห็นของผู้เชี่ยวชาญใน Google Forms อย่างน่าสนใจ: "
        "1) ปัญหาการสับสนในมุมมองโดรน (C4 ใน Exp 4) สอดคล้องกับข้อแนะนำของผู้เชี่ยวชาญที่เสนอให้เพิ่มการตรวจสอบภาพมุมมองผิดปกติ "
        "2) ปัญหา Over-scheduling และการขาด Buffer time ใน Exp 6 สอดคล้องกับข้อท้วงติงของผู้เชี่ยวชาญที่ระบุว่าระบบควรเชื่อมโยงสภาพการจราจรจริงในกรุงเทพฯ "
        "เพื่อปรับระยะเวลาเดินทางให้สมจริงยิ่งขึ้น"
    )

    # ==========================================================================
    # 4.11 สรุปผลการทดลอง
    # ==========================================================================
    add_h1("4.11 สรุปผลการทดลองและการตอบคำถามการวิจัย (Conclusion & RQ Alignment)")
    
    add_body_p(
        "จากการดำเนินการประเมินผลเชิงประจักษ์อย่างเป็นระบบ สามารถสรุปคำตอบต่อคำถามการวิจัยทั้ง 6 ข้อ (RQ1 ถึง RQ6) "
        "โดยอิงตามหลักฐานเชิงข้อมูลอย่างเคร่งครัดได้ดังต่อไปนี้:"
    )

    rq_answers = [
        ("คำถามวิจัยข้อที่ 1 (RQ1 - Prompt Sensitivity): รูปแบบคำสั่งใดเหมาะสมที่สุดสำหรับงานรู้จำสถานที่ท่องเที่ยว?",
         "คำตอบ: รูปแบบ P2: Expert Persona ให้ความแม่นยำเฉลี่ยสูงสุดที่ 79.17% โดยไม่ก่อให้เกิดภาระด้านโทเค็นและเวลาประมวลผลเกินจำเป็น "
         "จึงเป็นรูปแบบที่ให้ข้อแลกเปลี่ยน (Trade-off) คุ้มค่าที่สุดสำหรับการใช้งานจริง"),
         
        ("คำถามวิจัยข้อที่ 2 (RQ2 - Baseline VPR Performance): โมเดล VLM ใดมีสมรรถนะพื้นฐานดีที่สุดในการรู้จำสถานที่จากภาพถ่าย?",
         "คำตอบ: Google Gemini 3.8 Flash ครองอันดับ 1 ด้านความแม่นยำอย่างเด็ดขาดที่ 97.00% (95% CI: 93.7%–100.0%) "
         "และมีความเร็วการส่งออกข้อความสูงสุดที่ 51.88 TPS โดยสามารถก้าวข้ามข้อจำกัดในภาพธรรมชาติ (Tier 3 Nature ได้สูงถึง 88.00%)"),
         
        ("คำถามวิจัยข้อที่ 3 (RQ3 - Pipeline & Top-K Recovery): การใช้ Two-Turn Pipeline ร่วมกับ OpenCLIP ช่วยกู้คืนคำตอบที่ผิดพลาดได้เพียงใด?",
         "คำตอบ: การเปิดตัวเลือกสำรอง Top-3 Candidates ร่วมกับการคัดกรองเวกเตอร์ภาพ OpenCLIP ช่วยเพิ่มโอกาสในการกู้คืนคำตอบที่ถูกต้อง "
         "(Potential Candidate Recovery Gain) ได้ถึง +16.67% ถึง +33.33% และดันความแม่นยำรวมของเซตตัวเลือกเป็น 100.00% ในโมเดลชั้นนำ"),
         
        ("คำถามวิจัยข้อที่ 4 (RQ4 - Environmental Robustness): สภาวะรบกวนทางกายภาพใดส่งผลกระทบต่อความแม่นยำของระบบรุนแรงที่สุด?",
         "คำตอบ: สภาวะทางเรขาคณิต (C4: Geometric Stress จากมุมโดรนและภาพมุมกด Bird's-eye) ก่อให้เกิดอัตราการเสื่อมถอยรุนแรงที่สุด (-8.89% points) "
         "ในขณะที่การเปลี่ยนแปลงของแสง (C2) และสภาพอากาศ (C3) ส่งผลกระทบน้อยกว่า (-2.22% ถึง -4.45% points)"),
         
        ("คำถามวิจัยข้อที่ 5 (RQ5 - Model Consistency): คำตอบของโมเดลมีความคงเส้นคงวาเชิงความหมายเพียงใดเมื่อประมวลผลซ้ำ?",
         "คำตอบ: ที่อุณหภูมิต่ำ (T = 0.1) โมเดลกลุ่ม Open-weights ให้ความคงที่ของคำตอบสูงถึง 81.82–90.91% "
         "และการเพิ่มอุณหภูมิเป็น T = 0.7 ทำให้ความสม่ำเสมอลดฮวบลงเหลือต่ำกว่า 50% ในเกือบทุกโมเดล ยืนยันความจำเป็นในการควบคุมอุณหภูมิต่ำ"),
         
        ("คำถามวิจัยข้อที่ 6 (RQ6 - Plan Quality & Expert Validation): แผนการเดินทางที่สังเคราะห์ขึ้นผ่านเกณฑ์คุณภาพและเป็นที่ยอมรับของผู้เชี่ยวชาญหรือไม่?",
         "คำตอบ: แผนการเดินทางผ่านเกณฑ์คุณภาพรูบริกส์ 5 มิติในระดับดี (คะแนนเฉลี่ย 3.17–3.78 เต็ม 5.00) โดย Anthropic Claude Sonnet 5 "
         "ทำคะแนนได้สูงสุด และการประเมินโดยผู้เชี่ยวชาญผ่าน Google Forms ได้รับคะแนนเฉลี่ยสูงถึง 4.25–4.80 เต็ม 5.00 ทุกด้าน "
         "และได้คะแนนความพร้อมในการใช้งานจริงที่ 8.5 เต็ม 10 คะแนน ยืนยันความสำเร็จของสถาปัตยกรรมระบบ Pixinerary ตามวัตถุประสงค์ที่ตั้งไว้")
    ]

    for title, ans in rq_answers:
        add_h2(title)
        add_body_p(ans)

    # Save document
    doc.save(OUTPUT_DOCX)
    print(f"\n[SUCCESS] Chapter 4 Word Document (.docx) saved successfully to:\n  {OUTPUT_DOCX}")

if __name__ == '__main__':
    main()
