# -*- coding: utf-8 -*-
"""
Helper to write D:/scriptบท3/script.py and execute it.
"""
import os
import shutil

target_script = 'D:/scriptบท3/script.py'

script_code = '''# -*- coding: utf-8 -*-
"""
Pixinerary - Chapter 3 Image Collage Generator
================================================
สคริปต์สร้างรูปคอลลาจภาพทดสอบสำหรับใส่ในเล่มวิทยานิพนธ์ บทที่ 3
1. รวมภาพแต่ละ Tier ใน exp/ (tier1, tier2, tier3, tier4) เรียง 1 | 2 | 3
   - สร้างคอลลาจราย Tier (1x3)
   - สร้างคอลลาจรวมครบ 4 Tiers (4x3 Grid)
2. รวมภาพสภาวะรบกวน 5 สภาวะใน exp/exp3/ เรียง C1 | C2 | C3 | C4 | C5
   - สร้างคอลลาจรายสถานที่ (1x5)
   - สร้างคอลลาจรวมทุกสถานที่ (3x5 Grid)
"""

import os
import re
from PIL import Image, ImageOps, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXP_DIR = os.path.join(BASE_DIR, 'exp')
EXP3_DIR = os.path.join(EXP_DIR, 'exp3')
OUT_DIR = os.path.join(BASE_DIR, 'output_collages')
os.makedirs(OUT_DIR, exist_ok=True)

# กำหนดขนาดมาตรฐานของทุกภาพย่อย (กว้าง x สูง: 640x480 มาตราส่วน 4:3 คมชัดสูง)
IMG_WIDTH = 640
IMG_HEIGHT = 480
SPACING = 14
BORDER_WIDTH = 2
BG_COLOR = (255, 255, 255)
BORDER_COLOR = (210, 218, 230)
LABEL_BG = (245, 247, 250)
TEXT_COLOR = (15, 23, 42)

def get_font(size=20, bold=False):
    """โหลดฟอนต์ระบบที่รองรับภาษาไทยและอังกฤษ"""
    font_candidates = [
        'C:/Windows/Fonts/tahomabd.ttf' if bold else 'C:/Windows/Fonts/tahoma.ttf',
        'C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/calibri.ttf',
        'C:/Windows/Fonts/segoeui.ttf',
    ]
    for fc in font_candidates:
        if os.path.exists(fc):
            try:
                return ImageFont.truetype(fc, size)
            except Exception:
                pass
    return ImageFont.load_default()

def process_and_crop_image(img_path, target_size=(IMG_WIDTH, IMG_HEIGHT)):
    """โหลดภาพและปรับขนาดให้เท่ากันด้วยการ Center Crop แบบ Lanczos คุณภาพสูง ไม่บิดเบี้ยว"""
    try:
        with Image.open(img_path) as im:
            im = im.convert('RGB')
            cropped = ImageOps.fit(im, target_size, method=Image.Resampling.LANCZOS)
            return cropped
    except Exception as e:
        print(f'[Error] ไม่สามารถโหลดภาพ {img_path}: {e}')
        ph = Image.new('RGB', target_size, (240, 240, 240))
        draw = ImageDraw.Draw(ph)
        draw.text((20, target_size[1]//2), 'Image Load Error', fill=(255, 0, 0))
        return ph

def create_horizontal_collage(image_list, labels=None, title=None, target_size=(IMG_WIDTH, IMG_HEIGHT)):
    """สร้างคอลลาจแนวนอน 1 แถว โดยทุกภาพมีขนาดเท่ากันเป๊ะ"""
    n = len(image_list)
    if n == 0:
        return None

    w, h = target_size
    label_h = 36 if labels else 0
    title_h = 44 if title else 0

    total_w = SPACING + n * (w + SPACING)
    total_h = SPACING + title_h + h + label_h + SPACING

    canvas = Image.new('RGB', (total_w, total_h), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    y_offset = SPACING
    if title:
        title_font = get_font(22, bold=True)
        draw.text((SPACING + 4, y_offset + 6), title, fill=(15, 23, 42), font=title_font)
        y_offset += title_h

    img_font = get_font(18, bold=True)

    for i, img in enumerate(image_list):
        x = SPACING + i * (w + SPACING)
        y = y_offset

        canvas.paste(img, (x, y))
        draw.rectangle([x, y, x + w - 1, y + h - 1], outline=BORDER_COLOR, width=BORDER_WIDTH)

        if labels and i < len(labels):
            lbl_y = y + h + 6
            lbl_text = labels[i]
            draw.rectangle([x, lbl_y, x + w - 1, lbl_y + label_h - 10], fill=LABEL_BG, outline=BORDER_COLOR, width=1)
            bbox = draw.textbbox((0, 0), lbl_text, font=img_font)
            text_w = bbox[2] - bbox[0]
            text_x = x + (w - text_w) // 2
            text_y = lbl_y + 4
            draw.text((text_x, text_y), lbl_text, fill=TEXT_COLOR, font=img_font)

    return canvas

def make_tier_collages():
    """1. สร้างคอลลาจของแต่ละ Tier (tier1, tier2, tier3, tier4) เรียง 1 | 2 | 3"""
    print('='*60)
    print('[1] กำลังสร้างคอลลาจภาพสำหรับแต่ละ Tier (เรียง 1 | 2 | 3)...')
    print('='*60)

    tier_folders = ['tier1', 'tier2', 'tier3', 'tier4']
    tier_titles = {
        'tier1': 'Tier 1: Iconic Landmarks (สถานที่สำคัญระดับโลก / สถาปัตยกรรมชัดเจน)',
        'tier2': 'Tier 2: Local Heritage & Culture (มรดกท้องถิ่น / ย่านวัฒนธรรม / ตลาด)',
        'tier3': 'Tier 3: Nature & Waterfalls (ธรรมชาติ / เกาะ / น้ำตก / อุทยาน)',
        'tier4': 'Tier 4: Casual UGC & Social Media (ภาพถ่ายผู้ใช้จริง / โซเชียลมีเดีย / คาเฟ่)'
    }

    all_tier_images = {}

    for tf in tier_folders:
        dir_path = os.path.join(EXP_DIR, tf)
        if not os.path.exists(dir_path):
            print(f'[-] ไม่พบโฟลเดอร์: {dir_path}')
            continue

        raw_files = [f for f in os.listdir(dir_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        raw_files.sort()
        print(f'[*] {tf}: พบ {len(raw_files)} ภาพ -> {raw_files}')

        processed_imgs = []
        labels = []
        for idx, f in enumerate(raw_files[:3]):
            p = os.path.join(dir_path, f)
            im = process_and_crop_image(p)
            processed_imgs.append(im)
            clean_name = os.path.splitext(f)[0]
            labels.append(f'ภาพที่ {idx+1}: {clean_name}')

        if processed_imgs:
            all_tier_images[tf] = (processed_imgs, labels)

            # คอลลาจราย Tier (มี Label สวยงาม)
            col = create_horizontal_collage(
                processed_imgs,
                labels=labels,
                title=tier_titles.get(tf, tf)
            )
            out_file = os.path.join(OUT_DIR, f'collage_{tf}_1x3.png')
            col.save(out_file, quality=95)
            print(f'  [+] บันทึกคอลลาจ: {out_file}')

            # คอลลาจราย Tier แบบคลีน (ไม่มีข้อความ)
            col_clean = create_horizontal_collage(processed_imgs, labels=None, title=None)
            out_file_clean = os.path.join(OUT_DIR, f'collage_{tf}_1x3_clean.png')
            col_clean.save(out_file_clean, quality=95)

    # รวม 4 Tiers เป็น 1 รูปมาสเตอร์ขนาดใหญ่ (Grid 4 แถว x 3 คอลัมน์)
    if len(all_tier_images) == 4:
        print('\\n[*] กำลังสร้างรูปคอลลาจรวมครบ 4 Tiers (4 แถว x 3 คอลัมน์)...')
        w, h = IMG_WIDTH, IMG_HEIGHT
        row_label_h = 36
        row_title_h = 38
        grid_w = SPACING + 3 * (w + SPACING)
        grid_h = SPACING + 4 * (row_title_h + h + row_label_h + SPACING)

        grid_canvas = Image.new('RGB', (grid_w, grid_h), BG_COLOR)
        grid_draw = ImageDraw.Draw(grid_canvas)
        title_font = get_font(20, bold=True)
        img_font = get_font(17, bold=True)

        current_y = SPACING
        for tf in tier_folders:
            imgs, lbls = all_tier_images[tf]
            grid_draw.text((SPACING + 4, current_y + 4), tier_titles.get(tf, tf), fill=(15, 23, 42), font=title_font)
            current_y += row_title_h

            for col_idx, img in enumerate(imgs):
                x = SPACING + col_idx * (w + SPACING)
                grid_canvas.paste(img, (x, current_y))
                grid_draw.rectangle([x, current_y, x + w - 1, current_y + h - 1], outline=BORDER_COLOR, width=BORDER_WIDTH)

                lbl_y = current_y + h + 6
                lbl_text = lbls[col_idx]
                grid_draw.rectangle([x, lbl_y, x + w - 1, lbl_y + row_label_h - 10], fill=LABEL_BG, outline=BORDER_COLOR, width=1)
                bbox = grid_draw.textbbox((0, 0), lbl_text, font=img_font)
                text_w = bbox[2] - bbox[0]
                text_x = x + (w - text_w) // 2
                grid_draw.text((text_x, lbl_y + 4), lbl_text, fill=TEXT_COLOR, font=img_font)

            current_y += h + row_label_h + SPACING

        master_out = os.path.join(OUT_DIR, 'collage_all_4tiers_master_4x3.png')
        grid_canvas.save(master_out, quality=95)
        print(f'  [+] บันทึกรูปมาสเตอร์รวม 4 Tiers: {master_out}')

def make_robustness_collages():
    """2. สร้างคอลลาจ 5 สภาวะเสื่อมสภาพใน exp/exp3/ เรียง C1 | C2 | C3 | C4 | C5"""
    print('\\n' + '='*60)
    print('[2] กำลังสร้างคอลลาจ 5 สภาวะรบกวน C1 | C2 | C3 | C4 | C5 (Exp 4)...')
    print('='*60)

    if not os.path.exists(EXP3_DIR):
        print(f'[-] ไม่พบโฟลเดอร์ {EXP3_DIR}')
        return

    subdirs = [d for d in os.listdir(EXP3_DIR) if os.path.isdir(os.path.join(EXP3_DIR, d))]
    subdirs.sort()
    print(f'[*] พบโฟลเดอร์สถานที่ใน exp3: {len(subdirs)} โฟลเดอร์')

    c_keys = ['C1', 'C2', 'C3', 'C4', 'C5']
    c_labels_dict = {
        'C1': 'C1 (Baseline ปกติ)',
        'C2': 'C2 (Illumination แสงรบกวน)',
        'C3': 'C3 (Atmospheric อากาศ/ฝน/หมอก)',
        'C4': 'C4 (Geometric มุมโดรน/มุมกด)',
        'C5': 'C5 (Occlusion สิ่งกีดขวาง/คนบัง)'
    }

    all_places_data = []

    for sd in subdirs:
        folder_path = os.path.join(EXP3_DIR, sd)
        files = os.listdir(folder_path)

        c_map = {}
        for f in files:
            if not f.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            for ck in c_keys:
                if f.upper().startswith(ck):
                    c_map[ck] = f
                    break

        print(f'[*] สถานที่: {sd} -> พบ {len(c_map)}/5 สภาวะ')

        imgs = []
        labels = []
        for ck in c_keys:
            if ck in c_map:
                fname = c_map[ck]
                fp = os.path.join(folder_path, fname)
                im = process_and_crop_image(fp)
                imgs.append(im)
                labels.append(c_labels_dict.get(ck, ck))
            else:
                print(f'  [!] ขาดไฟล์ {ck} ในโฟลเดอร์ {sd}')

        if len(imgs) == 5:
            all_places_data.append((sd, imgs, labels))

            clean_title = re.sub(r'^tier\\d+', '', sd).strip()
            display_title = f'ตัวอย่างสภาวะรบกวนทางกายภาพ 5 สภาวะ: {clean_title or sd}'

            col_5 = create_horizontal_collage(
                imgs,
                labels=labels,
                title=display_title
            )
            safe_name = re.sub(r'[^a-zA-Z0-9_\\-\\u0E00-\\u0E7F]', '_', sd)
            out_file = os.path.join(OUT_DIR, f'collage_robustness_{safe_name}_1x5.png')
            col_5.save(out_file, quality=95)
            print(f'  [+] บันทึกคอลลาจ 1x5: {out_file}')

            col_5_clean = create_horizontal_collage(imgs, labels=None, title=None)
            out_file_clean = os.path.join(OUT_DIR, f'collage_robustness_{safe_name}_1x5_clean.png')
            col_5_clean.save(out_file_clean, quality=95)

    if len(all_places_data) > 1:
        print(f'\\n[*] กำลังสร้างรูปคอลลาจรวมทุกสถานที่ ({len(all_places_data)} แถว x 5 คอลัมน์)...')
        num_places = len(all_places_data)
        w, h = IMG_WIDTH, IMG_HEIGHT
        row_label_h = 36
        row_title_h = 38
        grid_w = SPACING + 5 * (w + SPACING)
        grid_h = SPACING + num_places * (row_title_h + h + row_label_h + SPACING)

        grid_canvas = Image.new('RGB', (grid_w, grid_h), BG_COLOR)
        grid_draw = ImageDraw.Draw(grid_canvas)
        title_font = get_font(20, bold=True)
        img_font = get_font(17, bold=True)

        current_y = SPACING
        for (sd, imgs, lbls) in all_places_data:
            clean_title = re.sub(r'^tier\\d+', '', sd).strip()
            row_title = f'สถานที่: {clean_title or sd}'
            grid_draw.text((SPACING + 4, current_y + 4), row_title, fill=(15, 23, 42), font=title_font)
            current_y += row_title_h

            for col_idx, img in enumerate(imgs):
                x = SPACING + col_idx * (w + SPACING)
                grid_canvas.paste(img, (x, current_y))
                grid_draw.rectangle([x, current_y, x + w - 1, current_y + h - 1], outline=BORDER_COLOR, width=BORDER_WIDTH)

                lbl_y = current_y + h + 6
                lbl_text = lbls[col_idx]
                grid_draw.rectangle([x, lbl_y, x + w - 1, lbl_y + row_label_h - 10], fill=LABEL_BG, outline=BORDER_COLOR, width=1)
                bbox = grid_draw.textbbox((0, 0), lbl_text, font=img_font)
                text_w = bbox[2] - bbox[0]
                text_x = x + (w - text_w) // 2
                grid_draw.text((text_x, lbl_y + 4), lbl_text, fill=TEXT_COLOR, font=img_font)

            current_y += h + row_label_h + SPACING

        master_out = os.path.join(OUT_DIR, 'collage_robustness_all_places_master_3x5.png')
        grid_canvas.save(master_out, quality=95)
        print(f'  [+] บันทึกรูปมาสเตอร์รวม 5 สภาวะ: {master_out}')

if __name__ == '__main__':
    print('Pixinerary - Starting Collage Generation...')
    make_tier_collages()
    make_robustness_collages()
    print('\\n[SUCCESS] สร้างคอลลาจทั้งหมดเรียบร้อยแล้ว!')
    print('ตรวจสอบไฟล์ผลลัพธ์ได้ที่: ' + OUT_DIR)
'''

with open(target_script, 'w', encoding='utf-8') as f:
    f.write(script_code)

print(f'Successfully wrote {target_script} ({len(script_code)} chars)')
