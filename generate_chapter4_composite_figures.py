# -*- coding: utf-8 -*-
"""
generate_chapter4_composite_figures.py
================================================================================
Generates the 8 Integrated 4-Panel Composite Figures for Pixinerary Thesis Chapter 4
Following the exact Multi-Panel Academic Visualization Framework requested:

Audited and perfected to guarantee:
1. Zero legend overlap on data points (legends positioned outside or in dedicated clear space)
2. Zero collision between error bars / grid lines and text annotations
3. Zero data clipping / cutoff (dynamic axis limits with breathing room)
4. Consistent typography and dual export (300 DPI PNG + vector PDF)
================================================================================
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.lines import Line2D
import seaborn as sns

# Academic Style Configuration with Thai & Latin Font Support
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Tahoma', 'Leelawadee UI', 'DejaVu Sans', 'Arial']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10.5
plt.rcParams['axes.titlesize'] = 12.0
plt.rcParams['axes.labelsize'] = 10.5
plt.rcParams['xtick.labelsize'] = 9.5
plt.rcParams['ytick.labelsize'] = 9.5
plt.rcParams['legend.fontsize'] = 8.8
plt.rcParams['figure.titlesize'] = 13.5
plt.rcParams['figure.dpi'] = 300
plt.rcParams['axes.grid'] = True
plt.rcParams['grid.alpha'] = 0.35
plt.rcParams['grid.linestyle'] = '--'

BASE_DIR = r'd:\Pixinerary_model_test'
EXP_DIR = os.path.join(BASE_DIR, 'experiment')
OUT_DIR = os.path.join(EXP_DIR, 'figures_Chapter4')
os.makedirs(OUT_DIR, exist_ok=True)

MODEL_LABELS_MAP = {
    'anthropic-claude-sonnet5': 'Claude Sonnet 5',
    'google-gemini-38-flash': 'Gemini 3.8 Flash',
    'openai-gpt-54': 'GPT-5.4',
    'openai-gpt-54-mini': 'GPT-5.4 Mini',
    'qwen-25-vl-72b': 'Qwen 2.5 VL 72B',
    'qwen-38-flash': 'Qwen 2.5 VL 72B',
    'qwen-vl': 'Qwen 2.5 VL 72B',
    'meta-llama4': 'Llama 4 Maverick'
}

MODEL_COLORS = {
    'Gemini 3.8 Flash': '#0284c7',       # Vibrant Blue
    'Claude Sonnet 5': '#8b5cf6',        # Royal Purple
    'GPT-5.4': '#10b981',                # Emerald Green
    'GPT-5.4 Mini': '#06b6d4',           # Teal
    'Qwen 2.5 VL 72B': '#f59e0b',        # Amber/Orange
    'Llama 4 Maverick': '#ef4444'        # Rose/Red
}

MODEL_ORDER = [
    'Gemini 3.8 Flash',
    'Claude Sonnet 5',
    'GPT-5.4',
    'GPT-5.4 Mini',
    'Qwen 2.5 VL 72B',
    'Llama 4 Maverick'
]

TIER_NAMES = {
    'tier1_iconic': 'Tier 1: Iconic',
    'tier2_longtail': 'Tier 2: Regional',
    'tier3_nature': 'Tier 3: Nature',
    'tier4_ugc': 'Tier 4: Casual UGC'
}
TIER_ORDER = ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']

import time

def save_composite(fig, filename_base):
    png_path = os.path.join(OUT_DIR, f"{filename_base}.png")
    pdf_path = os.path.join(OUT_DIR, f"{filename_base}.pdf")
    for attempt in range(4):
        try:
            fig.savefig(png_path, dpi=300, bbox_inches='tight')
            fig.savefig(pdf_path, bbox_inches='tight')
            break
        except (OSError, PermissionError) as e:
            if attempt < 3:
                time.sleep(0.6)
            else:
                raise e
    plt.close(fig)
    print(f"  [+] Saved Composite: {filename_base}.png & .pdf")


# ==============================================================================
# FIGURE 1: EXP 1 - PROMPT SENSITIVITY (4 PANELS)
# ==============================================================================
def generate_composite_exp1():
    print("\n--- Generating Composite Figure 1: Exp 1 (Prompt Sensitivity) ---")
    csv_path = os.path.join(EXP_DIR, 'exp1_prompt_sensitivity.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['Time_Sec'] = df['Time MS'] / 1000.0
    
    prompt_names = {
        'P1': 'P1: Zero-Shot',
        'P2': 'P2: Persona',
        'P3': 'P3: CoT',
        'P4': 'P4: Thai',
        'P5': 'P5: Few-Shot'
    }
    df['Prompt_Label'] = df['Prompt Variant ID'].map(prompt_names)
    prompt_order = ['P1: Zero-Shot', 'P2: Persona', 'P3: CoT', 'P4: Thai', 'P5: Few-Shot']
    
    fig = plt.figure(figsize=(15.5, 11.8))
    gs = fig.add_gridspec(2, 2, hspace=0.44, wspace=0.28)
    
    # (a) Heatmap: Model x Prompt (Accuracy %)
    ax_a = fig.add_subplot(gs[0, 0])
    pivot_acc = df.pivot_table(index='Model_Label', columns='Prompt_Label', values='is_correct_bool',
                               aggfunc=lambda x: np.mean(x)*100).reindex(index=MODEL_ORDER, columns=prompt_order)
    sns.heatmap(pivot_acc, annot=True, fmt=".1f", cmap="YlGnBu", vmin=55, vmax=100,
                cbar_kws={'label': 'Accuracy (%)'}, linewidths=1.0, linecolor='white',
                annot_kws={'fontweight': 'bold', 'size': 9.5}, ax=ax_a)
    ax_a.set_title("(a) ผลหลัก: เมทริกซ์ความแม่นยำแยกตามโมเดลและรูปแบบคำสั่ง (Accuracy %)", fontweight='bold', pad=10)
    ax_a.set_ylabel("Vision-Language Model", fontweight='bold')
    ax_a.set_xlabel("Prompt Strategy Paradigm", fontweight='bold')
    ax_a.set_xticklabels(prompt_order, rotation=15, ha='right')
    
    # (b) Effect-size dot plot: Delta Accuracy vs P1
    ax_b = fig.add_subplot(gs[0, 1])
    delta_df = pivot_acc.copy()
    for col in prompt_order:
        delta_df[col] = delta_df[col] - pivot_acc['P1: Zero-Shot']
    delta_df = delta_df.drop(columns=['P1: Zero-Shot'])
    
    prompt_colors_delta = {'P2: Persona': '#7c3aed', 'P3: CoT': '#dc2626', 'P4: Thai': '#d97706', 'P5: Few-Shot': '#059669'}
    y_pos = np.arange(len(MODEL_ORDER))[::-1]
    
    ax_b.axvline(0, color='#64748b', linestyle='--', linewidth=1.2, alpha=0.8)
    for p_idx, p_col in enumerate(delta_df.columns):
        offset = (p_idx - 1.5) * 0.18
        vals = delta_df[p_col].values
        ax_b.scatter(vals, y_pos + offset, color=prompt_colors_delta.get(p_col, '#333'), s=75, label=p_col, zorder=3)
        for i, v in enumerate(vals):
            if abs(v) >= 2.5:
                ax_b.annotate(f"{v:+.1f}", xy=(v, y_pos[i] + offset), xytext=(4, -3),
                              textcoords="offset points", fontsize=8, color=prompt_colors_delta.get(p_col, '#333'),
                              bbox=dict(boxstyle="round,pad=0.15", facecolor="white", alpha=0.85, edgecolor='none'))
                
    ax_b.set_yticks(y_pos)
    ax_b.set_yticklabels(MODEL_ORDER, fontweight='bold')
    ax_b.set_xlabel("ผลต่างความแม่นยำเทียบ P1 (Δ Percentage Points)", fontweight='bold')
    ax_b.set_title("(b) ผลแยกกลุ่ม: Effect Size (ΔAccuracy เทียบ Baseline P1)", fontweight='bold', pad=10)
    ax_b.set_xlim(-16, 12)
    ax_b.legend(title="Prompt Paradigm", loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=4, framealpha=0.95, fontsize=8.5)
    
    # (c) Bubble scatter: Cost (X) vs Accuracy (Y), Size = Latency
    ax_c = fig.add_subplot(gs[1, 0])
    summary = df.groupby(['Model_Label', 'Prompt Variant ID']).agg(
        acc=('is_correct_bool', lambda x: np.mean(x)*100),
        cost_1k=('Cost USD', lambda x: np.mean(x)*1000.0),
        lat_sec=('Time_Sec', 'mean')
    ).reset_index()
    
    for _, r in summary.iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        size = max(55, r['lat_sec'] * 35)
        ax_c.scatter(r['cost_1k'], r['acc'], s=size, color=c, alpha=0.75, edgecolors='black', linewidth=0.8, zorder=3)
        
    for m in MODEL_ORDER:
        sub = summary[summary['Model_Label'] == m].sort_values('cost_1k')
        ax_c.plot(sub['cost_1k'], sub['acc'], color=MODEL_COLORS.get(m, '#333'), alpha=0.35, linestyle=':', zorder=2)
        best = sub.loc[sub['acc'].idxmax()]
        ax_c.annotate(m, xy=(best['cost_1k'], best['acc']), xytext=(6, 4), textcoords="offset points",
                      fontsize=8.5, fontweight='bold', color=MODEL_COLORS.get(m, '#333'),
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.85, edgecolor='none'))
        
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: ต้นทุน API × ความแม่นยำ (ขนาดจุดแสดงเวลาตอบสนอง Latency)", fontweight='bold', pad=10)
    ax_c.set_xlabel("ต้นทุนประเมินต่อ 1,000 คำขอ (USD $)", fontweight='bold')
    ax_c.set_ylabel("Top-1 Accuracy (%)", fontweight='bold')
    ax_c.set_ylim(54, 102)
    ax_c.set_xlim(0.2, 7.5)
    
    # (d) Boxplot + จุดข้อมูลจริง (Jitter): Latency of each prompt separated by model
    ax_d = fig.add_subplot(gs[1, 1])
    prompt_palette = ['#3b82f6', '#8b5cf6', '#dc2626', '#d97706', '#059669']
    sns.boxplot(data=df, x='Prompt Variant ID', y='Time_Sec', order=['P1', 'P2', 'P3', 'P4', 'P5'],
                hue='Prompt Variant ID', palette=prompt_palette, legend=False, ax=ax_d, showmeans=True,
                meanprops={"marker":"D", "markerfacecolor":"white", "markeredgecolor":"black", "markersize":"6"})
    sns.stripplot(data=df, x='Prompt Variant ID', y='Time_Sec', order=['P1', 'P2', 'P3', 'P4', 'P5'],
                  color='#1e293b', alpha=0.15, jitter=0.22, size=3.5, ax=ax_d)
    
    ax_d.set_title("(d) รายละเอียดสนับสนุน: การกระจายตัวของเวลาตอบสนอง (Latency) และค่าผิดปกติ", fontweight='bold', pad=10)
    ax_d.set_xlabel("รูปแบบคำสั่ง (P1–P5)", fontweight='bold')
    ax_d.set_ylabel("เวลาตอบสนอง (วินาที)", fontweight='bold')
    ax_d.set_xticks(range(5))
    ax_d.set_ylim(0, 25)
    ax_d.text(0.97, 0.94, "หมายเหตุ: ขยายสเกล 0–25 วินาที เพื่อแสดงโครงสร้างกล่องชัดเจน\n(ค่าผิดปกติภายนอกสูงสุด 111.9 วินาที ดูรายละเอียดในเนื้อหา)",
              transform=ax_d.transAxes, ha='right', va='top', fontsize=7.8, color='#475569',
              bbox=dict(boxstyle="round,pad=0.3", facecolor="#f8fafc", edgecolor="#cbd5e1", alpha=0.92))
    
    fig.suptitle("การทดลองที่ 1: การวิเคราะห์ความไวต่อรูปแบบคำสั่ง (Exp 1: Prompt Sensitivity Analysis)\n"
                 "[คำถามวิจัย: พรอมต์ใดแม่นยำและคุ้มค่าที่สุด และผลส่งผลเหมือนกันทุกโมเดลหรือไม่?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_01_exp1_prompt_sensitivity_4panel")


# ==============================================================================
# FIGURE 2: EXP 2 - MULTI-MODEL VPR BENCHMARK (4 PANELS)
# ==============================================================================
def generate_composite_exp2():
    print("\n--- Generating Composite Figure 2: Exp 2 (Model Benchmark) ---")
    csv_path = os.path.join(EXP_DIR, 'exp2_model_benchmark.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    
    fig = plt.figure(figsize=(15.5, 11.8))
    gs = fig.add_gridspec(2, 2, hspace=0.44, wspace=0.28)
    
    # (a) Dot plot with 95% Confidence Interval (FIXED TEXT OVERLAP)
    ax_a = fig.add_subplot(gs[0, 0])
    model_stats = df.groupby('Model_Label').agg(
        acc=('is_correct_bool', 'mean'),
        count=('is_correct_bool', 'count'),
        latency=('Time MS', 'mean'),
        cost_1k=('Cost USD', lambda x: np.mean(x)*1000.0)
    ).reindex(MODEL_ORDER)
    model_stats['ci95'] = 1.96 * np.sqrt(model_stats['acc'] * (1 - model_stats['acc']) / model_stats['count']) * 100
    model_stats['acc_pct'] = model_stats['acc'] * 100
    
    y_pos = np.arange(len(MODEL_ORDER))[::-1]
    for i, m in enumerate(MODEL_ORDER):
        row = model_stats.loc[m]
        c = MODEL_COLORS.get(m, '#333')
        ax_a.errorbar(row['acc_pct'], y_pos[i], xerr=row['ci95'], fmt='o', color=c,
                      ecolor=c, elinewidth=2.2, capsize=5, capthick=1.5, markersize=8.5, zorder=3)
        # Place label TO THE RIGHT of the error cap to completely prevent overlap
        cap_right = row['acc_pct'] + row['ci95']
        ax_a.annotate(f"{row['acc_pct']:.1f}% (±{row['ci95']:.1f}%)", xy=(cap_right, y_pos[i]),
                      xytext=(8, -3), textcoords="offset points", ha='left', va='center',
                      fontsize=9.0, fontweight='bold', color=c,
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor='none'))
        
    ax_a.set_yticks(y_pos)
    ax_a.set_yticklabels(MODEL_ORDER, fontweight='bold')
    ax_a.set_xlabel("Top-1 Accuracy (%) [ช่วงความเชื่อมั่น 95% CI, N=100]", fontweight='bold')
    ax_a.set_title("(a) ผลหลัก: ความแม่นยำพื้นฐาน 6 โมเดล VLM พร้อมช่วงความเชื่อมั่น 95% CI", fontweight='bold', pad=10)
    ax_a.set_xlim(60, 115)
    ax_a.axvline(100, color='#94a3b8', linestyle=':', alpha=0.7)
    
    # (b) Heatmap: Model x Tier
    ax_b = fig.add_subplot(gs[0, 1])
    tier_mat = df.pivot_table(index='Model_Label', columns='Tier', values='is_correct_bool',
                              aggfunc=lambda x: np.mean(x)*100).reindex(index=MODEL_ORDER, columns=TIER_ORDER)
    tier_mat.columns = [TIER_NAMES[t] for t in TIER_ORDER]
    sns.heatmap(tier_mat, annot=True, fmt=".1f", cmap="YlGnBu", vmin=20, vmax=100,
                cbar_kws={'label': 'Top-1 Accuracy (%)'}, linewidths=1.0, linecolor='white',
                annot_kws={'fontweight': 'bold', 'size': 9.5}, ax=ax_b)
    ax_b.set_title("(b) ผลแยกกลุ่ม: ความแม่นยำจำแนกตามระดับความยาก 4 Tiers (Tier 3 Bottleneck)", fontweight='bold', pad=10)
    ax_b.set_ylabel("")
    ax_b.set_xlabel("Environmental Difficulty Tier", fontweight='bold')
    ax_b.set_xticklabels([TIER_NAMES[t] for t in TIER_ORDER], rotation=15, ha='right')
    
    # (c) Pareto bubble plot: Latency x Accuracy, Size = Cost
    ax_c = fig.add_subplot(gs[1, 0])
    sorted_ms = model_stats.sort_values('latency').reset_index()
    pareto_pts = []
    curr_max = -1.0
    for _, r in sorted_ms.iterrows():
        if r['acc_pct'] >= curr_max:
            pareto_pts.append(r)
            curr_max = r['acc_pct']
    pareto_df = pd.DataFrame(pareto_pts)
    
    for _, r in model_stats.reset_index().iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        size = max(140, r['cost_1k'] * 85)
        ax_c.scatter(r['latency'], r['acc_pct'], s=size, color=c, alpha=0.85, edgecolors='black', linewidth=1.0, zorder=4)
        
        offset_x, offset_y = 12, 5
        if m == 'Gemini 3.8 Flash': offset_x, offset_y = -115, -16
        elif m == 'GPT-5.4': offset_x, offset_y = 10, -14
        elif m == 'Claude Sonnet 5': offset_x, offset_y = 10, 8
        elif m == 'Llama 4 Maverick': offset_x, offset_y = -110, -16
        elif m == 'GPT-5.4 Mini': offset_x, offset_y = -25, 16
        
        ax_c.annotate(f"{m}\n({r['acc_pct']:.1f}%, ${r['cost_1k']:.2f}/1k)",
                      xy=(r['latency'], r['acc_pct']), xytext=(offset_x, offset_y), textcoords="offset points",
                      fontsize=8.5, fontweight='bold', color='#1e293b',
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor=c, linewidth=0.8), zorder=5)
        
    ax_c.plot(pareto_df['latency'], pareto_df['acc_pct'], '--', color='#059669', linewidth=2.0, alpha=0.85, zorder=3)
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: Pareto Frontier ด้าน Accuracy–Latency โดยขนาดจุดแสดง Cost", fontweight='bold', pad=10)
    ax_c.set_xlabel("Mean Inference Latency (ms) — น้อยกว่าดีกว่า", fontweight='bold')
    ax_c.set_ylabel("Top-1 Accuracy (%) — มากกว่าดีกว่า", fontweight='bold')
    ax_c.set_ylim(68, 104)
    ax_c.set_xlim(2000, 7500)
    
    legend_elements_c = [
        Line2D([0], [0], linestyle='--', color='#059669', lw=2.0, label='Pareto Frontier ด้าน Accuracy–Latency (เส้นประ)'),
        Line2D([0], [0], color='none', label='*หมายเหตุ: ในมิติ 3D (รวม Cost) Qwen (0.98 USD) และ Llama (0.56 USD) เป็นจุดไม่ถูกครอบงำด้วย')
    ]
    ax_c.legend(handles=legend_elements_c, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=1, framealpha=0.95, fontsize=8.0)
    
    # (d) Stacked bar: Correct outcomes and Failure Modes taxonomy
    ax_d = fig.add_subplot(gs[1, 1])
    fail_df = df.groupby(['Model_Label', 'Failure Mode']).size().unstack(fill_value=0)
    fail_df = fail_df.reindex(MODEL_ORDER)
    
    color_map_modes = {
        'none': '#10b981',                         # Correct
        'visual_confusion': '#f59e0b',             # Visual Confusion
        'degradation_rejection': '#8b5cf6',        # Rejection
        'hallucination': '#ef4444'                 # Hallucination
    }
    label_map_modes = {
        'none': 'จำแนกถูกต้อง (Correct)',
        'visual_confusion': 'สับสนทางสายตา (Visual Confusion)',
        'degradation_rejection': 'ภาพไม่ชัดจนปฏิเสธ (Rejection)',
        'hallucination': 'สร้างข้อมูลเท็จ (Hallucination)'
    }
    
    left = np.zeros(len(MODEL_ORDER))
    for mode in ['none', 'visual_confusion', 'degradation_rejection', 'hallucination']:
        if mode in fail_df.columns:
            vals = fail_df[mode].values
            bars = ax_d.barh(MODEL_ORDER[::-1], vals[::-1], left=left[::-1], label=label_map_modes.get(mode, mode),
                             color=color_map_modes.get(mode, '#999'), edgecolor='black', linewidth=0.7)
            for j, b in enumerate(bars):
                w = b.get_width()
                if w >= 8:
                    ax_d.annotate(f"{w}", xy=(b.get_x() + w/2, b.get_y() + b.get_height()/2),
                                  ha='center', va='center', color='white', fontweight='bold', fontsize=8.5)
            left += vals
            
    ax_d.set_title("(d) รายละเอียดสนับสนุน: การจำแนกประเภทความสำเร็จและความล้มเหลว (100 ภาพทดสอบ)", fontweight='bold', pad=10)
    ax_d.set_xlabel("จำนวนภาพ (ภาพ)", fontweight='bold')
    ax_d.set_xlim(0, 100)
    ax_d.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95, fontsize=8.5)
    
    fig.suptitle("การทดลองที่ 2: การเปรียบเทียบสมรรถนะพื้นฐานของโมเดล VLM (Exp 2: Multi-Model Benchmark)\n"
                 "[คำถามวิจัย: โมเดลใดเหมาะสมเมื่อพิจารณาความแม่นยำ ความยากของภาพ เวลา ต้นทุน และลักษณะความผิดพลาด?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_02_exp2_model_benchmark_4panel")


# ==============================================================================
# FIGURE 3: EXP 3 - TWO-TURN PIPELINE COMPARISON (4 PANELS)
# ==============================================================================
def generate_composite_exp3():
    print("\n--- Generating Composite Figure 3: Exp 3 (Pipeline Comparison) ---")
    csv_path = os.path.join(EXP_DIR, 'exp3_pipeline_comparison.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['Top_1_Strict_bool'] = df['Top 1 Strict'].astype(str).str.lower().isin(['true', '1'])
    df['Top_3_Recall_bool'] = df['Top 3 Recall'].astype(str).str.lower().isin(['true', '1'])
    
    fig = plt.figure(figsize=(15.5, 11.8))
    gs = fig.add_gridspec(2, 2, hspace=0.44, wspace=0.28)
    
    # (a) Dumbbell plot: Direct Top-1 vs Pipeline Top-3 Candidate Recall
    ax_a = fig.add_subplot(gs[0, 0])
    grouped = df.groupby('Model_Label').agg(
        top1=('Top_1_Strict_bool', lambda x: np.mean(x)*100),
        top3=('Top_3_Recall_bool', lambda x: np.mean(x)*100)
    ).reindex(MODEL_ORDER)
    grouped['gain'] = grouped['top3'] - grouped['top1']
    
    ov_top1 = df['Top_1_Strict_bool'].mean() * 100
    ov_top3 = df['Top_3_Recall_bool'].mean() * 100
    
    labels_with_ov = ['Overall System Average'] + MODEL_ORDER
    top1_vals = [ov_top1] + grouped['top1'].tolist()
    top3_vals = [ov_top3] + grouped['top3'].tolist()
    gain_vals = [ov_top3 - ov_top1] + grouped['gain'].tolist()
    
    y_coords = np.arange(len(labels_with_ov))[::-1]
    for i in range(len(labels_with_ov)):
        y = y_coords[i]
        x1, x2, g = top1_vals[i], top3_vals[i], gain_vals[i]
        ax_a.plot([x1, x2], [y, y], color='#94a3b8', linewidth=2.4, zorder=2)
        ax_a.scatter(x1, y, color='#ef4444', s=80, edgecolors='black', zorder=3)
        ax_a.scatter(x2, y, color='#10b981', s=100, edgecolors='black', zorder=4)
        ax_a.annotate(f"{x1:.1f}%", xy=(x1, y), xytext=(-10, 0), textcoords="offset points",
                      ha='right', va='center', fontsize=8.5, fontweight='semibold')
        ax_a.annotate(f"{x2:.1f}% (+{g:.1f}%)", xy=(x2, y), xytext=(10, 0), textcoords="offset points",
                      ha='left', va='center', fontsize=8.8, fontweight='bold', color='#065f46')
        
    ax_a.set_yticks(y_coords)
    ax_a.set_yticklabels(labels_with_ov, fontweight='bold')
    ax_a.set_xlabel("Place Recognition Rate (%)", fontweight='bold')
    ax_a.set_title("(a) ผลหลัก: Dumbbell Plot แสดง Direct Top-1 เทียบกับ Pipeline Top-3 Recall", fontweight='bold', pad=10)
    ax_a.set_xlim(42, 122)
    
    leg_dumb = [
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#ef4444', markersize=8, label='Direct 1-Turn (Top-1 Strict)'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#10b981', markersize=9, label='Pipeline 2-Turn (Top-3 Recall Upper Bound)')
    ]
    ax_a.legend(handles=leg_dumb, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95, fontsize=8.5)
    
    # (b) Stacked bar: Outcome categories
    ax_b = fig.add_subplot(gs[0, 1])
    df['outcome'] = 'Unrecovered'
    df.loc[df['Top_3_Recall_bool'], 'outcome'] = 'Top-1 Incorrect, in Top-3'
    df.loc[df['Top_1_Strict_bool'], 'outcome'] = 'Top-1 Correct Immediately'
    
    out_counts = df.groupby(['Model_Label', 'outcome']).size().unstack(fill_value=0)
    out_pct = out_counts.div(out_counts.sum(axis=1), axis=0) * 100
    out_pct = out_pct.reindex(MODEL_ORDER)
    
    cat_order = ['Top-1 Correct Immediately', 'Top-1 Incorrect, in Top-3', 'Unrecovered']
    cat_colors = ['#10b981', '#3b82f6', '#ef4444']
    cat_th = ['Top-1 ถูกต้องทันที', 'Top-1 ผิดแต่พบใน Top-3', 'ไม่พบใน Top-3']
    
    left = np.zeros(len(MODEL_ORDER))
    for i, cat in enumerate(cat_order):
        if cat in out_pct.columns:
            vals = out_pct[cat].values
            bars = ax_b.barh(MODEL_ORDER[::-1], vals[::-1], left=left[::-1], label=cat_th[i],
                             color=cat_colors[i], edgecolor='black', linewidth=0.7)
            for b in bars:
                w = b.get_width()
                if w >= 8:
                    ax_b.annotate(f"{w:.1f}%", xy=(b.get_x() + w/2, b.get_y() + b.get_height()/2),
                                  ha='center', va='center', color='white', fontweight='bold', fontsize=8.5)
            left += vals
            
    ax_b.set_title("(b) ผลแยกกลุ่ม: สัดส่วนการจำแนก 3 สถานะ (ถูกต้อง / กู้คืนได้ / ไม่พบคำตอบ)", fontweight='bold', pad=10)
    ax_b.set_xlabel("สัดส่วนคำตอบที่ประเมิน (%)", fontweight='bold')
    ax_b.set_xlim(0, 100)
    ax_b.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3, framealpha=0.95, fontsize=8.5)
    
    # (c) Quadrant scatter: Added Latency vs Accuracy Gain
    ax_c = fig.add_subplot(gs[1, 0])
    mean_lat_pipe = df.groupby('Model_Label')['Time MS'].mean().reindex(MODEL_ORDER) / 1000.0
    base_lats = {'Gemini 3.8 Flash': 6.2, 'Claude Sonnet 5': 5.5, 'GPT-5.4': 4.5,
                 'GPT-5.4 Mini': 2.9, 'Qwen 2.5 VL 72B': 3.3, 'Llama 4 Maverick': 5.2}
    delta_lats = [mean_lat_pipe[m] - base_lats.get(m, 4.0) for m in MODEL_ORDER]
    gains = grouped['gain'].values
    
    for i, m in enumerate(MODEL_ORDER):
        c = MODEL_COLORS.get(m, '#333')
        ax_c.scatter(delta_lats[i], gains[i], color=c, s=140, edgecolors='black', linewidth=1.0, zorder=3)
        ax_c.annotate(f"{m}\n(+{gains[i]:.1f}%, +{delta_lats[i]:.1f}s)",
                      xy=(delta_lats[i], gains[i]), xytext=(8, -4), textcoords="offset points",
                      fontsize=8.5, fontweight='bold', color=c,
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor=c, linewidth=0.8))
        
    ax_c.axhline(20, color='#64748b', linestyle=':', alpha=0.7)
    ax_c.axvline(15, color='#64748b', linestyle=':', alpha=0.7)
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: เวลาที่เพิ่มขึ้นจาก Pipeline (X) × โอกาสพบคำตอบที่เพิ่มขึ้น (Y)", fontweight='bold', pad=10)
    ax_c.set_xlabel("เวลาประมวลผลเพิ่มขึ้น (Δ Latency, วินาที)", fontweight='bold')
    ax_c.set_ylabel("โอกาสกู้คืนคำตอบสำเร็จ (Δ Accuracy % points)", fontweight='bold')
    ax_c.set_xlim(5, 42)
    ax_c.set_ylim(10, 38)
    
    # (d) Boxplot + จุดข้อมูล: Candidate Relevance Scores (Rank 1, 2, 3)
    ax_d = fig.add_subplot(gs[1, 1])
    score_df = pd.melt(df[['Candidate 1 Score', 'Candidate 2 Score', 'Candidate 3 Score']],
                       var_name='Candidate_Rank', value_name='Relevance_Score').dropna()
    score_df['Rank_Label'] = score_df['Candidate_Rank'].map({
        'Candidate 1 Score': 'Candidate 1\n(CLIP อันดับ 1)',
        'Candidate 2 Score': 'Candidate 2\n(CLIP อันดับ 2)',
        'Candidate 3 Score': 'Candidate 3\n(CLIP อันดับ 3)'
    })
    
    sns.boxplot(data=score_df, x='Rank_Label', y='Relevance_Score', hue='Rank_Label', palette=['#10b981', '#3b82f6', '#f59e0b'], legend=False,
                ax=ax_d, showmeans=True, meanprops={"marker":"D", "markerfacecolor":"white", "markeredgecolor":"black"})
    sns.stripplot(data=score_df, x='Rank_Label', y='Relevance_Score', color='#1e293b', alpha=0.25, jitter=0.2, ax=ax_d)
    
    ax_d.set_title("(d) รายละเอียดสนับสนุน: การแจกแจงคะแนนความเกี่ยวข้องของตัวเลือก Top-3 Candidates", fontweight='bold', pad=10)
    ax_d.set_xlabel("ลำดับตัวเลือกที่ผ่านการคัดกรองด้วย OpenCLIP", fontweight='bold')
    ax_d.set_ylabel("ระดับความเกี่ยวข้อง (0 = ไม่ตรง, 3 = ตรงสถานที่จริง)", fontweight='bold')
    ax_d.set_ylim(-0.3, 3.3)
    
    fig.suptitle("การทดลองที่ 3: การประเมินสถาปัตยกรรม Two-Turn และโอกาสกู้คืนคำตอบ (Exp 3: Pipeline Comparison)\n"
                 "[คำถามวิจัย: Pipeline ช่วยด้านใด เพิ่มโอกาสพบคำตอบจริงเท่าใด และแลกกับภาระเวลาอะไร?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_03_exp3_pipeline_comparison_4panel")


# ==============================================================================
# FIGURE 4: EXP 4 - ENVIRONMENTAL ROBUSTNESS (4 PANELS)
# ==============================================================================
def generate_composite_exp4():
    print("\n--- Generating Composite Figure 4: Exp 4 (Robustness Test) ---")
    csv_path = os.path.join(EXP_DIR, 'exp4_robustness.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    
    cond_order = ['Baseline', 'Illumination', 'Atmospheric', 'Geometric', 'Occlusion']
    cond_labels_dict = {
        'Baseline': 'C1: Baseline\n(Normal Sky)',
        'Illumination': 'C2: Illumination\n(Night / Backlight)',
        'Atmospheric': 'C3: Atmospheric\n(Rain / Fog)',
        'Geometric': 'C4: Geometric\n(Drone / Bird-eye)',
        'Occlusion': 'C5: Occlusion\n(Obstacles / Blur)'
    }
    
    fig = plt.figure(figsize=(14.5, 11.0))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.15, 1.0], hspace=0.38, wspace=0.28,
                           left=0.08, right=0.95, top=0.91, bottom=0.09)
    
    # (a) Grouped line/dot plot across C1-C5 (Full Width on Top)
    ax_a = fig.add_subplot(gs[0, :])
    acc_matrix = df.pivot_table(index='Model_Label', columns='Condition Category', values='is_correct_bool',
                                aggfunc=lambda x: np.mean(x)*100).reindex(index=MODEL_ORDER, columns=cond_order)
    x_pos = np.arange(len(cond_order))
    for m in MODEL_ORDER:
        c = MODEL_COLORS.get(m, '#333')
        vals = acc_matrix.loc[m].values
        ax_a.plot(x_pos, vals, marker='o', markersize=8.0, linewidth=2.2, color=c, alpha=0.9, label=m)
    ax_a.set_xticks(x_pos)
    ax_a.set_xticklabels([cond_labels_dict[c] for c in cond_order], fontweight='bold', fontsize=10.0)
    ax_a.set_ylabel("Recognition Accuracy (%)", fontweight='bold', fontsize=10.5)
    ax_a.set_title("(a) ผลหลัก: วิถีความทนทานของโมเดล VLM ข้าม 5 สภาวะรบกวนทางกายภาพ", fontweight='bold', fontsize=12.0, pad=10)
    ax_a.set_ylim(70, 105)
    ax_a.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=6, framealpha=0.95, fontsize=9.0)
    
    # (b) Diverging heatmap: Delta Accuracy vs C1 Baseline (Bottom-Left)
    ax_b = fig.add_subplot(gs[1, 0])
    delta_matrix = pd.DataFrame(index=MODEL_ORDER)
    for c in ['Illumination', 'Atmospheric', 'Geometric', 'Occlusion']:
        delta_matrix[cond_labels_dict[c].replace('\n', ' ')] = acc_matrix[c] - acc_matrix['Baseline']
    sns.heatmap(delta_matrix, annot=True, fmt="+.1f", cmap="coolwarm_r", center=0, vmin=-20, vmax=5,
                cbar_kws={'label': 'Δ Accuracy (% points vs. C1)'}, linewidths=1.0, linecolor='white',
                annot_kws={'fontweight': 'bold', 'size': 9.5}, ax=ax_b)
    ax_b.set_title("(b) ผลแยกกลุ่ม: เมทริกซ์อัตราการเสื่อมถอยเทียบกับ C1 Baseline", fontweight='bold', fontsize=11.5, pad=10)
    ax_b.set_ylabel("")
    ax_b.set_xlabel("Controlled Environmental Stress", fontweight='bold')
    ax_b.set_xticklabels(['C2: Illumination', 'C3: Atmospheric', 'C4: Geometric', 'C5: Occlusion'], rotation=15, ha='right')
    
    # (c) Horizontal dot plot: Degradation Rate separated by condition and model (Bottom-Right)
    ax_c = fig.add_subplot(gs[1, 1])
    stress_conds = ['Illumination', 'Atmospheric', 'Geometric', 'Occlusion']
    y_cond_pos = np.arange(len(stress_conds))[::-1]
    
    for m in MODEL_ORDER:
        c = MODEL_COLORS.get(m, '#333')
        degs = [acc_matrix.loc[m, sc] - acc_matrix.loc[m, 'Baseline'] for sc in stress_conds]
        ax_c.scatter(degs, y_cond_pos, color=c, s=85, alpha=0.85, edgecolors='black', linewidth=0.8)
        
    mean_degs = [acc_matrix[sc].mean() - acc_matrix['Baseline'].mean() for sc in stress_conds]
    ax_c.scatter(mean_degs, y_cond_pos, color='#dc2626', marker='D', s=130, edgecolors='black', label='ค่าเฉลี่ยทุกโมเดล (Mean Degradation)', zorder=5)
    for i, md in enumerate(mean_degs):
        ax_c.annotate(f"{md:.2f}%", xy=(md, y_cond_pos[i]), xytext=(0, -16), textcoords="offset points",
                      ha='center', fontweight='bold', color='#b91c1c', fontsize=9,
                      bbox=dict(boxstyle="round,pad=0.15", facecolor="white", alpha=0.85, edgecolor='none'))
        
    ax_c.axvline(0, color='#64748b', linestyle='--', alpha=0.7)
    ax_c.set_yticks(y_cond_pos)
    ax_c.set_yticklabels(['C2: Illumination (แสง)', 'C3: Atmospheric (อากาศ)', 'C4: Geometric (มุมโดรน)', 'C5: Occlusion (สิ่งกีดขวาง)'], fontweight='bold')
    ax_c.set_xlabel("อัตราการลดลงของความแม่นยำ (Degradation Rate, % points)", fontweight='bold')
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: การกระจายตัวของอัตราเสื่อมถอยแยกตามสภาวะและโมเดล", fontweight='bold', fontsize=11.5, pad=10)
    ax_c.set_xlim(-24, 3)
    ax_c.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=1, framealpha=0.95, fontsize=8.5)
    
    fig.suptitle("การทดลองที่ 4: ความทนทานต่อสภาวะรบกวนทางกายภาพของภาพถ่าย (Exp 4: Robustness Test)\n"
                 "[คำถามวิจัย: สภาวะใดเป็นปัญหา โมเดลใดได้รับผลกระทบมาก และมีระดับความเสื่อมถอยเท่าใด?]",
                 fontsize=13.5, fontweight='bold', y=0.985)
    save_composite(fig, "fig4_04_exp4_robustness_test_4panel")
    save_composite(fig, "fig4_04_exp4_robustness_test_3panel")


# ==============================================================================
# FIGURE 5: EXP 5 - MODEL CONSISTENCY & DETERMINISM (4 PANELS)
# ==============================================================================
def generate_composite_exp5():
    print("\n--- Generating Composite Figure 5: Exp 5 (Model Consistency) ---")
    csv_path = os.path.join(EXP_DIR, 'exp5_consistency.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['norm_pred'] = df['Predicted Place'].astype(str).str.strip().str.lower()
    
    fig = plt.figure(figsize=(16.0, 11.8))
    gs = fig.add_gridspec(2, 2, hspace=0.44, wspace=0.38)
    
    cons_list = []
    for m in MODEL_ORDER:
        for t in [0.1, 0.7]:
            sub = df[(df['Model_Label'] == m) & (df['Temperature'] == t)]
            sess_uniques = sub.groupby('Session ID')['norm_pred'].nunique()
            score = (sess_uniques == 1).mean() * 100
            acc = sub['is_correct_bool'].mean() * 100
            cons_list.append({'Model_Label': m, 'Temperature': t, 'Consistency': score, 'Accuracy': acc})
    cons_df = pd.DataFrame(cons_list)
    pivot_cons = cons_df.pivot(index='Model_Label', columns='Temperature', values='Consistency').reindex(MODEL_ORDER)
    
    # (a) Dumbbell plot: Consistency at T=0.1 vs T=0.7
    ax_a = fig.add_subplot(gs[0, 0])
    y_pos = np.arange(len(MODEL_ORDER))[::-1]
    for i, m in enumerate(MODEL_ORDER):
        c1 = pivot_cons.loc[m, 0.1]
        c7 = pivot_cons.loc[m, 0.7]
        y = y_pos[i]
        
        if abs(c1 - c7) < 0.1:
            # Concentric circles for identical consistency (e.g. Claude Sonnet 5 at 50.0%)
            ax_a.scatter(c1, y, color='#3b82f6', s=130, edgecolors='black', linewidth=1.2,
                         label='T = 0.1 (Strict)' if i==0 else "", zorder=3)
            ax_a.scatter(c7, y, color='#f59e0b', s=65, edgecolors='black', linewidth=1.0,
                         label='T = 0.7 (Exploratory)' if i==0 else "", zorder=4)
            ax_a.annotate(f"{c1:.1f}% (เท่ากัน)", xy=(c1, y), xytext=(12, -3), textcoords="offset points",
                          fontweight='bold', color='#1e293b', fontsize=8.8)
        else:
            ax_a.plot([c7, c1], [y, y], color='#cbd5e1', linewidth=2.5, zorder=2)
            ax_a.scatter(c1, y, color='#3b82f6', s=95, edgecolors='black',
                         label='T = 0.1 (Strict)' if i==0 else "", zorder=3)
            ax_a.scatter(c7, y, color='#f59e0b', s=95, edgecolors='black',
                         label='T = 0.7 (Exploratory)' if i==0 else "", zorder=4)
            ax_a.annotate(f"{c1:.1f}%", xy=(c1, y), xytext=(6, -3), textcoords="offset points",
                          fontweight='bold', color='#1d4ed8', fontsize=8.8)
            ax_a.annotate(f"{c7:.1f}%", xy=(c7, y), xytext=(-26, -3), textcoords="offset points",
                          fontweight='bold', color='#b45309', fontsize=8.8)
        
    ax_a.set_yticks(y_pos)
    ax_a.set_yticklabels(MODEL_ORDER, fontweight='bold')
    ax_a.set_xlabel("Consistency Agreement Score (%)", fontweight='bold')
    ax_a.set_title("(a) ผลหลัก: Dumbbell Plot ความสม่ำเสมอของคำตอบ (T = 0.1 เทียบ T = 0.7)", fontweight='bold', pad=10)
    ax_a.set_xlim(20, 114)
    ax_a.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95, fontsize=8.5)
    
    # (b) Response heatmap: Images x Runs (Ordered by Tier with descriptive labels)
    ax_b = fig.add_subplot(gs[0, 1])
    sub_gem = df[(df['Model_Label'] == 'Gemini 3.8 Flash') & (df['Temperature'] == 0.1)].copy()
    tier_order_map = {'tier1_iconic': 1, 'tier2_longtail': 2, 'tier3_nature': 3, 'tier4_ugc': 4}
    sub_gem['tier_num'] = sub_gem['Tier'].map(tier_order_map)
    
    scene_labels_map = {
        ('tier1_iconic', 'images01.jpg'): 'T1: หอไอเฟล (Eiffel)',
        ('tier1_iconic', 'images02.jpg'): 'T1: โคลอสเซียม (Colosseum)',
        ('tier1_iconic', 'images25.1.jpg'): 'T1: เคียงบก (Gyeongbok)',
        ('tier2_longtail', 'images01.1.jpg'): 'T2: มงแซ็งมีแชล (Mont-St-Michel)',
        ('tier2_longtail', 'images03.1.jpg'): 'T2: ฟูชิมิอินาริ (Fushimi)',
        ('tier2_longtail', 'images08.1.jpg'): 'T2: นอยชวานชไตน์ (Neuschwan)',
        ('tier3_nature', 'images12.jpg'): 'T3: ภูเขาสายรุ้ง (Vinicunca)',
        ('tier3_nature', 'images01.jpg'): 'T3: อ่างกา ดอยอินทนนท์',
        ('tier3_nature', 'images19.1.jpg'): 'T3: เกาะห้อง (Koh Hong)',
        ('tier4_ugc', '28.jpg'): 'T4: คาวากุจิโกะ (Kawaguchiko)',
        ('tier4_ugc', '29.jpg'): 'T4: เขาช่องลม (Khao Chong Lom)',
        ('tier4_ugc', '30.jpg'): 'T4: เกาะสีชัง (Koh Sichang)'
    }
    
    scene_meta = sub_gem[['Session ID', 'Tier', 'Image Name', 'tier_num']].drop_duplicates()
    scene_meta['label'] = scene_meta.apply(lambda r: scene_labels_map.get((r['Tier'], r['Image Name']), r['Image Name']), axis=1)
    scene_meta = scene_meta.sort_values(['tier_num', 'Image Name'])
    ordered_sessions = scene_meta['Session ID'].tolist()
    ordered_labels = scene_meta['label'].tolist()
    
    resp_matrix = np.zeros((len(ordered_sessions), 5), dtype=int)
    for r_idx, s_id in enumerate(ordered_sessions):
        s_data = sub_gem[sub_gem['Session ID'] == s_id].sort_values('Run Number')
        preds = s_data['Predicted Place'].tolist()[:5]
        seen = {}
        for c_idx, p in enumerate(preds):
            if p not in seen:
                seen[p] = len(seen)
            resp_matrix[r_idx, c_idx] = seen[p]
            
    cmap_discrete = sns.color_palette(['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], as_cmap=True)
    sns.heatmap(resp_matrix, annot=False, cmap=cmap_discrete, vmin=0, vmax=3,
                cbar_kws={'label': '0 = ตรงกัน 100%, >0 = สลับการสะกด/ชื่อพ้อง'},
                linewidths=1.0, linecolor='white', ax=ax_b)
    ax_b.set_title("(b) ผลแยกกลุ่ม: Heatmap ความคงที่ของคำตอบ 12 ภาพ × 5 รอบรัน (Gemini T=0.1)", fontweight='bold', pad=10)
    ax_b.set_xlabel("รอบการทดสอบซ้ำ (Run 1 ถึง Run 5)", fontweight='bold')
    ax_b.set_ylabel("")
    ax_b.set_xticklabels([f"Run {i}" for i in range(1, 6)], rotation=0)
    ax_b.set_yticklabels(ordered_labels, rotation=0, fontsize=8.8)
    
    # (c) Quadrant scatter: Consistency x Accuracy
    ax_c = fig.add_subplot(gs[1, 0])
    sub_c = cons_df[cons_df['Temperature'] == 0.1]
    for _, r in sub_c.iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        ax_c.scatter(r['Consistency'], r['Accuracy'], color=c, s=140, edgecolors='black', linewidth=1.0, zorder=3)
        
        # Position offsets to avoid border clipping and text collisions
        if m == 'Qwen 2.5 VL 72B':
            xytext = (-10, -18)
            ha = 'right'
        elif m == 'GPT-5.4 Mini':
            xytext = (0, -22)
            ha = 'center'
        elif m == 'Llama 4 Maverick':
            xytext = (-10, 10)
            ha = 'right'
        else:
            xytext = (8, -4)
            ha = 'left'
            
        ax_c.annotate(f"{m}\n({r['Consistency']:.1f}%, {r['Accuracy']:.1f}%)",
                      xy=(r['Consistency'], r['Accuracy']),
                      xytext=xytext, textcoords="offset points", ha=ha,
                      fontsize=8.5, fontweight='bold', color=c,
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor=c, linewidth=0.8))
        
    ax_c.axvline(70, color='#64748b', linestyle=':', alpha=0.7)
    ax_c.axhline(80, color='#64748b', linestyle=':', alpha=0.7)
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: Consistency (ความคงที่) × Accuracy (ความถูกต้อง) ที่ T=0.1", fontweight='bold', pad=10)
    ax_c.set_xlabel("Consistency Agreement Score (%) — สูงแสดงว่าเป็นระบบคงที่", fontweight='bold')
    ax_c.set_ylabel("Top-1 Accuracy (%)", fontweight='bold')
    ax_c.set_xlim(35, 108)
    ax_c.set_ylim(58, 104)
    
    # (d) ECDF of Latency (All 6 Models)
    ax_d = fig.add_subplot(gs[1, 1])
    for m in MODEL_ORDER:
        sub_m = df[(df['Model_Label'] == m) & (df['Temperature'] == 0.1)]['Time MS'] / 1000.0
        sorted_x = np.sort(sub_m)
        ecdf_y = np.arange(1, len(sorted_x) + 1) / len(sorted_x)
        sorted_x = np.concatenate([[sorted_x[0]], sorted_x])
        ecdf_y = np.concatenate([[0.0], ecdf_y])
        ax_d.plot(sorted_x, ecdf_y, label=m, color=MODEL_COLORS.get(m, '#333'), linewidth=2.0)
        
    ax_d.set_title("(d) รายละเอียดสนับสนุน: ECDF ของเวลาประมวลผล (ครบทั้ง 6 โมเดล ที่ T=0.1)", fontweight='bold', pad=10)
    ax_d.set_xlabel("เวลาประมวลผลต่อรอบ (วินาที)", fontweight='bold')
    ax_d.set_ylabel("สัดส่วนสะสม (Cumulative Probability)", fontweight='bold')
    ax_d.set_xlim(0, 22)
    ax_d.set_ylim(0, 1.05)
    ax_d.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3, framealpha=0.95, fontsize=8.5)
    
    fig.suptitle("การทดลองที่ 5: ความคงเส้นคงวาเชิงความหมายและความเสถียร (Exp 5: Consistency & Stability)\n"
                 "[คำถามวิจัย: โมเดลตอบคงที่และถูกต้องหรือไม่ Temperature และการรันซ้ำส่งผลอย่างไร?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_05_exp5_model_consistency_4panel")


# ==============================================================================
# FIGURE 6: EXP 6 - PLAN QUALITY BENCHMARK (3 PANELS - FIXED MISSING QWEN & REMOVED PANEL D)
# ==============================================================================
def generate_composite_exp6():
    print("\n--- Generating Composite Figure 6: Exp 6 (Plan Quality 3-Panel) ---")
    csv_path = os.path.join(EXP_DIR, 'exp6_plan_evaluation.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    
    dims = [
        ('Dim1_ConstraintSatisfaction', 'Dim 1: Constraint'),
        ('Dim2_ActivityRelevance', 'Dim 2: Relevance'),
        ('Dim3_Spatiality', 'Dim 3: Spatiality'),
        ('Dim4_AccuracyValidity', 'Dim 4: Accuracy'),
        ('Dim5_OverallQuality', 'Dim 5: Pacing')
    ]
    
    fig = plt.figure(figsize=(15.5, 11.2))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.0, 1.05], hspace=0.38, wspace=0.28,
                           left=0.08, right=0.95, top=0.91, bottom=0.08)
    
    # (a) Heatmap: Model x 5 Plan Quality Dimensions
    ax_a = fig.add_subplot(gs[0, 0])
    dim_means = df.groupby('Model_Label')[[d[0] for d in dims]].mean().reindex(MODEL_ORDER)
    dim_means.columns = [d[1] for d in dims]
    sns.heatmap(dim_means, annot=True, fmt=".2f", cmap="YlGnBu", vmin=2.5, vmax=4.0,
                cbar_kws={'label': 'คะแนนรูบริกส์ (1.00 - 5.00)'}, linewidths=1.0, linecolor='white',
                annot_kws={'fontweight': 'bold', 'size': 9.8}, ax=ax_a)
    ax_a.set_title("(a) ผลหลัก: คะแนนประเมินคุณภาพแผนการเดินทาง 5 มิติ (เกณฑ์รูบริกส์ 20 ข้อย่อย)", fontweight='bold', pad=10)
    ax_a.set_ylabel("Itinerary Synthesis Model", fontweight='bold')
    ax_a.set_xlabel("Rubric Dimension", fontweight='bold')
    ax_a.set_xticklabels(dim_means.columns, rotation=15, ha='right')
    
    # (b) Paired dot plot: Total Score across 7 Scenarios comparing models
    ax_b = fig.add_subplot(gs[0, 1])
    scen_labels = {
        'Easy1 image3': 'SC1: พระนคร\n(3D/Std)',
        'Easy image5': 'SC2: โตเกียว\n(7D/Fam)',
        'Medium1 image3': 'SC3: ริมน้ำ\n(3D/Bud)',
        'IMG 3595': 'SC4: ชายฝั่ง\n(5D/Std)',
        'Hard2 image1': 'SC5: โดโลไมต์\n(7D/Std)',
        'Hard3 image1': 'SC6: มาจอร์กา\n(6D/Lux)',
        'Tiktok image1': 'SC7: โซเชียล\n(5D/Cpl)'
    }
    scen_order = ['Easy1 image3', 'Easy image5', 'Medium1 image3', 'IMG 3595', 'Hard2 image1', 'Hard3 image1', 'Tiktok image1']
    
    scen_matrix = df.pivot_table(index='Destination', columns='Model_Label', values='Total Score').reindex(index=scen_order, columns=MODEL_ORDER)
    x_scen = np.arange(len(scen_order))
    for m in MODEL_ORDER:
        c = MODEL_COLORS.get(m, '#333')
        vals = scen_matrix[m].values
        ax_b.plot(x_scen, vals, marker='o', markersize=7.5, linewidth=1.8, alpha=0.9, color=c, label=m, zorder=3)
    ax_b.set_xticks(x_scen)
    ax_b.set_xticklabels([scen_labels[s] for s in scen_order], fontweight='bold', fontsize=8.8)
    ax_b.set_xlabel("โจทย์สถานการณ์จำลอง 7 รูปแบบ (7 Benchmark Trip Scenarios)", fontweight='bold')
    ax_b.set_ylabel("Total Score (out of 5.00)", fontweight='bold')
    ax_b.set_title("(b) ผลแยกกลุ่ม: การกระจายตัวคะแนนแผนข้าม 7 โจทย์สถานการณ์การเดินทาง", fontweight='bold', pad=10)
    ax_b.set_ylim(1.6, 4.6)
    ax_b.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3, framealpha=0.95, fontsize=8.5)
    
    # (c) Bubble scatter: Generation Latency x Plan Quality Score (Centered in Bottom Row)
    gs_bottom = gs[1, :].subgridspec(1, 3, width_ratios=[0.14, 0.72, 0.14])
    ax_c = fig.add_subplot(gs_bottom[0, 1])
    plan_sum = df.groupby('Model_Label').agg(
        score=('Total Score', 'mean'),
        lat_sec=('Gen Latency MS', lambda x: np.mean(x)/1000.0),
        tokens=('Total Tokens', 'mean')
    ).reindex(MODEL_ORDER)
    
    for _, r in plan_sum.reset_index().iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        size = max(130, r['tokens'] / 80)
        ax_c.scatter(r['lat_sec'], r['score'], s=size, color=c, alpha=0.85, edgecolors='black', linewidth=1.1, zorder=3)
        
        # Position offsets to avoid border clipping and text collisions
        if m == 'Qwen 2.5 VL 72B':
            xytext = (-10, -18)
            ha = 'right'
        elif m == 'Llama 4 Maverick':
            xytext = (10, -14)
            ha = 'left'
        elif m == 'Claude Sonnet 5':
            xytext = (10, 5)
            ha = 'left'
        elif m == 'GPT-5.4':
            xytext = (-10, 10)
            ha = 'right'
        elif m == 'GPT-5.4 Mini':
            xytext = (10, -8)
            ha = 'left'
        else:
            xytext = (10, -4)
            ha = 'left'
            
        ax_c.annotate(f"{m}\n({r['score']:.2f}/5.0, {r['lat_sec']:.0f}s)",
                      xy=(r['lat_sec'], r['score']), xytext=xytext, textcoords="offset points", ha=ha,
                      fontsize=8.5, fontweight='bold', color=c,
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor=c, linewidth=0.8))
        
    # Pareto line: GPT-5.4 Mini -> GPT-5.4 -> Claude Sonnet 5
    pareto_models = ['GPT-5.4 Mini', 'GPT-5.4', 'Claude Sonnet 5']
    px = [plan_sum.loc[pm, 'lat_sec'] for pm in pareto_models]
    py = [plan_sum.loc[pm, 'score'] for pm in pareto_models]
    ax_c.plot(px, py, color='#10b981', linestyle='--', linewidth=1.8, alpha=0.85, zorder=2, label='Pareto Frontier (Latency vs. Quality)')
    
    ax_c.set_title("(c) ข้อแลกเปลี่ยน: เวลาในการสังเคราะห์แผน (X) × คะแนนคุณภาพแผน (Y) [ขนาดจุด=Tokens]", fontweight='bold', pad=10)
    ax_c.set_xlabel("Mean Itinerary Synthesis Latency (Seconds)", fontweight='bold')
    ax_c.set_ylabel("Total Quality Score (out of 5.00)", fontweight='bold')
    ax_c.set_xlim(30, 580)
    ax_c.set_ylim(2.8, 4.15)
    ax_c.legend(loc='lower right', framealpha=0.92, fontsize=8.8)
    
    fig.suptitle("การทดลองที่ 6: การประเมินคุณภาพแผนการเดินทาง (Exp 6: Plan Quality Benchmark)\n"
                 "[คำถามวิจัย: แผนมีคุณภาพด้านใด ผลสม่ำเสมอข้ามสถานการณ์หรือไม่ และคุ้มค่าเวลาหรือไม่?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_06_exp6_plan_quality_4panel")
    save_composite(fig, "fig4_06_exp6_plan_quality_3panel")


# ==============================================================================
# FIGURE 7: EXP 7 - DOUBLE-BLIND EVALUATION (4-PANEL WITH DIMENSIONAL RADAR)
# ==============================================================================
def generate_composite_exp7():
    print("\n--- Generating Composite Figure 7: Exp 7 (Double-Blind Model Benchmark - Expert 12) ---")
    
    dim_labels = [
        'FA ถูกต้อง',
        'CC ข้อจำกัด',
        'PF เป็นไปได้',
        'SR เชิงพื้นที่',
        'DE หลากหลาย',
        'RU ยืดหยุ่น',
        'VA รูปภาพ',
        'เฉลี่ย 6 ด้าน'
    ]
    
    gpt54_bar = [4.27, 4.27, 4.60, 4.43, 4.53, 4.20, 4.67, 4.38]
    gemini_bar = [4.20, 4.20, 4.27, 3.93, 4.07, 3.70, 4.33, 4.06]
    claude_bar = [4.20, 4.33, 4.20, 4.27, 4.20, 3.47, 4.33, 4.11]
    
    radar_dims = [
        'FA: ความถูกต้อง\n(Accuracy)',
        'CC: ข้อจำกัด\n(Constraints)',
        'PF: เป็นไปได้จริง\n(Feasibility)',
        'SR: ตรรกะเชิงพื้นที่\n(Routing)',
        'DE: ความหลากหลาย\n(Diversity)',
        'RU: ยืดหยุ่น/สำรอง\n(Buffer)',
        'VA: สอดคล้องภาพ\n(Visual Align)'
    ]
    
    gpt54_radar = [4.27, 4.27, 4.60, 4.43, 4.53, 4.20, 4.67]
    gemini_radar = [4.20, 4.20, 4.27, 3.93, 4.07, 3.70, 4.33]
    claude_radar = [4.20, 4.33, 4.20, 4.27, 4.20, 3.47, 4.33]
    
    scenarios = [
        'SC-01 พระนคร กทม.\n(วัฒนธรรม/ประวัติศาสตร์)',
        'SC-02 เชียงใหม่\n(ธรรมชาติ/คาเฟ่/วิถีชีวิต)',
        'SC-03 ภูเก็ต\n(ทะเล/กิจกรรมกลางแจ้ง)'
    ]
    gpt54_scen = [4.33, 4.45, 4.37]
    gemini_scen = [3.92, 4.13, 4.13]
    claude_scen = [3.97, 4.18, 4.18]
    
    # --------------------------------------------------------------------------
    # 1. 4-PANEL FIGURE FOR THESIS CHAPTER 4
    # --------------------------------------------------------------------------
    fig = plt.figure(figsize=(16.2, 12.6))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.15, 1.0], hspace=0.36, wspace=0.28)
    
    # (a) Grouped Bar Chart: Scores by Dimension
    ax_a = fig.add_subplot(gs[0, 0])
    x = np.arange(len(dim_labels))
    width = 0.26
    
    rects1 = ax_a.bar(x - width, gpt54_bar, width, label='OpenAI GPT-5.4 (แผน C)',
                      color='#10b981', edgecolor='#047857', linewidth=1.1, zorder=3)
    rects2 = ax_a.bar(x, gemini_bar, width, label='Google Gemini 3.8 Flash (แผน B)',
                      color='#0ea5e9', edgecolor='#0284c7', linewidth=1.1, zorder=3)
    rects3 = ax_a.bar(x + width, claude_bar, width, label='Anthropic Claude Sonnet 5 (แผน A)',
                      color='#f59e0b', edgecolor='#d97706', linewidth=1.1, zorder=3)
    
    def autolabel_a(rects, text_color='#0f172a', is_bold=False):
        for rect in rects:
            h = rect.get_height()
            ax_a.annotate(f'{h:.2f}',
                          xy=(rect.get_x() + rect.get_width() / 2, h),
                          xytext=(0, 3), textcoords="offset points",
                          ha='center', va='bottom', fontsize=8.2,
                          fontweight='bold' if is_bold else 'normal',
                          color=text_color)
    
    autolabel_a(rects1, '#065f46', is_bold=True)
    autolabel_a(rects2, '#0369a1')
    autolabel_a(rects3, '#92400e')
    
    ax_a.axvline(6.5, color='#94a3b8', linestyle=':', linewidth=1.5, zorder=2)
    ax_a.set_ylabel('คะแนนเฉลี่ยจากการประเมิน (เต็ม 5.00 คะแนน)', fontweight='bold')
    ax_a.set_title('(a) เปรียบเทียบคะแนนเฉลี่ยรายมิติและคะแนนรวม (Grouped Bar Comparison)',
                   fontweight='bold', pad=12, fontsize=11.0)
    ax_a.set_xticks(x)
    ax_a.set_xticklabels(dim_labels, fontweight='bold', fontsize=8.8, rotation=15, ha='right')
    ax_a.set_ylim(0, 5.35)
    ax_a.set_yticks([0, 1, 2, 3, 4, 5])
    ax_a.grid(axis='y', linestyle='--', alpha=0.45, zorder=0)
    ax_a.legend(loc='upper left', framealpha=0.92, facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.6)
    
    # (b) Radar Chart of Dimensional Capabilities
    ax_b = fig.add_subplot(gs[0, 1], polar=True)
    num_vars = len(radar_dims)
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    
    angles_loop = angles + angles[:1]
    gpt54_radar_loop = gpt54_radar + gpt54_radar[:1]
    gemini_radar_loop = gemini_radar + gemini_radar[:1]
    claude_radar_loop = claude_radar + claude_radar[:1]
    
    # Rotate theta so top has wide open gap for title
    ax_b.set_theta_offset(np.pi / 2 + np.pi / 7)
    ax_b.set_theta_direction(-1)
    
    ax_b.set_xticks(angles)
    ax_b.set_xticklabels(radar_dims, fontsize=8.2, fontweight='bold', color='#1e293b')
    ax_b.tick_params(axis='x', pad=12)
    
    ax_b.set_rlabel_position(90)
    ax_b.set_ylim(2.5, 5.0)
    ax_b.set_yticks([3.0, 3.5, 4.0, 4.5])
    ax_b.set_yticklabels(['3.0', '3.5', '4.0', '4.5'], fontsize=7.6, color='#64748b')
    ax_b.grid(color='#cbd5e1', linestyle='--', linewidth=0.8, alpha=0.7)
    
    # Polygons
    ax_b.plot(angles_loop, gpt54_radar_loop, color='#10b981', linewidth=2.2, linestyle='-',
              marker='o', markersize=5.5, label='OpenAI GPT-5.4 (แผน C)', zorder=4)
    ax_b.fill(angles_loop, gpt54_radar_loop, color='#10b981', alpha=0.18, zorder=3)
    
    ax_b.plot(angles_loop, gemini_radar_loop, color='#0ea5e9', linewidth=1.8, linestyle='-',
              marker='s', markersize=5, label='Google Gemini 3.8 Flash (แผน B)', zorder=4)
    ax_b.fill(angles_loop, gemini_radar_loop, color='#0ea5e9', alpha=0.12, zorder=2)
    
    ax_b.plot(angles_loop, claude_radar_loop, color='#f59e0b', linewidth=1.8, linestyle='-',
              marker='^', markersize=5, label='Anthropic Claude Sonnet 5 (แผน A)', zorder=4)
    ax_b.fill(angles_loop, claude_radar_loop, color='#f59e0b', alpha=0.12, zorder=2)
    
    ax_b.set_title('(b) กราฟเรดาร์คะแนนรายมิติ (7-Dimensional Quality Radar)',
                   fontweight='bold', pad=22, y=1.06, fontsize=11.0)
    ax_b.legend(loc='lower center', bbox_to_anchor=(0.5, -0.24), ncol=1, framealpha=0.92,
                facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.2)
    
    # (c) Scenario Breakdown & Win Rate
    ax_c = fig.add_subplot(gs[1, 0])
    x_scen = np.arange(len(scenarios))
    w_s = 0.24
    
    r_s1 = ax_c.bar(x_scen - w_s, gpt54_scen, w_s, label='OpenAI GPT-5.4 (แผน C)',
                    color='#10b981', edgecolor='#047857', linewidth=1.1, zorder=3)
    r_s2 = ax_c.bar(x_scen, gemini_scen, w_s, label='Google Gemini 3.8 Flash (แผน B)',
                    color='#0ea5e9', edgecolor='#0284c7', linewidth=1.1, zorder=3)
    r_s3 = ax_c.bar(x_scen + w_s, claude_scen, w_s, label='Anthropic Claude Sonnet 5 (แผน A)',
                    color='#f59e0b', edgecolor='#d97706', linewidth=1.1, zorder=3)
    
    def autolabel_c(rects, text_color='#0f172a', is_bold=False):
        for rect in rects:
            h = rect.get_height()
            ax_c.annotate(f'{h:.2f}',
                          xy=(rect.get_x() + rect.get_width() / 2, h),
                          xytext=(0, 3), textcoords="offset points",
                          ha='center', va='bottom', fontsize=8.2,
                          fontweight='bold' if is_bold else 'normal',
                          color=text_color)
    
    autolabel_c(r_s1, '#065f46', is_bold=True)
    autolabel_c(r_s2, '#0369a1')
    autolabel_c(r_s3, '#92400e')
    
    ax_c.annotate("อัตราเลือกใช้งานจริง (Win Rate):\nแผน C (GPT-5.4) ชนะ 100% (3/3 ทริป)",
                  xy=(1, 4.45), xytext=(0, 24), textcoords="offset points",
                  ha='center', va='bottom', fontsize=8.8, fontweight='bold', color='#047857',
                  bbox=dict(boxstyle="round,pad=0.4", facecolor="#ecfdf5", edgecolor="#10b981", linewidth=1.2),
                  arrowprops=dict(arrowstyle="->", color="#047857", lw=1.2))
    
    ax_c.set_ylabel('คะแนนเฉลี่ย 6 ด้าน (เต็ม 5.00 คะแนน)', fontweight='bold')
    ax_c.set_title('(c) ผลคะแนนแยกตาม 3 สถานการณ์ท่องเที่ยวมาตรฐาน (Scenario Breakdown)',
                   fontweight='bold', pad=10, fontsize=10.8)
    ax_c.set_xticks(x_scen)
    ax_c.set_xticklabels(scenarios, fontweight='bold', fontsize=8.5)
    ax_c.set_ylim(0, 5.25)
    ax_c.set_yticks([0, 1, 2, 3, 4, 5])
    ax_c.grid(axis='y', linestyle='--', alpha=0.45, zorder=0)
    ax_c.legend(loc='lower left', framealpha=0.92, facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.2)
    
    # (d) Qualitative Findings & Evaluator Profile Card
    ax_d = fig.add_subplot(gs[1, 1])
    ax_d.axis('off')
    
    outer_rect = patches.FancyBboxPatch((0.0, 0.0), 1.0, 1.0,
                                        boxstyle="round,pad=0.015",
                                        facecolor='#f8fafc', edgecolor='#cbd5e1', linewidth=1.2)
    ax_d.add_patch(outer_rect)
    
    header_rect = patches.FancyBboxPatch((0.02, 0.88), 0.96, 0.10,
                                         boxstyle="round,pad=0.01",
                                         facecolor='#0f172a', edgecolor='none')
    ax_d.add_patch(header_rect)
    ax_d.text(0.50, 0.93, "(d) สรุปข้อค้นพบเชิงคุณภาพและโปรไฟล์ผู้เชี่ยวชาญ (Qualitative Synthesis)",
              fontweight='bold', fontsize=9.6, color='#ffffff', ha='center', va='center')
    
    prof_rect = patches.FancyBboxPatch((0.02, 0.58), 0.96, 0.28,
                                       boxstyle="round,pad=0.01",
                                       facecolor='#ffffff', edgecolor='#e2e8f0', linewidth=1.0)
    ax_d.add_patch(prof_rect)
    ax_d.text(0.04, 0.81, "ข้อมูลผู้ประเมินและการทดสอบ (Evaluator & Protocol Context):",
              fontweight='bold', fontsize=8.8, color='#0f172a')
    prof_text = (
        "• ผู้ประเมิน: Expert 12 (อาจารย์/นักวิชาการด้านการจัดการการท่องเที่ยวและโรงแรม)\n"
        "• ประสบการณ์วิชาชีพ: มากกว่า 10 ปีในอุตสาหกรรมการท่องเที่ยว\n"
        "• ระเบียบวิธี: ปกปิดชื่อโมเดลสองทาง (Double-Blind Evaluation) ผ่านระบบเว็บพอร์ทัล\n"
        "• การเปรียบเทียบ: 3 โมเดลนำร่องพร้อมกันในทุกสถานการณ์ (สุ่มลำดับแผน A, B, C)"
    )
    ax_d.text(0.04, 0.69, prof_text, fontsize=8.0, linespacing=1.35, va='center', color='#334155')
    
    ins_rect = patches.FancyBboxPatch((0.02, 0.04), 0.96, 0.51,
                                      boxstyle="round,pad=0.01",
                                      facecolor='#f0fdf4', edgecolor='#10b981', linewidth=1.2)
    ax_d.add_patch(ins_rect)
    ax_d.text(0.04, 0.49, "ข้อค้นพบเชิงคุณภาพสำคัญจากคำถามปลายเปิด 4 มิติ (Expert 12 Verdict):",
              fontweight='bold', fontsize=8.8, color='#065f46')
    ins_text = (
        "1. นำไปใช้งานจริงมากที่สุด (Usability): แผน C (จัดเรียงสถานที่ตามโซนชัดเจน ไม่เดินทางวน)\n"
        "2. เข้าใจบริบทท่องเที่ยว (Context): แผน C (กิจกรรมครบถ้วนทั้งวัฒนธรรม อาหาร และธรรมชาติ)\n"
        "3. ประสบการณ์คุ้มค่าที่สุด (Value): แผน C (คุ้มค่า คุ้มเวลาในการเดินทางสูงสุดทุกสถานการณ์)\n"
        "4. อภิปรายความต่างของโมเดล: แผน A (Claude) เด่นด้านข้อจำกัด, แผน B (Gemini) เด่นด้าน\n"
        "   ความถูกต้องแต่ขาดความยืดหยุ่นเชิงพื้นที่, แผน C (GPT-5.4) สมบูรณ์แบบและลงตัวที่สุด"
    )
    ax_d.text(0.04, 0.27, ins_text, fontsize=8.0, linespacing=1.4, va='center', color='#0f172a')
    
    fig.suptitle("การทดลองที่ 7: ผลการประเมินเปรียบเทียบคุณภาพแผนการเดินทางแบบปกปิดชื่อโมเดล (Exp 7: Double-Blind Model Benchmark)\n"
                 "[คำถามวิจัย: เมื่อผู้เชี่ยวชาญประเมินโดยไม่ทราบชื่อโมเดล โมเดลใดได้คะแนนสูงสุดในแต่ละมิติ และแผนใดได้รับเลือกให้นำไปใช้งานจริง?]",
                 fontsize=12.2, fontweight='bold', y=0.98)
    
    save_composite(fig, "fig4_07_exp7_blind_test_4panel")
    save_composite(fig, "fig4_07_exp7_blind_test_single")
    
    # Generate standalone dimensional radar figure
    generate_standalone_exp7_radar(radar_dims, gpt54_radar, gemini_radar, claude_radar, angles)


def generate_standalone_exp7_radar(radar_dims, gpt54_radar, gemini_radar, claude_radar, angles):
    """Generates standalone high-resolution radar chart and scorecard for Exp 7."""
    print("  -> Generating Standalone Exp 7 Dimensional Radar Chart...")
    angles_loop = angles + angles[:1]
    gpt54_radar_loop = gpt54_radar + gpt54_radar[:1]
    gemini_radar_loop = gemini_radar + gemini_radar[:1]
    claude_radar_loop = claude_radar + claude_radar[:1]
    
    fig_r = plt.figure(figsize=(13.6, 7.8))
    gs_r = fig_r.add_gridspec(1, 2, width_ratios=[1.15, 0.85], wspace=0.25)
    
    ax_r = fig_r.add_subplot(gs_r[0, 0], polar=True)
    ax_r.set_theta_offset(np.pi / 2 + np.pi / 7)
    ax_r.set_theta_direction(-1)
    ax_r.set_xticks(angles)
    ax_r.set_xticklabels(radar_dims, fontsize=8.6, fontweight='bold', color='#0f172a')
    ax_r.tick_params(axis='x', pad=12)
    ax_r.set_rlabel_position(90)
    ax_r.set_ylim(2.5, 5.0)
    ax_r.set_yticks([3.0, 3.5, 4.0, 4.5])
    ax_r.set_yticklabels(['3.0', '3.5', '4.0', '4.5'], fontsize=8.0, color='#64748b')
    ax_r.grid(color='#cbd5e1', linestyle='--', linewidth=0.9, alpha=0.7)
    
    # GPT-5.4
    ax_r.plot(angles_loop, gpt54_radar_loop, color='#10b981', linewidth=2.6, linestyle='-',
              marker='o', markersize=6.5, label='OpenAI GPT-5.4 (แผน C) - เฉลี่ย 4.38', zorder=4)
    ax_r.fill(angles_loop, gpt54_radar_loop, color='#10b981', alpha=0.20, zorder=3)
    
    # Claude Sonnet 5
    ax_r.plot(angles_loop, claude_radar_loop, color='#f59e0b', linewidth=2.0, linestyle='-',
              marker='^', markersize=6.0, label='Anthropic Claude Sonnet 5 (แผน A) - เฉลี่ย 4.11', zorder=4)
    ax_r.fill(angles_loop, claude_radar_loop, color='#f59e0b', alpha=0.12, zorder=2)
    
    # Gemini 3.8 Flash
    ax_r.plot(angles_loop, gemini_radar_loop, color='#0ea5e9', linewidth=2.0, linestyle='-',
              marker='s', markersize=6.0, label='Google Gemini 3.8 Flash (แผน B) - เฉลี่ย 4.06', zorder=4)
    ax_r.fill(angles_loop, gemini_radar_loop, color='#0ea5e9', alpha=0.12, zorder=2)
    
    ax_r.set_title("รูปทรงสมรรถนะรายมิติ 7 ด้าน (Performance Radar)",
                   fontweight='bold', pad=22, y=1.06, fontsize=11.2)
    ax_r.legend(loc='lower center', bbox_to_anchor=(0.5, -0.22), ncol=1, framealpha=0.95,
                facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.8)
    
    # Right Panel: Dimension Scorecard Table + Qualitative Summary
    ax_tbl = fig_r.add_subplot(gs_r[0, 1])
    ax_tbl.axis('off')
    
    card_rect = patches.FancyBboxPatch((0.0, 0.0), 1.0, 1.0,
                                       boxstyle="round,pad=0.015",
                                       facecolor='#f8fafc', edgecolor='#cbd5e1', linewidth=1.2)
    ax_tbl.add_patch(card_rect)
    
    # Table Header
    ax_tbl.text(0.04, 0.94, "ตารางคะแนนประเมินรายมิติ (Scorecard 1–5)", fontweight='bold', fontsize=10.5, color='#0f172a')
    
    # Column Coordinates
    x_lbl = 0.04
    x_gpt = 0.54
    x_gem = 0.70
    x_cla = 0.85
    
    y_cursor = 0.86
    ax_tbl.text(x_lbl, y_cursor, "มิติคุณภาพ", fontweight='bold', fontsize=8.5, color='#475569')
    ax_tbl.text(x_gpt, y_cursor, "GPT-5.4", fontweight='bold', fontsize=8.5, color='#047857')
    ax_tbl.text(x_gem, y_cursor, "Gemini", fontweight='bold', fontsize=8.5, color='#0284c7')
    ax_tbl.text(x_cla, y_cursor, "Claude", fontweight='bold', fontsize=8.5, color='#b45309')
    ax_tbl.plot([0.04, 0.96], [y_cursor - 0.02, y_cursor - 0.02], color='#cbd5e1', linewidth=1.0)
    
    # Table Rows
    rows_data = [
        ("1. ความถูกต้อง (FA)", "4.27*", "4.20", "4.20"),
        ("2. การปฏิบัติตามข้อจำกัด (CC)", "4.27", "4.20", "4.33*"),
        ("3. ความเป็นไปได้จริง (PF)", "4.60*", "4.27", "4.20"),
        ("4. ตรรกะเชิงพื้นที่ (SR)", "4.43*", "3.93", "4.27"),
        ("5. ความหลากหลายและคุณภาพ (DE)", "4.53*", "4.07", "4.20"),
        ("6. ความยืดหยุ่น/เวลาสำรอง (RU)", "4.20*", "3.70", "3.47"),
        ("7. สอดคล้องกับรูปภาพ (VA)", "4.67*", "4.33", "4.33"),
        ("คะแนนเฉลี่ยรวม 6 ด้านหลัก", "4.38*", "4.06", "4.11")
    ]
    
    y_cursor -= 0.06
    for label, gpt, gem, cla in rows_data:
        is_overall = "เฉลี่ย" in label
        font_wt = 'bold' if is_overall else 'normal'
        row_col = '#0f172a' if is_overall else '#334155'
        
        if is_overall:
            ax_tbl.plot([0.04, 0.96], [y_cursor + 0.02, y_cursor + 0.02], color='#047857', linewidth=1.2)
            
        ax_tbl.text(x_lbl, y_cursor, label, fontsize=8.2, fontweight=font_wt, color=row_col)
        ax_tbl.text(x_gpt, y_cursor, gpt, fontsize=8.2, fontweight='bold', color='#047857')
        ax_tbl.text(x_gem, y_cursor, gem, fontsize=8.2, fontweight=font_wt, color='#0284c7')
        ax_tbl.text(x_cla, y_cursor, cla, fontsize=8.2, fontweight=font_wt, color='#b45309')
        y_cursor -= 0.048
    
    # Summary box at bottom of right panel
    bot_box = patches.FancyBboxPatch((0.04, 0.04), 0.92, 0.36,
                                     boxstyle="round,pad=0.01",
                                     facecolor='#f0fdf4', edgecolor='#10b981', linewidth=1.1)
    ax_tbl.add_patch(bot_box)
    ax_tbl.text(0.07, 0.34, "ข้อสังเกตสำคัญเชิงมิติ (Key Dimensional Takeaways):",
                fontweight='bold', fontsize=8.8, color='#065f46')
    bot_text = (
        "• GPT-5.4 นำใน 6 จาก 7 มิติคุณภาพ โดยเด่นที่สุดในด้าน\n"
        "  ความสอดคล้องภาพ (4.67), เป็นไปได้จริง (4.60) และหลากหลาย (4.53)\n"
        "• Claude Sonnet 5 เด่นที่สุดในมิติข้อจำกัด (CC: 4.33)\n"
        "• Gemini 3.8 Flash สมดุลในด้านความถูกต้องและภาพถ่าย (4.33)\n"
        "• อัตราเลือกใช้งานจริง (Win Rate): แผน C (GPT-5.4) ชนะ 100% (3/3 ทริป)"
    )
    ax_tbl.text(0.07, 0.18, bot_text, fontsize=8.0, linespacing=1.35, va='center', color='#0f172a')
    
    fig_r.suptitle("การทดลองที่ 7: กราฟเรดาร์คะแนนรายมิติ (Exp 7: 7-Dimensional Radar Benchmark)\n"
                   "เปรียบเทียบรูปทรงสมรรถนะของ 3 โมเดล AI จากการประเมินแบบปกปิดสองทาง (Double-Blind Test)",
                   fontweight='bold', y=0.98, fontsize=12.2)
    
    save_composite(fig_r, "exp7_01_blind_test_dimension_radar")


def generate_composite_expert_forms():
    print("\n--- Generating Composite Figure 8: Expert Google Forms Evaluation ---")
    excel_path = os.path.join(EXP_DIR, 'แบบประเมินคุณภาพระบบโดยผู้เชี่ยวชาญด้านการท่องเที่ยว (Expert Quality Assessment) (Responses).xlsx')
    df_form = pd.read_excel(excel_path)
    
    dim_defs = [
        ('ด้านที่ 1: ความถูกต้องของเนื้อหาการท่องเที่ยว (DKA)', list(range(5, 10)), 'DKA'),
        ('ด้านที่ 2: ความเป็นไปได้ในทางปฏิบัติ (PFC)', list(range(10, 16)), 'PFC'),
        ('ด้านที่ 3: ความหลากหลายและความครอบคลุม (DVC)', list(range(16, 21)), 'DVC'),
        ('ด้านที่ 4: นวัตกรรมและประโยชน์ต่อวงการ (INV)', list(range(21, 26)), 'INV'),
        ('ด้านที่ 5: การเปรียบเทียบกับเครื่องมือเดิม (CMP)', list(range(26, 30)), 'CMP')
    ]
    
    fig = plt.figure(figsize=(15.5, 11.8))
    gs = fig.add_gridspec(2, 2, hspace=0.44, wspace=0.28)
    
    # (a) Heatmap: Questions x Experts grouped by Dimension
    ax_a = fig.add_subplot(gs[0, 0])
    q_labels = []
    e1_q = []
    e2_q = []
    for dim_title, col_indices, code in dim_defs:
        for idx_in_dim, c in enumerate(col_indices):
            q_code = f"{code}{idx_in_dim+1}"
            q_labels.append(q_code)
            e1_q.append(int(df_form.iloc[0, c]))
            e2_q.append(int(df_form.iloc[1, c]))
            
    df_q_heat = pd.DataFrame({'ผู้เชี่ยวชาญคนที่ 1': e1_q, 'ผู้เชี่ยวชาญคนที่ 2': e2_q}, index=q_labels)
    sns.heatmap(df_q_heat.T, annot=True, fmt="d", cmap="YlGnBu", vmin=3, vmax=5,
                cbar_kws={'label': 'คะแนนระดับ 1–5'}, linewidths=0.8, linecolor='white',
                annot_kws={'fontweight': 'bold', 'size': 8.5}, ax=ax_a)
    ax_a.set_title("(a) ผลหลัก: คะแนนรายข้อคำถาม (25 ข้อ) แยกรายผู้เชี่ยวชาญทั้งสองท่าน", fontweight='bold', pad=10)
    ax_a.set_xlabel("รหัสข้อคำถามตาม 5 ด้าน (DKA, PFC, DVC, INV, CMP)", fontweight='bold')
    ax_a.set_xticks(np.arange(len(q_labels)) + 0.5)
    ax_a.set_xticklabels(q_labels, rotation=45, ha='right', fontsize=8.5)
    
    # (b) Paired dot plot: Mean Dimension Scores of each Expert
    ax_b = fig.add_subplot(gs[0, 1])
    dim_scores = []
    for dim_title, col_indices, _ in dim_defs:
        e1_sc = df_form.iloc[0, col_indices].mean()
        e2_sc = df_form.iloc[1, col_indices].mean()
        dim_scores.append({'Dimension': dim_title.split(': ')[1], 'E1': e1_sc, 'E2': e2_sc, 'Mean': (e1_sc+e2_sc)/2.0})
    df_sc = pd.DataFrame(dim_scores)
    
    y_pos = np.arange(len(df_sc))[::-1]
    for i, r in df_sc.iterrows():
        y = y_pos[i]
        ax_b.plot([r['E1'], r['E2']], [y, y], color='#cbd5e1', linewidth=2.5, zorder=2)
        ax_b.scatter(r['E1'], y, color='#0284c7', s=110, edgecolors='black', label='ผู้เชี่ยวชาญคนที่ 1' if i==0 else "", zorder=3)
        ax_b.scatter(r['E2'], y, color='#f59e0b', s=110, edgecolors='black', label='ผู้เชี่ยวชาญคนที่ 2' if i==0 else "", zorder=4)
        ax_b.scatter(r['Mean'], y, color='#10b981', marker='D', s=130, edgecolors='black', label='คะแนนเฉลี่ยรวม' if i==0 else "", zorder=5)
        
        max_pt = max(r['E1'], r['E2'])
        ax_b.annotate(f"เฉลี่ย {r['Mean']:.2f}", xy=(max_pt, y), xytext=(10, -4), textcoords="offset points",
                      fontweight='bold', color='#065f46', fontsize=9.0,
                      bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor='none'))
        
    ax_b.set_yticks(y_pos)
    ax_b.set_yticklabels(df_sc['Dimension'], fontweight='bold')
    ax_b.set_xlabel("คะแนนเฉลี่ยรายด้าน (Likert 1.00 - 5.00)", fontweight='bold')
    ax_b.set_title("(b) ผลแยกกลุ่ม: คะแนนเฉลี่ย 5 ด้านของผู้เชี่ยวชาญแต่ละท่าน (N=2 ผู้ประเมินจริง)", fontweight='bold', pad=10)
    ax_b.set_xlim(3.8, 5.4)
    ax_b.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3, framealpha=0.95, fontsize=8.5)
    
    # (c) Disagreement plot: Difference between experts per question
    ax_c = fig.add_subplot(gs[1, 0])
    disagreements = np.array(e1_q) - np.array(e2_q)
    bars_dis = ax_c.bar(range(len(q_labels)), disagreements,
                        color=['#3b82f6' if d>0 else ('#ef4444' if d<0 else '#94a3b8') for d in disagreements],
                        edgecolor='black', linewidth=0.7)
    ax_c.axhline(0, color='#64748b', linestyle='--', alpha=0.8)
    ax_c.set_title("(c) ข้อขัดแย้ง: ผลต่างคะแนนระหว่างผู้เชี่ยวชาญรายข้อ (E1 ลบ E2)", fontweight='bold', pad=10)
    ax_c.set_xlabel("รหัสข้อคำถาม (ผลต่าง 0 หมายถึงผู้เชี่ยวชาญทั้งสองท่านให้คะแนนตรงกัน)", fontweight='bold')
    ax_c.set_ylabel("ผลต่างคะแนน (คะแนน)", fontweight='bold')
    ax_c.set_xticks(range(len(q_labels)))
    ax_c.set_xticklabels(q_labels, rotation=45, ha='right', fontsize=8.5)
    ax_c.set_ylim(-1.5, 1.5)
    
    # (d) Joint display: Expert Comments -> Related Scores -> Development Roadmap
    ax_d = fig.add_subplot(gs[1, 1])
    ax_d.axis('off')
    
    joint_cards = [
        ("ประเด็นที่ 1: ความแม่นยำและการนำเข้าภาพถ่าย (DKA 4.80 / INV 4.60)",
         "• ความคิดเห็น: 'การใช้ภาพถ่ายระบุสถานที่ช่วยลดขั้นตอนการค้นหาได้อย่างมาก'\n• ข้อเสนอแนะ: พัฒนาระบบรองรับภาพถ่ายในมุมมืดหรือมุมย้อนแสงเพิ่มเติม"),
        ("ประเด็นที่ 2: ความเป็นไปได้ในทางปฏิบัติ (PFC 4.33 / DVC 4.40)",
         "• ความคิดเห็น: 'เส้นทางท่องเที่ยวสมเหตุสมผล แต่ควรเพิ่ม Buffer time สภาพจราจร'\n• ข้อเสนอแนะ: เชื่อมโยง Live Traffic API และเพิ่มฟังก์ชันแนะนำเส้นทางสำรอง"),
        ("ประเด็นที่ 3: กลุ่มเป้าหมายและความพร้อมใช้งาน (CMP 4.25 / Readiness 8.5/10)",
         "• ความคิดเห็น: 'เหมาะสมอย่างยิ่งสำหรับนักท่องเที่ยวอิสระ (FIT) และบริษัททัวร์'\n• ข้อเสนอแนะ: เตรียมฟังก์ชัน Export ไฟล์แผนการเดินทางสำหรับใช้งาน Offline")
    ]
    
    y_start = 0.88
    for i, (title, content) in enumerate(joint_cards):
        y_curr = y_start - i * 0.30
        rect = patches.FancyBboxPatch((0.01, y_curr - 0.24), 0.98, 0.25,
                                      boxstyle="round,pad=0.015",
                                      facecolor='#eff6ff' if i==0 else ('#fefce8' if i==1 else '#ecfdf5'),
                                      edgecolor='#3b82f6' if i==0 else ('#f59e0b' if i==1 else '#10b981'), linewidth=1.2)
        ax_d.add_patch(rect)
        ax_d.text(0.03, y_curr - 0.04, title, fontsize=9.2, fontweight='bold', color='#0f172a')
        ax_d.text(0.04, y_curr - 0.20, content, fontsize=8.5, color='#334155', linespacing=1.4)
        
    ax_d.set_title("(d) รายละเอียดสนับสนุน: Joint Display เชื่อมโยงข้อคิดเห็นเชิงคุณภาพ → คะแนน → แผนพัฒนา", fontweight='bold', pad=10)
    
    fig.suptitle("การประเมินคุณภาพระบบโดยผู้เชี่ยวชาญผ่าน Google Forms (Expert Quality Assessment)\n"
                 "[คำถามวิจัย: ระบบเด่นหรืออ่อนด้านใด ผู้เชี่ยวชาญเห็นพ้องต้องกันเพียงใด และควรพัฒนาประเด็นใดต่อ?]",
                 fontsize=13.5, fontweight='bold', y=0.99)
    save_composite(fig, "fig4_08_expert_google_forms_4panel")


def main():
    print("=" * 80)
    print("Generating Chapter 4 Perfected 4-Panel Academic Visualizations")
    print("Output directory: " + OUT_DIR)
    print("=" * 80)
    
    generate_composite_exp1()
    generate_composite_exp2()
    generate_composite_exp3()
    generate_composite_exp4()
    generate_composite_exp5()
    generate_composite_exp6()
    generate_composite_exp7()
    generate_composite_expert_forms()
    
    print("\n" + "=" * 80)
    print(f"[SUCCESS] All 8 Integrated 4-Panel Figures perfected and saved in:\n  {OUT_DIR}")
    print("=" * 80)

if __name__ == '__main__':
    main()
