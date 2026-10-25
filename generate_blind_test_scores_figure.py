# -*- coding: utf-8 -*-
"""
generate_blind_test_scores_figure.py
================================================================================
Updates:
1. Removed Section (c) completely.
2. In Panel (a): Removed mean line, top benchmark line, and header labels on top.
3. In Panel (b): Updated score to 7.0 / 10 (70.0%), removed description paragraphs.
4. Clean, seamless bar alignment and perfectly proportioned 2-tier layout.
================================================================================
"""

import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Font and Style configuration for Thai & Academic papers
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Tahoma', 'Leelawadee UI', 'DejaVu Sans', 'Arial']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10.5
plt.rcParams['axes.titlesize'] = 12.0
plt.rcParams['axes.labelsize'] = 10.5
plt.rcParams['xtick.labelsize'] = 9.5
plt.rcParams['ytick.labelsize'] = 10.2
plt.rcParams['figure.dpi'] = 300

BASE_DIR = r'd:\Pixinerary_model_test'
OUT_DIR = os.path.join(BASE_DIR, 'experiment', 'figures_Chapter4')
os.makedirs(OUT_DIR, exist_ok=True)

def generate_blind_test_figure():
    fig = plt.figure(figsize=(13.0, 7.2))
    gs = fig.add_gridspec(2, 1, height_ratios=[1.75, 0.75], hspace=0.35)

    # --------------------------------------------------------------------------
    # DATA DEFINITIONS
    # --------------------------------------------------------------------------
    dimensions_data = [
        {"name": "นวัตกรรมและประโยชน์", "score": 4.40, "color": "#059669", "eval": "มากที่สุด (จุดเด่นหลัก)"},
        {"name": "ความถูกต้องของเนื้อหา", "score": 4.20, "color": "#0284c7", "eval": "มากที่สุด"},
        {"name": "ความเป็นไปได้ในทางปฏิบัติ", "score": 4.17, "color": "#2563eb", "eval": "ระดับมาก"},
        {"name": "การเปรียบเทียบกับเครื่องมืออื่น", "score": 4.13, "color": "#7c3aed", "eval": "ระดับมาก"},
        {"name": "ความหลากหลายและความครอบคลุม", "score": 3.90, "color": "#d97706", "eval": "ระดับมาก"},
    ]
    overall_score = 4.16
    overall_color = "#0f766e"

    readiness_score = 7.0

    # --------------------------------------------------------------------------
    # PANEL A: 5 Core Dimensions + Overall Score (Likert 1-5 Scale)
    # (Clean: No top lines, no benchmark line, no top header labels)
    # --------------------------------------------------------------------------
    ax_main = fig.add_subplot(gs[0, 0])

    labels = [d["name"] for d in dimensions_data] + ["คะแนนรวมเฉลี่ย (Overall Score)"]
    scores = [d["score"] for d in dimensions_data] + [overall_score]
    colors = [d["color"] for d in dimensions_data] + [overall_color]
    evals = [d["eval"] for d in dimensions_data] + ["ระดับดีมาก (มาก)"]
    
    y_positions = [5.0, 4.0, 3.0, 2.0, 1.0, -0.4]

    # Plot horizontal bars
    bar_height = 0.54
    for y, score, c in zip(y_positions, scores, colors):
        if y < 0:
            ax_main.barh(y, score, height=bar_height + 0.08, color=c, edgecolor='#042f2e', linewidth=1.8, zorder=3)
        else:
            ax_main.barh(y, score, height=bar_height, color=c, edgecolor='#1e293b', linewidth=0.9, zorder=3)

    # Horizontal separator between individual dimensions and overall score
    ax_main.axhline(0.30, color='#cbd5e1', linestyle='-', linewidth=1.4, zorder=2)

    # Value text annotations:
    # 1. Inside bar: White bold score and percentage (high contrast)
    # 2. Outside bar: Badge showing qualitative evaluation tier
    for y, score, ev, c in zip(y_positions, scores, evals, colors):
        pct = (score / 5.0) * 100
        score_inside_str = f"{score:.2f} / 5.00  ({pct:.1f}%)"
        
        # Inside the bar
        ax_main.text(score - 0.12, y, score_inside_str, va='center', ha='right',
                     fontweight='bold', fontsize=10.2, color='#ffffff', zorder=5)
        
        # Outside the bar: badge with evaluation level
        if y < 0:
            ax_main.text(score + 0.12, y, f"[{ev}]", va='center', ha='left', fontweight='bold', fontsize=9.4, color='#042f2e',
                         bbox=dict(boxstyle="round,pad=0.25", facecolor="#ccfbf1", edgecolor="#0f766e", linewidth=1.1), zorder=5)
        else:
            ax_main.text(score + 0.12, y, f"[{ev}]", va='center', ha='left', fontsize=8.8, color='#334155',
                         bbox=dict(boxstyle="round,pad=0.22", facecolor="#f8fafc", edgecolor="#cbd5e1", linewidth=0.8), zorder=5)

    ax_main.set_yticks(y_positions)
    ax_main.set_yticklabels(labels, fontweight='bold', fontsize=10.5)
    ax_main.set_xlim(0, 5.85)
    ax_main.set_ylim(-0.95, 5.65)
    ax_main.set_xlabel("คะแนนเฉลี่ยจากการประเมิน (เต็ม 5.00 คะแนนตามเกณฑ์ Likert Scale)", fontweight='bold', labelpad=8)
    ax_main.set_title("(a) ผลการประเมิน 5 มิติหลักและคะแนนรวมเฉลี่ย (Likert Scale 1–5)", fontweight='bold', pad=12, fontsize=11.8)
    ax_main.grid(axis='x', linestyle='--', alpha=0.45, zorder=0)

    # --------------------------------------------------------------------------
    # PANEL B: Deployment Readiness Level (Scale 1–10, Score: 7.0 / 10)
    # (Clean: No descriptive paragraphs, perfectly aligned seamless meter)
    # --------------------------------------------------------------------------
    ax_readiness = fig.add_subplot(gs[1, 0])
    ax_readiness.set_xlim(-0.2, 10.2)
    ax_readiness.set_ylim(-0.65, 1.25)
    ax_readiness.axis('off')

    ax_readiness.text(-0.1, 1.15, "(b) ระดับความพร้อมสำหรับการนำไปใช้งานจริง (Readiness Level: สเกล 1–10)",
                      fontweight='bold', fontsize=11.8, color='#0f172a')

    # Color segments of the readiness scale (Seamless precision alignment)
    segments = [
        (0.0, 3.0, "#f1f5f9", "#94a3b8", "ระดับ POC\n(ช่วง 0–3)"),
        (3.0, 3.0, "#fef3c7", "#f59e0b", "ระดับ Prototype / MVP\n(ช่วง 3–6)"),
        (6.0, 2.0, "#e0e7ff", "#6366f1", "ระดับ Beta Pilot\n(ช่วง 6–8)"),
        (8.0, 2.0, "#dcfce7", "#10b981", "ระดับ Production Ready\n(ช่วง 8–10)")
    ]

    bar_y = 0.20
    bar_h = 0.42
    for start, width, fc, ec, lbl in segments:
        rect = patches.Rectangle((start, bar_y), width, bar_h, facecolor=fc, edgecolor=ec, linewidth=1.2, zorder=2)
        ax_readiness.add_patch(rect)
        # Stage label placed below tick numbers with clean 2-line structure
        ax_readiness.text(start + width / 2.0, -0.22, lbl,
                          ha='center', va='top', fontsize=8.4, color='#334155', fontweight='bold', linespacing=1.25, zorder=3)

    # Actual score fill (up to 7.0)
    score_fill = patches.Rectangle((0.0, bar_y), readiness_score, bar_h,
                                   facecolor="#4f46e5", edgecolor="#3730a3", linewidth=1.5, zorder=4)
    ax_readiness.add_patch(score_fill)

    # Outer border encompassing the entire gauge
    outer_border = patches.Rectangle((0.0, bar_y), 10.0, bar_h, fill=False, edgecolor='#1e293b', linewidth=1.5, zorder=5)
    ax_readiness.add_patch(outer_border)

    # Score pin / marker at 7.0
    ax_readiness.scatter([readiness_score], [bar_y + bar_h / 2.0], color='#ffffff', edgecolor='#3730a3', s=140, linewidth=2.5, zorder=6)
    ax_readiness.plot([readiness_score, readiness_score], [bar_y - 0.08, bar_y + bar_h + 0.16], color='#3730a3', linestyle='-', linewidth=2.2, zorder=7)
    
    # Text badge for score: 7.0 / 10.0 (70.0%)
    pct_readiness = (readiness_score / 10.0) * 100
    ax_readiness.text(readiness_score, bar_y + bar_h + 0.22, f"คะแนนที่ได้: {readiness_score:.1f} / 10.0 ({pct_readiness:.1f}%)",
                      ha='center', va='bottom', fontweight='bold', fontsize=10.8, color='#312e81',
                      bbox=dict(boxstyle="round,pad=0.28", facecolor="#eef2ff", edgecolor="#6366f1", linewidth=1.3))

    # Ticks along the gauge
    for tick in range(0, 11):
        ax_readiness.plot([tick, tick], [bar_y - 0.05, bar_y], color='#64748b', linewidth=1.2)
        ax_readiness.text(tick, bar_y - 0.08, str(tick), ha='center', va='top', fontsize=9.0, color='#475569')

    # Overall Main Title
    fig.suptitle("ผลการประเมินคุณภาพของระบบ Pixinerary โดยผู้เชี่ยวชาญ (Expert Blind Test Evaluation)\n"
                 "[การประเมิน 5 มิติคุณภาพตามมาตราส่วน Likert Scale (1–5) และระดับความพร้อมสำหรับการนำไปใช้งานจริง (1–10)]",
                 fontsize=12.8, fontweight='bold', y=0.98, color='#0f172a')

    # Save to outputs
    filenames = [
        "exp7_blind_test_evaluation_scores",
        "fig_blind_test_overall_scores",
        "exp7_04_blind_test_system_scores"
    ]
    for fn in filenames:
        png_path = os.path.join(OUT_DIR, f"{fn}.png")
        pdf_path = os.path.join(OUT_DIR, f"{fn}.pdf")
        fig.savefig(png_path, dpi=300, bbox_inches='tight')
        fig.savefig(pdf_path, bbox_inches='tight')
        print(f"  [+] Saved: {png_path}")
        print(f"  [+] Saved: {pdf_path}")

    plt.close(fig)
    print("\n[SUCCESS] Updated blind test score visualization generated successfully.")

if __name__ == '__main__':
    generate_blind_test_figure()
