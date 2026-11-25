# -*- coding: utf-8 -*-
"""
generate_chapter4_synthesis_figures.py
================================================================================
Generates 2 High-Impact, Top-Tier Publication 4-Panel Synthesis Figures for Chapter 4:
  1. fig4_09_cross_experiment_cost_synthesis_4panel (.png & .pdf)
  2. fig4_10_cross_model_capability_synthesis_4panel (.png & .pdf)

Refined according to publication guidelines:
  - All legends moved OUTSIDE of the plotting areas (Zero overlap with data).
  - Unnecessary verbose text boxes and clutter completely removed.
  - Clean, elegant academic data visualization with clear axes and annotations.
================================================================================
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Academic Styling with Thai & Latin font support
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Tahoma', 'Leelawadee UI', 'DejaVu Sans', 'Arial']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10.0
plt.rcParams['axes.titlesize'] = 11.5
plt.rcParams['axes.labelsize'] = 10.2
plt.rcParams['xtick.labelsize'] = 9.2
plt.rcParams['ytick.labelsize'] = 9.2
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
    'meta-llama4': 'Llama 4 Maverick'
}

MODEL_COLORS = {
    'Gemini 3.8 Flash': '#0284c7',       # Vibrant Blue
    'Claude Sonnet 5': '#8b5cf6',        # Royal Purple
    'GPT-5.4': '#10b981',                # Emerald Green
    'GPT-5.4 Mini': '#06b6d4',           # Teal
    'Qwen 2.5 VL 72B': '#f59e0b',        # Amber
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

MODEL_MARKERS = {
    'Gemini 3.8 Flash': 'o',
    'Claude Sonnet 5': 's',
    'GPT-5.4': '^',
    'GPT-5.4 Mini': 'D',
    'Qwen 2.5 VL 72B': 'P',
    'Llama 4 Maverick': 'X'
}

import time

def save_figure(fig, filename_base):
    png_path = os.path.join(OUT_DIR, f"{filename_base}.png")
    pdf_path = os.path.join(OUT_DIR, f"{filename_base}.pdf")
    for attempt in range(5):
        try:
            fig.savefig(png_path, dpi=300, bbox_inches='tight')
            fig.savefig(pdf_path, bbox_inches='tight')
            break
        except (OSError, PermissionError) as e:
            if attempt < 4:
                time.sleep(0.8)
            else:
                raise e
    plt.close(fig)
    print(f"  [+] Saved: {filename_base}.png & .pdf")


# ==============================================================================
# FIGURE 1: COST SYNTHESIS (fig4_09)
# ==============================================================================
def generate_figure_cost_synthesis():
    print("\n--- Generating Figure 4.9: Clean Cost Synthesis (Legends Outside) ---")
    fig = plt.figure(figsize=(17.5, 13.8))
    gs = fig.add_gridspec(2, 2, hspace=0.48, wspace=0.28, bottom=0.08, top=0.88)
    
    experiments = [
        'Exp 1: Prompt',
        'Exp 2: Benchmark',
        'Exp 3: Two-Turn',
        'Exp 4: Robustness',
        'Exp 5: Consistency',
        'Exp 6: Plan Quality'
    ]
    
    # --------------------------------------------------------------------------
    # Panel (a): Cross-Experiment Cost per 1,000 Queries by Model (Log Scale)
    # --------------------------------------------------------------------------
    ax_a = fig.add_subplot(gs[0, 0])
    
    cost_data = {
        'Claude Sonnet 5':  [5.45, 4.26, 17.61, 4.07, 4.57, 276.35],
        'Gemini 3.8 Flash': [4.89, 4.12, 12.07, 3.67, 3.89,   6.26],
        'GPT-5.4':          [4.63, 4.01, 13.89, 3.83, 4.29, 143.43],
        'GPT-5.4 Mini':     [1.32, 1.16,  3.80, 1.10, 0.98,   6.05],
        'Qwen 2.5 VL 72B':  [1.14, 0.98,  3.19, 0.96, 0.63,  21.07],
        'Llama 4 Maverick': [0.49, 0.56,  1.15, 0.50, 0.38,   6.24]
    }
    
    x = np.arange(len(experiments))
    n_models = len(MODEL_ORDER)
    bar_width = 0.13
    offsets = np.linspace(-bar_width * (n_models - 1) / 2, bar_width * (n_models - 1) / 2, n_models)
    
    for i, m in enumerate(MODEL_ORDER):
        vals = cost_data[m]
        ax_a.bar(x + offsets[i], vals, width=bar_width, color=MODEL_COLORS[m],
                 label=m, alpha=0.9, edgecolor='black', linewidth=0.5, zorder=3)
    
    ax_a.set_yscale('log')
    ax_a.set_ylabel('Cost per 1,000 Queries (USD $, Log Scale)', fontweight='bold')
    ax_a.set_xticks(x)
    ax_a.set_xticklabels(experiments, fontweight='bold', fontsize=9.2)
    ax_a.set_ylim(0.2, 500)
    
    ax_a.set_yticks([0.5, 1.0, 2.0, 5.0, 10.0, 25.0, 50.0, 100.0, 300.0])
    ax_a.get_yaxis().set_major_formatter(plt.ScalarFormatter())
    
    # Subtle section divider between VPR (Exp 1-5) and Plan (Exp 6)
    ax_a.axvline(4.5, color='#94a3b8', linestyle=':', linewidth=1.5, zorder=2)
    
    # Legend placed strictly OUTSIDE below the plot
    ax_a.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3,
                frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1', framealpha=0.95)
    ax_a.set_title('(a) สรุปต้นทุนต่อ 1,000 คำขอแยกตามการทดลองและโมเดล (Log-scale USD)', fontweight='bold', pad=10)
    
    # --------------------------------------------------------------------------
    # Panel (b): Token Scaling & Context Growth (Prompt vs. Completion vs. Cost)
    # --------------------------------------------------------------------------
    ax_b1 = fig.add_subplot(gs[0, 1])
    ax_b2 = ax_b1.twinx()
    
    prompt_tokens = [1230, 1208, 4038, 1061,  656,  3595]
    comp_tokens   = [ 258,  179,  511,  269,  803, 16384]
    cost_per_req  = [0.00299, 0.00251, 0.00862, 0.00235, 0.00246, 0.07657]
    
    x_b = np.arange(len(experiments))
    w_b = 0.50
    
    b_p = ax_b1.bar(x_b, prompt_tokens, width=w_b, label='Prompt Tokens (Input)', color='#3b82f6', alpha=0.85, edgecolor='black', linewidth=0.6, zorder=3)
    b_c = ax_b1.bar(x_b, comp_tokens, bottom=prompt_tokens, width=w_b, label='Completion Tokens (Output)', color='#f59e0b', alpha=0.9, edgecolor='black', linewidth=0.6, zorder=3)
    
    line_cost = ax_b2.plot(x_b, [c * 1000 for c in cost_per_req], color='#dc2626', marker='o', linewidth=2.4, markersize=8, label='Mean Cost / 1k Queries ($)', zorder=5)
    
    ax_b1.set_ylabel('จำนวนโทเค็นเฉลี่ยต่อคำขอ (Tokens)', fontweight='bold')
    ax_b2.set_ylabel('ต้นทุนเฉลี่ยต่อ 1,000 คำขอ ($ USD)', color='#dc2626', fontweight='bold')
    ax_b2.tick_params(axis='y', labelcolor='#dc2626')
    ax_b1.set_xticks(x_b)
    ax_b1.set_xticklabels(experiments, fontweight='bold', fontsize=9.2)
    ax_b1.set_ylim(0, 24000)
    ax_b2.set_ylim(0, 95)
    
    # Legend placed strictly OUTSIDE below the plot
    handles = [b_p, b_c, line_cost[0]]
    labels = [h.get_label() for h in handles]
    ax_b1.legend(handles, labels, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3,
                 frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1')
    ax_b1.set_title('(b) การเติบโตของขนาดโทเค็น (Prompt vs. Completion) และผลกระทบต่อต้นทุน', fontweight='bold', pad=10)
    
    # --------------------------------------------------------------------------
    # Panel (c): Computational ROI of Enhancements (ΔCost vs. ΔPerformance)
    # --------------------------------------------------------------------------
    ax_c = fig.add_subplot(gs[1, 0])
    
    # Points with concise labels
    roi_points = [
        ('P2: Expert Persona', 6.64, 3.75, '#16a34a', (10, 8)),
        ('P3: Chain-of-Thought', 43.36, 2.08, '#f59e0b', (10, 8)),
        ('P4: Native Thai', 28.12, -1.25, '#dc2626', (10, -14)),
        ('P5: Few-Shot', 3.91, -2.50, '#991b1b', (-15, -16)),
        ('Exp 3: Two-Turn Pipeline', 243.0, 21.53, '#2563eb', (-150, 10))
    ]
    
    # Subtle quadrant lines and light background tint
    ax_c.axhline(0, color='#64748b', linestyle='-', linewidth=1.2, zorder=2)
    ax_c.axvline(0, color='#64748b', linestyle='-', linewidth=1.2, zorder=2)
    ax_c.axhspan(0, 26, xmin=0.0, xmax=1.0, color='#f0fdf4', alpha=0.35, zorder=1)
    ax_c.axhspan(-6, 0, xmin=0.0, xmax=1.0, color='#fef2f2', alpha=0.35, zorder=1)
    
    # Simple corner labels for quadrants (minimalist)
    ax_c.text(260, 24, '+Accuracy / +Cost', ha='right', fontsize=8.2, color='#15803d', fontweight='bold')
    ax_c.text(260, -4.5, '-Accuracy / +Cost', ha='right', fontsize=8.2, color='#b91c1c', fontweight='bold')
    
    for label, d_cost, d_acc, col, offset in roi_points:
        ax_c.scatter(d_cost, d_acc, s=180, color=col, edgecolors='black', linewidth=1.0, zorder=4)
        ax_c.annotate(f"{label} (ΔCost: {d_cost:+.1f}%, ΔAcc: {d_acc:+.1f}%)",
                     xy=(d_cost, d_acc), xytext=offset, textcoords='offset points',
                     fontsize=8.5, fontweight='bold', color='#0f172a',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='#ffffff', edgecolor=col, alpha=0.95))
    
    ax_c.set_xlabel('ภาระต้นทุนส่วนเพิ่ม เทียบกับเบสไลน์ (ΔCost %)', fontweight='bold')
    ax_c.set_ylabel('ผลตอบแทนความแม่นยำส่วนเพิ่ม (ΔAccuracy %)', fontweight='bold')
    ax_c.set_xlim(-15, 275)
    ax_c.set_ylim(-6, 26)
    ax_c.set_title('(c) การวิเคราะห์ผลตอบแทนการลงทุนเชิงคำนวณ (Computational ROI: ΔCost vs. ΔPerformance)', fontweight='bold', pad=10)
    
    # --------------------------------------------------------------------------
    # Panel (d): Production Scalability Simulation (10k to 1M Trips)
    # --------------------------------------------------------------------------
    ax_d = fig.add_subplot(gs[1, 1])
    
    trips = np.array([10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000])
    
    # Cost per trip (5 VPR calls + 1 plan call)
    cost_claude = trips * (5 * 0.00426 + 0.27635)
    cost_gpt54  = trips * (5 * 0.00401 + 0.14343)
    cost_gemini = trips * (5 * 0.00412 + 0.00626)
    cost_pixo   = trips * (5 * 0.00412 + 0.00626)
    cost_llama  = trips * (5 * 0.00056 + 0.00624)
    
    ax_d.plot(trips, cost_claude, color=MODEL_COLORS['Claude Sonnet 5'], marker='s', linewidth=2.2, label='Claude Sonnet 5', zorder=4)
    ax_d.plot(trips, cost_gpt54,  color=MODEL_COLORS['GPT-5.4'], marker='^', linewidth=2.2, label='GPT-5.4', zorder=4)
    ax_d.plot(trips, cost_gemini, color=MODEL_COLORS['Gemini 3.8 Flash'], marker='o', linewidth=2.5, linestyle='-', label='Gemini 3.8 Flash', zorder=5)
    ax_d.plot(trips, cost_pixo,   color='#0f172a', marker='*', markersize=10, linewidth=2.0, linestyle='--', label='[Proposed] Pixinerary Hybrid Pipeline', zorder=6)
    ax_d.plot(trips, cost_llama,  color=MODEL_COLORS['Llama 4 Maverick'], marker='X', linewidth=1.8, linestyle=':', label='Llama 4 Maverick', zorder=3)
    
    # Clean Shaded Ribbon
    ax_d.fill_between(trips, cost_pixo, cost_claude, color='#8b5cf6', alpha=0.10)
    
    ax_d.set_xscale('log')
    ax_d.set_yscale('log')
    ax_d.set_xlabel('จำนวนคำขอวางแผนท่องเที่ยวต่อปี (Trips / Year, Log Scale)', fontweight='bold')
    ax_d.set_ylabel('งบประมาณค่าบริการคลาวด์ต่อปี (Annual OPEX in USD $, Log Scale)', fontweight='bold')
    ax_d.set_xticks([10_000, 50_000, 100_000, 500_000, 1_000_000])
    ax_d.get_xaxis().set_major_formatter(plt.FuncFormatter(lambda val, pos: f"{int(val):,}"))
    ax_d.set_yticks([100, 500, 1000, 5000, 10000, 50000, 100000, 300000])
    ax_d.get_yaxis().set_major_formatter(plt.FuncFormatter(lambda val, pos: f"${int(val):,}"))
    
    # Legend placed strictly OUTSIDE below the plot
    ax_d.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3,
                frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.2)
    ax_d.set_title('(d) การจำลองงบประมาณคลาวด์รายปีระดับโปรดักชันจริง (Production Scalability Simulation)', fontweight='bold', pad=10)
    
    fig.suptitle('ภาพที่ 4.9: การสังเคราะห์ต้นทุน ปริมาณโทเค็น และการจำลองความคุ้มค่าเชิงพาณิชย์ข้ามการทดลอง\n'
                 '[คำถามวิจัย: ภาระเชิงคำนวณและต้นทุน API เปลี่ยนแปลงอย่างไรตามประเภทงาน และระบบประหยัดงบประมาณได้เพียงใด?]',
                 fontsize=13.0, fontweight='bold', y=0.975)
    
    save_figure(fig, "fig4_09_cross_experiment_cost_synthesis_4panel")


# ==============================================================================
# FIGURE 2: MODEL CAPABILITIES SYNTHESIS (fig4_10)
# ==============================================================================
def generate_figure_model_synthesis():
    print("\n--- Generating Figure 4.10: Clean Model Capabilities (Legends Outside) ---")
    fig = plt.figure(figsize=(17.5, 13.8))
    gs = fig.add_gridspec(2, 2, hspace=0.48, wspace=0.28, bottom=0.08, top=0.87)
    
    # --------------------------------------------------------------------------
    # Panel (a): 6-Dimensional Radar / Spider Chart (Capability Profile)
    # --------------------------------------------------------------------------
    ax_a = fig.add_subplot(gs[0, 0], polar=True)
    
    categories = [
        'VPR Accuracy\n(Exp 2 Top-1)',
        'Robustness\n(Exp 4 Stress)',
        'Consistency\n(Exp 5 Stability)',
        'Plan Quality\n(Exp 6 Rubric)',
        'Cost Economy\n(1 / Cost USD)',
        'Throughput Speed\n(Tokens / Sec)'
    ]
    num_vars = len(categories)
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]
    
    radar_data = {
        'Gemini 3.8 Flash': [97.0, 98.7, 91.7, 86.0, 13.6, 100.0],
        'Claude Sonnet 5':  [87.0, 92.0, 96.7, 94.4, 13.1,  71.5],
        'GPT-5.4':          [87.0, 97.3, 75.0, 87.5, 14.0,  37.0],
        'GPT-5.4 Mini':     [79.0, 89.3, 66.7, 79.5, 48.3,  55.1],
        'Qwen 2.5 VL 72B':  [77.0, 97.3, 66.7, 79.7, 57.1,  37.1],
        'Llama 4 Maverick': [75.0, 93.3, 75.0, 79.2, 100.0, 28.9]
    }
    
    ax_a.set_theta_offset(np.pi / 2 + np.pi / 6)
    ax_a.set_theta_direction(-1)
    ax_a.set_xticks(angles[:-1])
    ax_a.set_xticklabels(categories, fontsize=8.6, fontweight='bold')
    ax_a.set_rlabel_position(0)
    ax_a.set_yticks([25, 50, 75, 100])
    ax_a.set_yticklabels(['25', '50', '75', '100'], color='#64748b', fontsize=8.0)
    ax_a.set_ylim(0, 108)
    
    for m in MODEL_ORDER:
        values = radar_data[m]
        values_loop = values + values[:1]
        ax_a.plot(angles, values_loop, linewidth=2.0, linestyle='-', label=m, color=MODEL_COLORS[m], zorder=4)
        ax_a.fill(angles, values_loop, color=MODEL_COLORS[m], alpha=0.08)
        
    # Legend placed strictly OUTSIDE below the polar plot
    ax_a.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=3,
                fontsize=8.5, frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1')
    ax_a.set_title('(a) ลายนิ้วมือสมรรถนะ 6 มิติของโมเดล VLM (Capability Fingerprints)', fontweight='bold', pad=12)
    
    # --------------------------------------------------------------------------
    # Panel (b): Multi-Objective Pareto Frontier (Accuracy vs. Throughput with 95% CI)
    # --------------------------------------------------------------------------
    ax_b = fig.add_subplot(gs[0, 1])
    
    vpr_metrics = {
        'Gemini 3.8 Flash': {'acc': 97.0, 'ci': 3.3, 'tps': 51.88},
        'Claude Sonnet 5':  {'acc': 87.0, 'ci': 6.6, 'tps': 37.09},
        'GPT-5.4':          {'acc': 87.0, 'ci': 6.6, 'tps': 19.22},
        'GPT-5.4 Mini':     {'acc': 79.0, 'ci': 8.0, 'tps': 28.57},
        'Qwen 2.5 VL 72B':  {'acc': 77.0, 'ci': 8.2, 'tps': 19.26},
        'Llama 4 Maverick': {'acc': 75.0, 'ci': 8.5, 'tps': 14.99}
    }
    
    for m in MODEL_ORDER:
        d = vpr_metrics[m]
        ax_b.errorbar(d['tps'], d['acc'], yerr=d['ci'], fmt=MODEL_MARKERS[m], markersize=9.5,
                     color=MODEL_COLORS[m], ecolor=MODEL_COLORS[m], elinewidth=1.6, capsize=4.0,
                     markeredgecolor='black', markeredgewidth=0.8, zorder=4)
        
        # Clean annotation (just model name and accuracy)
        ax_b.annotate(f"{m} ({d['acc']:.1f}%)",
                     xy=(d['tps'], d['acc']), xytext=(7, -4 if m=='Claude Sonnet 5' else 6), textcoords='offset points',
                     fontsize=8.5, fontweight='bold', color='#0f172a',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='#ffffff', edgecolor=MODEL_COLORS[m], alpha=0.9))
    
    pareto_models = ['Llama 4 Maverick', 'GPT-5.4 Mini', 'Claude Sonnet 5', 'Gemini 3.8 Flash']
    pareto_pts = sorted([(vpr_metrics[m]['tps'], vpr_metrics[m]['acc']) for m in pareto_models], key=lambda x: x[0])
    px = [p[0] for p in pareto_pts]
    py = [p[1] for p in pareto_pts]
    ax_b.plot(px, py, linestyle='--', color='#2563eb', linewidth=1.8, alpha=0.85, label='Pareto Optimal Frontier', zorder=3)
    ax_b.fill_between(px, py, 70, color='#dbeafe', alpha=0.25, zorder=2)
    
    ax_b.set_xlabel('อัตราการส่งออกข้อความ (Generation Throughput: Tokens/Second)', fontweight='bold')
    ax_b.set_ylabel('ความแม่นยำ Top-1 Accuracy (พร้อม 95% Bootstrap CI)', fontweight='bold')
    ax_b.set_xlim(10, 58)
    ax_b.set_ylim(70, 103)
    
    # Legend placed strictly OUTSIDE below the plot
    ax_b.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2,
                frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1')
    ax_b.set_title('(b) ขอบเขตพาเรโตการรู้จำสถานที่: ความแม่นยำ vs Throughput (Pareto Frontier)', fontweight='bold', pad=12)
    
    # --------------------------------------------------------------------------
    # Panel (c): Environmental Stress Degradation Slopes (Exp 4 C1–C5 Breakdown)
    # --------------------------------------------------------------------------
    ax_c = fig.add_subplot(gs[1, 0])
    
    conditions = ['C1: Baseline\n(Daylight)', 'C2: Illumination\n(Night/Glare)', 'C3: Atmospheric\n(Rain/Fog)', 'C4: Occlusion\n(Crowd/Trees)', 'C5: Geometric\n(Drone/Tilt)']
    x_c = np.arange(len(conditions))
    
    stress_acc = {
        'Gemini 3.8 Flash': [100.0, 100.0, 100.0,  93.3, 100.0],
        'GPT-5.4':          [100.0,  93.3, 100.0, 100.0,  93.3],
        'Qwen 2.5 VL 72B':  [100.0, 100.0, 100.0,  93.3,  93.3],
        'Llama 4 Maverick': [100.0,  93.3,  93.3,  93.3,  86.7],
        'Claude Sonnet 5':  [ 93.3,  93.3,  93.3,  93.3,  86.7],
        'GPT-5.4 Mini':     [100.0, 100.0,  80.0,  86.7,  80.0]
    }
    
    for m in MODEL_ORDER:
        y_vals = stress_acc[m]
        ax_c.plot(x_c, y_vals, marker=MODEL_MARKERS[m], markersize=7.5, linewidth=2.0,
                 label=m, color=MODEL_COLORS[m], alpha=0.9, zorder=4)
        
    ax_c.set_xticks(x_c)
    ax_c.set_xticklabels(conditions, fontsize=8.5, fontweight='bold')
    ax_c.set_ylabel('ความแม่นยำในการรู้จำสถานที่ (Top-1 Accuracy %)', fontweight='bold')
    ax_c.set_ylim(75, 103)
    
    # Legend placed strictly OUTSIDE below the plot
    ax_c.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3,
                frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.2)
    ax_c.set_title('(c) ความทนทานต่อสภาวะรบกวน 5 กลุ่ม: อัตราการเสื่อมถอยของความแม่นยำ (Degradation Slopes)', fontweight='bold', pad=10)
    
    # --------------------------------------------------------------------------
    # Panel (d): Complex Reasoning vs. Deterministic Stability Quad-Plot (Exp 6 vs 5)
    # --------------------------------------------------------------------------
    ax_d = fig.add_subplot(gs[1, 1])
    
    model_quad = {
        'Claude Sonnet 5':  {'plan': 3.777, 'plan_sd': 0.284, 'stab': 96.67},
        'GPT-5.4':          {'plan': 3.502, 'plan_sd': 0.603, 'stab': 75.00},
        'Gemini 3.8 Flash': {'plan': 3.440, 'plan_sd': 0.776, 'stab': 91.67},
        'Qwen 2.5 VL 72B':  {'plan': 3.186, 'plan_sd': 0.453, 'stab': 66.67},
        'GPT-5.4 Mini':     {'plan': 3.182, 'plan_sd': 0.670, 'stab': 66.67},
        'Llama 4 Maverick': {'plan': 3.166, 'plan_sd': 0.531, 'stab': 75.00}
    }
    
    # Median crosshairs
    ax_d.axvline(80.0, color='#94a3b8', linestyle='--', linewidth=1.2, zorder=2)
    ax_d.axhline(3.35, color='#94a3b8', linestyle='--', linewidth=1.2, zorder=2)
    
    # Minimalist Quadrant Identifiers (Clean and unobtrusive)
    ax_d.text(100.5, 3.88, 'Q1: High Quality & High Stability', ha='right', fontsize=8.2, color='#15803d', fontweight='bold')
    ax_d.text(61.0, 3.88, 'Q2: High Quality & Moderate Stability', ha='left', fontsize=8.2, color='#b45309', fontweight='bold')
    ax_d.text(61.0, 3.00, 'Q3 & Q4: Cost-Optimized / Draft Tier', ha='left', fontsize=8.2, color='#64748b', fontweight='bold')
    
    for m in MODEL_ORDER:
        info = model_quad[m]
        ax_d.errorbar(info['stab'], info['plan'], yerr=info['plan_sd'], fmt=MODEL_MARKERS[m], markersize=9.5,
                     label=m, color=MODEL_COLORS[m], ecolor=MODEL_COLORS[m], elinewidth=1.6, capsize=3.5,
                     markeredgecolor='black', markeredgewidth=0.8, zorder=4)
        
        offset = (8, 5)
        if m == 'Gemini 3.8 Flash': offset = (-115, 8)
        elif m == 'Qwen 2.5 VL 72B': offset = (10, 6)
        elif m == 'GPT-5.4 Mini': offset = (-95, -16)
        elif m == 'Llama 4 Maverick': offset = (10, -12)
        
        ax_d.annotate(m, xy=(info['stab'], info['plan']), xytext=offset, textcoords='offset points',
                     fontsize=8.5, fontweight='bold', color='#0f172a',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='#ffffff', edgecolor=MODEL_COLORS[m], alpha=0.95))
        
    ax_d.set_xlabel('ความเสถียรคงเส้นคงวาของคำตอบ (Exp 5 Stability Score % ที่ T=0.1)', fontweight='bold')
    ax_d.set_ylabel('คะแนนคุณภาพแผนการท่องเที่ยวตามเกณฑ์รูบริกส์ (Exp 6 Plan Score: 1–5)', fontweight='bold')
    ax_d.set_xlim(60, 102)
    ax_d.set_ylim(2.95, 3.95)
    
    # Legend placed strictly OUTSIDE below the plot
    ax_d.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3,
                frameon=True, facecolor='#ffffff', edgecolor='#cbd5e1', fontsize=8.2)
    ax_d.set_title('(d) แผนผังควอดรันต์: คุณภาพการวางแผนเชิงเหตุผล vs เสถียรภาพความแม่นยำ (Reasoning vs. Stability)', fontweight='bold', pad=10)
    
    fig.suptitle('ภาพที่ 4.10: การสังเคราะห์จุดเด่นเชิงสมรรถนะ ขอบเขตพาเรโต และลายนิ้วมือขีดความสามารถของ 6 โมเดล VLM\n'
                 '[คำถามวิจัย: โมเดลใดโดดเด่นในมิติใด มีข้อแลกเปลี่ยนอย่างไร และตำแหน่งการใช้งานที่เหมาะสมที่สุดคือจุดใด?]',
                 fontsize=13.0, fontweight='bold', y=0.975)
    
    save_figure(fig, "fig4_10_cross_model_capability_synthesis_4panel")


if __name__ == '__main__':
    print("=" * 80)
    print("Generating Academic Synthesis Figures with Legends Outside Plot Area")
    print("Output directory: " + OUT_DIR)
    print("=" * 80)
    
    generate_figure_cost_synthesis()
    generate_figure_model_synthesis()
    
    print("\n" + "=" * 80)
    print("[SUCCESS] Both Synthesis Figures successfully updated!")
    print(f"Files saved in: {OUT_DIR}")
    print("  1. fig4_09_cross_experiment_cost_synthesis_4panel (.png & .pdf)")
    print("  2. fig4_10_cross_model_capability_synthesis_4panel (.png & .pdf)")
    print("=" * 80)
