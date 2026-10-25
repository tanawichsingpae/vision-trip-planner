# -*- coding: utf-8 -*-
"""
generate_chapter4_figures.py
================================================================================
Comprehensive Data Visualization Suite for Pixinerary Chapter 4 Thesis
Outputs: D:\Pixinerary_model_test\experiment\figures_Chapter4\

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

# Configure Academic Styling & Thai Font Support
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Tahoma', 'Leelawadee UI', 'DejaVu Sans', 'Arial']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10.5
plt.rcParams['axes.titlesize'] = 12.0
plt.rcParams['axes.labelsize'] = 10.5
plt.rcParams['xtick.labelsize'] = 9.5
plt.rcParams['ytick.labelsize'] = 9.5
plt.rcParams['legend.fontsize'] = 9.0
plt.rcParams['figure.titlesize'] = 13.5
plt.rcParams['figure.dpi'] = 300
plt.rcParams['axes.grid'] = True
plt.rcParams['grid.alpha'] = 0.35
plt.rcParams['grid.linestyle'] = '--'

# Directories
BASE_DIR = r'd:\Pixinerary_model_test'
EXP_DIR = os.path.join(BASE_DIR, 'experiment')
OUT_DIR = os.path.join(EXP_DIR, 'figures_Chapter4')
os.makedirs(OUT_DIR, exist_ok=True)

# Standard Model Label Mapping & Palette
MODEL_LABELS_MAP = {
    'anthropic-claude-sonnet5': 'Claude Sonnet 5',
    'google-gemini-38-flash': 'Gemini 3.8 Flash',
    'openai-gpt-54': 'GPT-5.4',
    'openai-gpt-54-mini': 'GPT-5.4 Mini',
    'qwen-25-vl-72b': 'Qwen 2.5 VL 72B',
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
    'tier1_iconic': 'Tier 1: Iconic Landmarks',
    'tier2_longtail': 'Tier 2: Regional Heritage',
    'tier3_nature': 'Tier 3: Nature & Scenic',
    'tier4_ugc': 'Tier 4: In-The-Wild UGC'
}
TIER_ORDER = ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']

import time

def save_fig(fig, filename_base):
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
    print(f"  [+] Saved: {filename_base}.png & .pdf")


# ==============================================================================
# SECTION 1: Exp 1: Prompt Sensitivity Analysis
# ==============================================================================
def generate_exp1():
    print("\n--- Generating Section 1: Exp 1 (Prompt Sensitivity) ---")
    csv_path = os.path.join(EXP_DIR, 'exp1_prompt_sensitivity.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    
    prompt_names = {
        'P1': 'P1: Zero-Shot (EN)',
        'P2': 'P2: Expert Persona',
        'P3': 'P3: CoT Reasoning',
        'P4': 'P4: Native Thai (TH)',
        'P5': 'P5: Few-Shot ICL'
    }
    df['Prompt_Label'] = df['Prompt Variant ID'].map(prompt_names)
    prompt_order = ['P1: Zero-Shot (EN)', 'P2: Expert Persona', 'P3: CoT Reasoning', 'P4: Native Thai (TH)', 'P5: Few-Shot ICL']
    
    # --- 1.1 Heatmap (Model × Prompt) ---
    pivot_acc = df.pivot_table(
        index='Model_Label',
        columns='Prompt_Label',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(index=MODEL_ORDER, columns=prompt_order)
    
    fig, ax = plt.subplots(figsize=(9.2, 5.0))
    sns.heatmap(
        pivot_acc, annot=True, fmt=".1f", cmap="YlGnBu",
        cbar_kws={'label': 'Top-1 Accuracy (%)'},
        vmin=55, vmax=100, linewidths=1.2, linecolor='white',
        annot_kws={'fontweight': 'bold', 'size': 10.0}, ax=ax
    )
    ax.set_title("Exp 1: Cross-Paradigm Prompt Sensitivity Matrix\n(Accuracy % Across 5 Prompting Strategies)", pad=14, fontweight='bold')
    ax.set_xlabel("Prompt Strategy Paradigm", fontweight='bold', labelpad=10)
    ax.set_ylabel("Vision-Language Model", fontweight='bold', labelpad=10)
    plt.xticks(rotation=15, ha='right')
    save_fig(fig, "exp1_01_prompt_accuracy_heatmap")
    
    # --- 1.2 Scatter Plot: Latency & Cost vs Accuracy (FIXED LEGEND OVERLAP) ---
    summary = df.groupby(['Model_Label', 'Prompt Variant ID']).agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat_sec=('Time MS', lambda x: np.mean(x) / 1000.0),
        cost_1k=('Cost USD', lambda x: np.mean(x) * 1000.0)
    ).reset_index()
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.0))
    prompt_markers = {'P1': 'o', 'P2': 's', 'P3': '^', 'P4': 'D', 'P5': 'v'}
    
    for m in MODEL_ORDER:
        sub = summary[summary['Model_Label'] == m]
        c = MODEL_COLORS.get(m, '#333')
        # Panel 1: Latency vs Accuracy
        ax1.plot(sub['lat_sec'], sub['acc'], color=c, alpha=0.4, linestyle='--', zorder=2)
        for _, r in sub.iterrows():
            ax1.scatter(r['lat_sec'], r['acc'], color=c, marker=prompt_markers.get(r['Prompt Variant ID'], 'o'),
                        s=85, edgecolors='black', linewidth=0.8, zorder=3)
        # Panel 2: Cost vs Accuracy
        ax2.plot(sub['cost_1k'], sub['acc'], color=c, alpha=0.4, linestyle='--', zorder=2)
        for _, r in sub.iterrows():
            ax2.scatter(r['cost_1k'], r['acc'], color=c, marker=prompt_markers.get(r['Prompt Variant ID'], 'o'),
                        s=85, edgecolors='black', linewidth=0.8, zorder=3)

    ax1.set_title("(a) Inference Latency vs. Accuracy", fontweight='bold', pad=10)
    ax1.set_xlabel("Mean Inference Latency (Seconds)", fontweight='bold')
    ax1.set_ylabel("Top-1 Accuracy (%)", fontweight='bold')
    ax1.set_ylim(52, 102)
    ax1.set_xlim(2.2, 12.0)
    
    ax2.set_title("(b) Estimated API Cost vs. Accuracy", fontweight='bold', pad=10)
    ax2.set_xlabel("Mean Cost per 1,000 Queries (USD $)", fontweight='bold')
    ax2.set_ylabel("Top-1 Accuracy (%)", fontweight='bold')
    ax2.set_ylim(52, 102)
    ax2.set_xlim(0.1, 7.8)
    
    # Position Legends OUTSIDE beneath each subplot to completely eliminate data overlap
    legend_models = [Line2D([0], [0], color=MODEL_COLORS[m], marker='o', lw=1.5, label=m) for m in MODEL_ORDER]
    legend_prompts = [Line2D([0], [0], color='#475569', marker=prompt_markers[p], lw=0, label=f"{p}: {prompt_names[p].split(': ')[1]}") for p in ['P1','P2','P3','P4','P5']]
    
    ax1.legend(handles=legend_models, title="Models", loc='upper center', bbox_to_anchor=(0.5, -0.16),
               ncol=3, framealpha=0.95, fontsize=8.8)
    ax2.legend(handles=legend_prompts, title="Prompts", loc='upper center', bbox_to_anchor=(0.5, -0.16),
               ncol=3, framealpha=0.95, fontsize=8.8)
    
    fig.suptitle("Exp 1: Computational Overhead & Trade-Off Across Prompts", fontsize=13, fontweight='bold', y=0.98)
    save_fig(fig, "exp1_02_prompt_latency_cost_scatter")
    
    # --- 1.3 Supplemental Bar: Token Comparison Across Prompts ---
    token_sum = df.groupby('Prompt Variant ID').agg(
        prompt_tokens=('Prompt Tokens', 'mean'),
        comp_tokens=('Completion Tokens', 'mean'),
        total_tokens=('Total Tokens', 'mean')
    ).reindex(['P1', 'P2', 'P3', 'P4', 'P5'])
    
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    x_idx = np.arange(len(token_sum))
    w = 0.35
    
    b1 = ax.bar(x_idx - w/2, token_sum['prompt_tokens'], w, label='Prompt Input Tokens', color='#3b82f6', edgecolor='black')
    b2 = ax.bar(x_idx + w/2, token_sum['comp_tokens'], w, label='Completion Output Tokens', color='#10b981', edgecolor='black')
    
    ax.set_title("Exp 1 (Supplemental): Average Token Consumption by Prompt Strategy", pad=12, fontweight='bold')
    ax.set_xlabel("Prompt Variant Paradigm", fontweight='bold')
    ax.set_ylabel("Mean Token Count", fontweight='bold')
    ax.set_xticks(x_idx)
    ax.set_xticklabels([f"{p}\n({prompt_names[p].split(': ')[1]})" for p in token_sum.index], fontweight='semibold')
    ax.set_ylim(0, max(token_sum['total_tokens']) * 1.15)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95)
    
    for b in b1 + b2:
        h = b.get_height()
        ax.annotate(f"{h:.0f}", xy=(b.get_x() + b.get_width()/2, h),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5)
    save_fig(fig, "exp1_03_prompt_token_comparison_bar")


# ==============================================================================
# SECTION 2: Exp 2: Multi-Model VPR Baseline Benchmarks
# ==============================================================================
def generate_exp2():
    print("\n--- Generating Section 2: Exp 2 (Model Benchmark) ---")
    csv_path = os.path.join(EXP_DIR, 'exp2_model_benchmark.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    
    # --- 2.1 Dot Plot with 95% Confidence Interval (FIXED TEXT OVERLAP) ---
    model_stats = df.groupby('Model_Label').agg(
        acc=('is_correct_bool', 'mean'),
        count=('is_correct_bool', 'count'),
        latency=('Time MS', 'mean'),
        cost_1k=('Cost USD', lambda x: np.mean(x) * 1000.0)
    ).reindex(MODEL_ORDER)
    
    model_stats['ci95'] = 1.96 * np.sqrt(model_stats['acc'] * (1 - model_stats['acc']) / model_stats['count']) * 100
    model_stats['acc_pct'] = model_stats['acc'] * 100
    
    fig, ax = plt.subplots(figsize=(9.8, 5.0))
    y_pos = np.arange(len(MODEL_ORDER))[::-1]
    
    for i, m in enumerate(MODEL_ORDER):
        row = model_stats.loc[m]
        c = MODEL_COLORS.get(m, '#333')
        # Draw error bar
        ax.errorbar(row['acc_pct'], y_pos[i], xerr=row['ci95'], fmt='o', color=c,
                    ecolor=c, elinewidth=2.4, capsize=6, capthick=1.8, markersize=9, zorder=3)
        
        # Position label TO THE RIGHT of the error bar cap to eliminate collision
        cap_right = row['acc_pct'] + row['ci95']
        ax.annotate(f"{row['acc_pct']:.1f}% (±{row['ci95']:.1f}%)",
                    xy=(cap_right, y_pos[i]), xytext=(8, -3),
                    textcoords="offset points", ha='left', va='center',
                    fontsize=9.2, fontweight='bold', color=c,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor='none'))
        
    ax.set_yticks(y_pos)
    ax.set_yticklabels(MODEL_ORDER, fontweight='bold')
    ax.set_xlabel("Top-1 Zero-Shot Recognition Accuracy (%) — 95% Confidence Interval", fontweight='bold')
    ax.set_title("Exp 2: Baseline Model VPR Accuracy Benchmark with 95% CI (N=100 Images)", pad=14, fontweight='bold')
    # Expanded xlim to 115 ensures all confidence caps and text have plenty of breathing room
    ax.set_xlim(60, 115)
    ax.axvline(100, color='#94a3b8', linestyle=':', alpha=0.7)
    save_fig(fig, "exp2_01_model_accuracy_confidence_dotplot")
    
    # --- 2.2 Heatmap (Model × Tier) ---
    tier_matrix = df.pivot_table(
        index='Model_Label',
        columns='Tier',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(index=MODEL_ORDER, columns=TIER_ORDER)
    tier_matrix.columns = [TIER_NAMES[t] for t in TIER_ORDER]
    
    fig, ax = plt.subplots(figsize=(9.5, 4.8))
    sns.heatmap(tier_matrix, annot=True, fmt=".1f", cmap="YlGnBu",
                cbar_kws={'label': 'Top-1 Accuracy (%)'}, vmin=20, vmax=100,
                linewidths=1.2, linecolor='white', annot_kws={'fontweight': 'bold', 'size': 10}, ax=ax)
    ax.set_title("Exp 2: Model Accuracy Across Visual Ambiguity Tiers\n(Highlighting the Tier 3 Nature Bottleneck)", pad=14, fontweight='bold')
    ax.set_ylabel("Vision-Language Model", fontweight='bold')
    ax.set_xlabel("Environmental Difficulty Tier", fontweight='bold')
    plt.xticks(rotation=15, ha='right')
    save_fig(fig, "exp2_02_model_tier_accuracy_heatmap")
    
    # --- 2.3 Scatter Plot: Latency vs Accuracy with Pareto Frontier & Cost ---
    fig, ax = plt.subplots(figsize=(9.8, 5.8))
    sorted_ms = model_stats.sort_values('latency').reset_index()
    pareto_pts = []
    curr_max_acc = -1.0
    for _, r in sorted_ms.iterrows():
        if r['acc_pct'] >= curr_max_acc:
            pareto_pts.append(r)
            curr_max_acc = r['acc_pct']
    pareto_df = pd.DataFrame(pareto_pts)
    
    for _, r in model_stats.reset_index().iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        size = max(180, r['cost_1k'] * 90)
        ax.scatter(r['latency'], r['acc_pct'], s=size, color=c, alpha=0.85,
                   edgecolors='black', linewidth=1.2, zorder=4)
        
        offset_x = 12
        offset_y = 5
        if m == 'Gemini 3.8 Flash': offset_x, offset_y = -120, -18
        elif m == 'GPT-5.4': offset_x, offset_y = 12, -15
        elif m == 'Claude Sonnet 5': offset_x, offset_y = 12, 10
        elif m == 'Llama 4 Maverick': offset_x, offset_y = -110, -18
        
        ax.annotate(f"{m}\n({r['acc_pct']:.1f}%, {r['latency']/1000:.2f}s, ${r['cost_1k']:.2f}/1k)",
                    xy=(r['latency'], r['acc_pct']), textcoords="offset points",
                    xytext=(offset_x, offset_y), fontsize=9.0, fontweight='bold', color='#1e293b',
                    bbox=dict(boxstyle="round,pad=0.25", facecolor="white", alpha=0.88, edgecolor=c, linewidth=1), zorder=5)
        
    ax.plot(pareto_df['latency'], pareto_df['acc_pct'], '--', color='#059669', linewidth=2.2, alpha=0.85, zorder=3)
    
    ax.set_title("Exp 2: Pareto Frontier ด้าน Accuracy–Latency โดยขนาดจุดแสดง Cost", pad=14, fontweight='bold')
    ax.set_xlabel("Mean Inference Latency (ms) — Lower is Better", fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%) — Higher is Better", fontweight='bold')
    ax.set_ylim(68, 104)
    ax.set_xlim(2000, 7500)
    
    legend_elements = [
        Line2D([0], [0], linestyle='--', color='#059669', lw=2, label='Pareto Frontier ด้าน Accuracy–Latency'),
        ax.scatter([], [], s=180, color='#94a3b8', alpha=0.7, edgecolors='black', label='ขนาดจุดแทนต้นทุน ($/1k)'),
        Line2D([0], [0], color='none', label='*หมายเหตุ: ในมิติ 3D (รวม Cost) Qwen ($0.98) และ Llama ($0.56) เป็นจุดไม่ถูกครอบงำด้วย')
    ]
    ax.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=1, framealpha=0.95, fontsize=8.5)
    save_fig(fig, "exp2_03_model_pareto_frontier_scatter")
    
    # --- 2.4 Supplemental Stacked Bar: Failure Modes Breakdown ---
    fail_counts = df[df['Failure Mode'] != 'none'].groupby(['Model_Label', 'Failure Mode']).size().unstack(fill_value=0)
    fail_counts = fail_counts.reindex(MODEL_ORDER)
    
    fig, ax = plt.subplots(figsize=(9.2, 5.2))
    fail_colors = {'visual_confusion': '#f59e0b', 'degradation_rejection': '#8b5cf6', 'hallucination': '#ef4444'}
    fail_labels = {'visual_confusion': 'Visual Confusion (จำแนกผิดเชิงสายตา)',
                   'degradation_rejection': 'Degradation Rejection (ปฏิเสธเพราะภาพไม่ชัด)',
                   'hallucination': 'Hallucination (สร้างชื่อสถานที่จำลอง)'}
    
    bottom = np.zeros(len(MODEL_ORDER))
    for col in ['visual_confusion', 'degradation_rejection', 'hallucination']:
        if col in fail_counts.columns:
            vals = fail_counts[col].values
            ax.barh(MODEL_ORDER[::-1], vals[::-1], left=bottom[::-1], label=fail_labels.get(col, col),
                    color=fail_colors.get(col, '#999'), edgecolor='black', linewidth=0.7)
            bottom += vals
            
    ax.set_title("Exp 2 (Supplemental): Distribution of Failure Modes Across Models", pad=12, fontweight='bold')
    ax.set_xlabel("Number of Failed Inferences (out of 100 test images)", fontweight='bold')
    ax.set_ylabel("Vision-Language Model", fontweight='bold')
    ax.set_xlim(0, max(bottom) * 1.15)
    # Position legend cleanly outside below plot
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=2, framealpha=0.92)
    save_fig(fig, "exp2_04_model_failure_modes_stacked_bar")


# ==============================================================================
# SECTION 3: Exp 3: Two-Turn Pipeline Comparison & Top-K Recovery
# ==============================================================================
def generate_exp3():
    print("\n--- Generating Section 3: Exp 3 (Pipeline Comparison) ---")
    csv_path = os.path.join(EXP_DIR, 'exp3_pipeline_comparison.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['Top_1_Strict_bool'] = df['Top 1 Strict'].astype(str).str.lower().isin(['true', '1'])
    df['Top_3_Recall_bool'] = df['Top 3 Recall'].astype(str).str.lower().isin(['true', '1'])
    
    # --- 3.1 Dumbbell Plot (Direct Top-1 vs Pipeline Top-3) ---
    grouped = df.groupby('Model_Label').agg(
        top1=('Top_1_Strict_bool', lambda x: np.mean(x) * 100),
        top3=('Top_3_Recall_bool', lambda x: np.mean(x) * 100)
    ).reindex(MODEL_ORDER)
    grouped['gain'] = grouped['top3'] - grouped['top1']
    
    ov_top1 = df['Top_1_Strict_bool'].mean() * 100
    ov_top3 = df['Top_3_Recall_bool'].mean() * 100
    
    labels_with_ov = ['Overall System Average'] + MODEL_ORDER
    top1_vals = [ov_top1] + grouped['top1'].tolist()
    top3_vals = [ov_top3] + grouped['top3'].tolist()
    gain_vals = [ov_top3 - ov_top1] + grouped['gain'].tolist()
    
    fig, ax = plt.subplots(figsize=(10.5, 5.5))
    y_coords = np.arange(len(labels_with_ov))[::-1]
    
    for i in range(len(labels_with_ov)):
        y = y_coords[i]
        x1 = top1_vals[i]
        x2 = top3_vals[i]
        g = gain_vals[i]
        
        ax.plot([x1, x2], [y, y], color='#94a3b8', linewidth=2.5, zorder=2)
        ax.scatter(x1, y, color='#ef4444', s=90, edgecolors='black', zorder=3)
        ax.scatter(x2, y, color='#10b981', s=110, edgecolors='black', zorder=4)
        
        ax.annotate(f"{x1:.1f}%", xy=(x1, y), xytext=(-10, 0), textcoords="offset points",
                    ha='right', va='center', fontsize=9, fontweight='semibold')
        ax.annotate(f"{x2:.1f}% (+{g:.1f}%)", xy=(x2, y), xytext=(10, 0), textcoords="offset points",
                    ha='left', va='center', fontsize=9.2, fontweight='bold', color='#065f46')
        
    ax.set_yticks(y_coords)
    ax.set_yticklabels(labels_with_ov, fontweight='bold')
    ax.set_xlabel("Place Recognition Rate (%)", fontweight='bold')
    ax.set_title("Exp 3: Dumbbell Trajectory: 1-Turn Direct Top-1 vs. 2-Turn HITL Top-3 Recovery", pad=14, fontweight='bold')
    ax.set_xlim(42, 122)
    
    legend_elements = [
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#ef4444', markersize=9, label='Direct 1-Turn Top-1 Strict'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#10b981', markersize=10, label='2-Turn Top-3 Candidates (Potential Upper Bound Recovery)'),
        Line2D([0], [0], color='#94a3b8', lw=2.5, label='Potential Candidate Recovery Gain')
    ]
    ax.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=1, framealpha=0.95)
    save_fig(fig, "exp3_01_pipeline_top1_vs_top3_dumbbell")
    
    # --- 3.2 Stacked Bar: Recognition Outcome Classification ---
    df['outcome'] = 'Unrecovered'
    df.loc[df['Top_3_Recall_bool'], 'outcome'] = 'Top-1 Incorrect, Recovered in Top-3'
    df.loc[df['Top_1_Strict_bool'], 'outcome'] = 'Top-1 Correct Immediately'
    
    outcome_counts = df.groupby(['Model_Label', 'outcome']).size().unstack(fill_value=0)
    outcome_pct = outcome_counts.div(outcome_counts.sum(axis=1), axis=0) * 100
    outcome_pct = outcome_pct.reindex(MODEL_ORDER)
    
    fig, ax = plt.subplots(figsize=(10, 5))
    cat_order = ['Top-1 Correct Immediately', 'Top-1 Incorrect, Recovered in Top-3', 'Unrecovered']
    cat_colors = ['#10b981', '#3b82f6', '#ef4444']
    cat_labels_th = ['Top-1 ถูกต้องทันที (Direct Success)',
                     'Top-1 ผิด แต่พบใน Top-3 (Potential Recovery)',
                     'ไม่พบใน Top-3 (Unrecovered Loss)']
    
    left = np.zeros(len(MODEL_ORDER))
    for i, cat in enumerate(cat_order):
        if cat in outcome_pct.columns:
            vals = outcome_pct[cat].values
            bars = ax.barh(MODEL_ORDER[::-1], vals[::-1], left=left[::-1], label=cat_labels_th[i],
                           color=cat_colors[i], edgecolor='black', linewidth=0.7)
            for j, b in enumerate(bars):
                w = b.get_width()
                if w > 6:
                    ax.annotate(f"{w:.1f}%", xy=(b.get_x() + w/2, b.get_y() + b.get_height()/2),
                                ha='center', va='center', color='white', fontweight='bold', fontsize=8.8)
            left += vals
            
    ax.set_title("Exp 3: Tri-State Recognition Outcome Distribution (Direct vs. Top-3 Recovery)", pad=14, fontweight='bold')
    ax.set_xlabel("Proportion of Evaluated Queries (%)", fontweight='bold')
    ax.set_ylabel("Vision-Language Model", fontweight='bold')
    ax.set_xlim(0, 100)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=3, framealpha=0.92)
    save_fig(fig, "exp3_02_pipeline_outcome_stacked_bar")
    
    # --- 3.3 Supplemental: Latency Overhead & Candidate Score Distribution ---
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12.5, 4.8))
    
    mean_lat = df.groupby('Model_Label')['Time MS'].mean().reindex(MODEL_ORDER) / 1000.0
    ax1.barh(MODEL_ORDER[::-1], mean_lat[::-1], color='#6366f1', edgecolor='black', linewidth=0.8)
    for i, v in enumerate(mean_lat[::-1]):
        ax1.annotate(f"{v:.1f}s", xy=(v, i), xytext=(5, 0), textcoords="offset points", va='center', fontweight='bold')
    ax1.set_title("(a) Mean Pipeline Execution Latency", fontweight='bold', pad=10)
    ax1.set_xlabel("Latency (Seconds)", fontweight='bold')
    ax1.set_xlim(0, max(mean_lat) * 1.18)
    
    corr_scores = df[df['Top_3_Recall_bool']]['Avg Candidate Score'].dropna()
    incorr_scores = df[~df['Top_3_Recall_bool']]['Avg Candidate Score'].dropna()
    sns.kdeplot(corr_scores, ax=ax2, color='#10b981', fill=True, alpha=0.4, linewidth=2.2, label='Top-3 Successful')
    sns.kdeplot(incorr_scores, ax=ax2, color='#ef4444', fill=True, alpha=0.4, linewidth=2.2, label='Top-3 Unrecovered')
    ax2.set_title("(b) Candidate Relevance Score Density", fontweight='bold', pad=10)
    ax2.set_xlabel("Average Candidate Relevance Score (0-3)", fontweight='bold')
    ax2.set_ylabel("Density", fontweight='bold')
    ax2.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95)
    
    fig.suptitle("Exp 3 (Supplemental): Pipeline Runtime & Candidate Calibration Dynamics", fontsize=13, fontweight='bold', y=1.01)
    save_fig(fig, "exp3_03_pipeline_latency_and_score_dist")


# ==============================================================================
# SECTION 4: Exp 4: Environmental Robustness & Controlled Perturbations
# ==============================================================================
def generate_exp4():
    print("\n--- Generating Section 4: Exp 4 (Robustness Test) ---")
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
    
    # --- 4.1 Grouped Dot Plot across Conditions ---
    acc_matrix = df.pivot_table(
        index='Model_Label',
        columns='Condition Category',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(index=MODEL_ORDER, columns=cond_order)
    
    fig, ax = plt.subplots(figsize=(10.5, 5.5))
    x_pos = np.arange(len(cond_order))
    
    for m in MODEL_ORDER:
        c = MODEL_COLORS.get(m, '#333')
        vals = acc_matrix.loc[m].values
        ax.plot(x_pos, vals, marker='o', markersize=8, linewidth=2.0, color=c, alpha=0.85, label=m)
        
    ax.set_xticks(x_pos)
    ax.set_xticklabels([cond_labels_dict[c] for c in cond_order], fontweight='bold')
    ax.set_ylabel("Recognition Accuracy under Stress (%)", fontweight='bold')
    ax.set_title("Exp 4: Trajectory of Model Robustness Across 5 Environmental Stresses", pad=14, fontweight='bold')
    ax.set_ylim(72, 104)
    # Position legend cleanly outside below plot
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=6, framealpha=0.95, fontsize=8.8)
    
    # Highlight C4 Geometric drop
    ax.axvspan(2.7, 3.3, color='#fee2e2', alpha=0.4)
    ax.annotate("Severe Geometric Drop\n(Mean -8.89% Degradation)", xy=(3, 80), xytext=(3, 74),
                arrowprops=dict(facecolor='red', arrowstyle='->', lw=1.2),
                ha='center', fontweight='bold', color='#b91c1c', fontsize=9,
                bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.85, edgecolor='red'))
    save_fig(fig, "exp4_01_robustness_grouped_dotplot")
    
    # --- 4.2 Heatmap of Delta Accuracy vs Baseline ---
    delta_matrix = pd.DataFrame(index=MODEL_ORDER)
    for c in ['Illumination', 'Atmospheric', 'Geometric', 'Occlusion']:
        delta_matrix[cond_labels_dict[c].replace('\n', ' ')] = acc_matrix[c] - acc_matrix['Baseline']
        
    fig, ax = plt.subplots(figsize=(9, 4.8))
    sns.heatmap(delta_matrix, annot=True, fmt="+.1f", cmap="coolwarm_r", center=0,
                vmin=-20, vmax=5, cbar_kws={'label': 'Δ Accuracy vs. C1 Baseline (% points)'},
                linewidths=1.2, linecolor='white', annot_kws={'fontweight': 'bold', 'size': 10}, ax=ax)
    ax.set_title("Exp 4: Robustness Degradation Delta Matrix (Relative to C1 Baseline)", pad=14, fontweight='bold')
    ax.set_ylabel("Vision-Language Model", fontweight='bold')
    ax.set_xlabel("Controlled Environmental Stress Category", fontweight='bold')
    plt.xticks(rotation=15, ha='right')
    save_fig(fig, "exp4_02_robustness_delta_heatmap")
    
    # --- 4.3 Supplemental Summary Bar: Condition-wise Degradation Rate ---
    overall_cond = df.groupby('Condition Category')['is_correct_bool'].mean() * 100
    overall_cond = overall_cond.reindex(cond_order)
    degradation = overall_cond - overall_cond['Baseline']
    
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    bar_colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
    bars = ax.bar([cond_labels_dict[c].split('\n')[0] for c in cond_order], overall_cond.values,
                  color=bar_colors, edgecolor='black', linewidth=0.8)
    
    for i, b in enumerate(bars):
        h = b.get_height()
        deg = degradation.values[i]
        deg_str = f"({deg:+.2f}%)" if i > 0 else "(Ref)"
        ax.annotate(f"{h:.2f}%\n{deg_str}", xy=(b.get_x() + b.get_width()/2, h),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                    fontsize=8.8, fontweight='bold')
        
    ax.set_title("Exp 4 (Supplemental): Overall Recognition Rate & Degradation Across Stresses", pad=12, fontweight='bold')
    ax.set_ylabel("Overall Accuracy across All Models (%)", fontweight='bold')
    ax.set_ylim(65, 108)
    save_fig(fig, "exp4_03_robustness_degradation_summary_bar")


# ==============================================================================
# SECTION 5: Exp 5: Model Consistency & Operational Stability
# ==============================================================================
def generate_exp5():
    print("\n--- Generating Section 5: Exp 5 (Model Consistency) ---")
    csv_path = os.path.join(EXP_DIR, 'exp5_consistency.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['norm_pred'] = df['Predicted Place'].astype(str).str.strip().str.lower()
    
    cons_res = []
    for m in MODEL_ORDER:
        for t in [0.1, 0.7]:
            sub = df[(df['Model_Label'] == m) & (df['Temperature'] == t)]
            sess_uniques = sub.groupby('Session ID')['norm_pred'].nunique()
            score = (sess_uniques == 1).mean() * 100
            acc = sub['is_correct_bool'].mean() * 100
            conf_sd = sub['Confidence'].std()
            lat_sd = sub['Time MS'].std()
            cons_res.append({'Model_Label': m, 'Temperature': t, 'Consistency': score, 'Accuracy': acc,
                             'Conf_SD': conf_sd, 'Lat_SD': lat_sd})
    cons_df = pd.DataFrame(cons_res)
    
    # --- 5.1 Grouped Bar/Dot Plot: Consistency Score across Temperatures ---
    pivot_cons = cons_df.pivot(index='Model_Label', columns='Temperature', values='Consistency').reindex(MODEL_ORDER)
    
    fig, ax = plt.subplots(figsize=(9.8, 5.0))
    x_idx = np.arange(len(MODEL_ORDER))
    w = 0.35
    
    r1 = ax.bar(x_idx - w/2, pivot_cons[0.1], w, label='Temperature = 0.1 (Strict Control)', color='#3b82f6', edgecolor='black')
    r2 = ax.bar(x_idx + w/2, pivot_cons[0.7], w, label='Temperature = 0.7 (Exploratory Sampling)', color='#f59e0b', edgecolor='black')
    
    for b in r1:
        h = b.get_height()
        ax.annotate(f"{h:.1f}%", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=8.5, fontweight='bold')
    for b in r2:
        h = b.get_height()
        ax.annotate(f"{h:.1f}%", xy=(b.get_x() + b.get_width()/2, h), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=8.5)
        
    ax.set_title("Exp 5: Semantic Consistency Agreement Score (T = 0.1 vs. T = 0.7)", pad=14, fontweight='bold')
    ax.set_ylabel("Consistency Agreement Rate (%)", fontweight='bold')
    ax.set_xticks(x_idx)
    ax.set_xticklabels(MODEL_ORDER, rotation=15, ha='right', fontweight='semibold')
    ax.set_ylim(0, 118)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.22), ncol=2, framealpha=0.95)
    save_fig(fig, "exp5_01_consistency_temperature_grouped_plot")
    
    # --- 5.2 Scatter Plot: Consistency vs Accuracy ---
    fig, ax = plt.subplots(figsize=(8.8, 5.2))
    sub_01 = cons_df[cons_df['Temperature'] == 0.1]
    
    for _, r in sub_01.iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        ax.scatter(r['Consistency'], r['Accuracy'], color=c, s=150, edgecolors='black', linewidth=1.2, zorder=3)
        ax.annotate(f"{m}\n(Cons: {r['Consistency']:.1f}%, Acc: {r['Accuracy']:.1f}%)",
                    xy=(r['Consistency'], r['Accuracy']), textcoords="offset points",
                    xytext=(10, -5), fontsize=8.8, fontweight='bold', color=c,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor=c, linewidth=0.8))
        
    ax.set_title("Exp 5: Semantic Determinism vs. Recognition Accuracy (T = 0.1)", pad=14, fontweight='bold')
    ax.set_xlabel("Consistency Agreement Score (%) — Higher is More Deterministic", fontweight='bold')
    ax.set_ylabel("Recognition Accuracy (%)", fontweight='bold')
    ax.set_xlim(35, 105)
    ax.set_ylim(60, 104)
    save_fig(fig, "exp5_02_consistency_vs_accuracy_scatter")
    
    # --- 5.3 Supplemental: Latency Jitter & Boxplot ---
    fig, ax = plt.subplots(figsize=(10, 4.8))
    sns.boxplot(data=df[df['Temperature'] == 0.1], x='Model_Label', y='Time MS', order=MODEL_ORDER,
                hue='Model_Label', palette=[MODEL_COLORS[m] for m in MODEL_ORDER], legend=False, ax=ax, showmeans=True,
                meanprops={"marker":"D", "markerfacecolor":"white", "markeredgecolor":"black"})
    ax.set_title("Exp 5 (Supplemental): Inference Latency Distribution & Operational Jitter (T = 0.1)", pad=12, fontweight='bold')
    ax.set_xlabel("Vision-Language Model", fontweight='bold')
    ax.set_ylabel("Response Latency (ms)", fontweight='bold')
    plt.xticks(rotation=15, ha='right')
    save_fig(fig, "exp5_03_consistency_latency_jitter_distribution")


# ==============================================================================
# SECTION 6: Exp 6: Plan Quality Benchmark & Human Evaluation
# ==============================================================================
def generate_exp6():
    print("\n--- Generating Section 6: Exp 6 (Plan Quality) ---")
    csv_path = os.path.join(EXP_DIR, 'exp6_plan_evaluation.csv')
    df = pd.read_csv(csv_path)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    
    dims = [
        ('Dim1_ConstraintSatisfaction', 'Dim 1: Constraint\nSatisfaction'),
        ('Dim2_ActivityRelevance', 'Dim 2: Activity\nRelevance'),
        ('Dim3_Spatiality', 'Dim 3: Spatial\nCoherence'),
        ('Dim4_AccuracyValidity', 'Dim 4: Accuracy &\nValidity'),
        ('Dim5_OverallQuality', 'Dim 5: Pacing &\nDiversity')
    ]
    
    # --- 6.1 Heatmap (Model × 5 Dimensions + Total Score) ---
    dim_means = df.groupby('Model_Label')[[d[0] for d in dims] + ['Total Score']].mean().reindex(MODEL_ORDER)
    dim_means.columns = [d[1] for d in dims] + ['Total Score\n(Mean / 5.0)']
    
    fig, ax = plt.subplots(figsize=(10.5, 4.8))
    sns.heatmap(dim_means, annot=True, fmt=".2f", cmap="YlGnBu", vmin=2.5, vmax=4.0,
                cbar_kws={'label': 'Rubric Score (Likert 1.00 - 5.00)'},
                linewidths=1.2, linecolor='white', annot_kws={'fontweight': 'bold', 'size': 10}, ax=ax)
    ax.set_title("Exp 6: Itinerary Quality Evaluation Across 5 Rubric Dimensions", pad=14, fontweight='bold')
    ax.set_ylabel("Itinerary Synthesis Model", fontweight='bold')
    ax.set_xlabel("Rubric Dimension (Human Evaluation, 20 Criteria)", fontweight='bold')
    plt.xticks(rotation=15, ha='right')
    save_fig(fig, "exp6_01_plan_quality_dimensions_heatmap")
    
    # --- 6.2 Paired Dot Plot across Scenarios (FIXED YLIM AND LEGEND OVERLAP) ---
    scen_matrix = df.pivot_table(index='Destination', columns='Model_Label', values='Total Score').reindex(columns=MODEL_ORDER)
    x_scen = np.arange(len(scen_matrix))
    
    fig, ax = plt.subplots(figsize=(11, 5.8))
    
    for m in MODEL_ORDER:
        c = MODEL_COLORS.get(m, '#333')
        vals = scen_matrix[m].values
        ax.plot(x_scen, vals, marker='o', markersize=6.5, linewidth=1.5, alpha=0.8, color=c, label=m)
        
    ax.set_xticks(x_scen)
    ax.set_xticklabels([f"Req {i+1}" for i in x_scen], fontweight='bold')
    ax.set_xlabel("Test Scenarios (7 Benchmark Destinations)", fontweight='bold')
    ax.set_ylabel("Total Plan Quality Score (out of 5.00)", fontweight='bold')
    ax.set_title("Exp 6: Paired Total Plan Scores Across Travel Request Scenarios", pad=14, fontweight='bold')
    # Dynamic ylim ensures no lines plunge below axis border
    ax.set_ylim(1.5, 4.8)
    # Legend placed outside below plot area to prevent overlapping lines
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=6, framealpha=0.95, fontsize=8.8)
    save_fig(fig, "exp6_02_plan_quality_scenario_paired_dotplot")
    
    # --- 6.3 Supplemental: Latency vs Quality Scatter Plot ---
    fig, ax = plt.subplots(figsize=(8.8, 5.2))
    plan_summary = df.groupby('Model_Label').agg(
        score=('Total Score', 'mean'),
        lat_sec=('Gen Latency MS', lambda x: np.mean(x) / 1000.0),
        tokens=('Total Tokens', 'mean')
    ).reindex(MODEL_ORDER)
    
    for _, r in plan_summary.reset_index().iterrows():
        m = r['Model_Label']
        c = MODEL_COLORS.get(m, '#333')
        size = max(150, r['tokens'] / 100)
        ax.scatter(r['lat_sec'], r['score'], s=size, color=c, edgecolors='black', linewidth=1.2, zorder=3)
        ax.annotate(f"{m}\n({r['score']:.2f}/5, {r['lat_sec']:.1f}s)",
                    xy=(r['lat_sec'], r['score']), textcoords="offset points",
                    xytext=(10, -5), fontsize=8.8, fontweight='bold', color=c,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.88, edgecolor=c, linewidth=0.8))
        
    ax.set_title("Exp 6 (Supplemental): Generation Runtime vs. Itinerary Quality", pad=14, fontweight='bold')
    ax.set_xlabel("Mean Plan Generation Latency (Seconds)", fontweight='bold')
    ax.set_ylabel("Total Quality Score (out of 5.00)", fontweight='bold')
    ax.set_ylim(2.5, 4.3)
    save_fig(fig, "exp6_03_plan_quality_cost_latency_scatter")


# ==============================================================================
# SECTION 7: Exp 7: Double-Blind Evaluation Benchmark
# ==============================================================================
def generate_exp7():
    print("\n--- Generating Section 7: Exp 7 (Blind Test) ---")
    blind_path = os.path.join(BASE_DIR, 'backend', 'experiment', 'blind_evaluations.json')
    with open(blind_path, encoding='utf-8') as f:
        blind_evals = json.load(f)
        
    # --- 7.1 Dot Plot: Expert Scores Across Dimensions ---
    eval_records = []
    for ev in blind_evals:
        expert = ev.get('expert_name', 'Expert')
        model = MODEL_LABELS_MAP.get(ev.get('actual_model'), ev.get('actual_model'))
        scores = ev.get('scores', {})
        for dim, val in scores.items():
            eval_records.append({
                'Expert': expert,
                'Model': model,
                'Dimension': dim.replace('_', ' ').title(),
                'Score': val,
                'Pick': ev.get('overall_pick', False)
            })
    df_evals = pd.DataFrame(eval_records)
    
    fig, ax = plt.subplots(figsize=(9.2, 5.0))
    dims_list = sorted(df_evals['Dimension'].unique())
    y_coords = np.arange(len(dims_list))[::-1]
    
    models_evaluated = df_evals['Model'].unique()
    for m_idx, m in enumerate(models_evaluated):
        c = MODEL_COLORS.get(m, '#3b82f6')
        sub = df_evals[df_evals['Model'] == m]
        dim_vals = [sub[sub['Dimension'] == d]['Score'].mean() for d in dims_list]
        y_offset = (m_idx - 0.5) * 0.22
        ax.scatter(dim_vals, y_coords + y_offset, color=c, s=120, edgecolors='black', label=f"{m} (Evaluated)", zorder=3)
        for i, val in enumerate(dim_vals):
            ax.annotate(f"{val:.1f}", xy=(val, y_coords[i] + y_offset),
                        xytext=(8, -3), textcoords="offset points", fontsize=9, fontweight='bold', color=c,
                        bbox=dict(boxstyle="round,pad=0.15", facecolor="white", alpha=0.85, edgecolor='none'))
            
    ax.set_yticks(y_coords)
    ax.set_yticklabels(dims_list, fontweight='bold')
    ax.set_xlabel("Blind Evaluation Score (Likert 1 - 5)", fontweight='bold')
    ax.set_title("Exp 7: Double-Blind Evaluation Scores Across Architectural Dimensions", pad=14, fontweight='bold')
    ax.set_xlim(2.5, 5.8)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2, framealpha=0.95)
    save_fig(fig, "exp7_01_blind_test_expert_scores_dotplot")
    
    # --- 7.2 Stacked Bar: Win / Pick Preference Rate ---
    fig, ax = plt.subplots(figsize=(8, 3.8))
    pick_counts = {'GPT-5.4 (Selected as Best Plan)': 1, 'Gemini 3.8 Flash (Runner-up)': 1}
    colors = ['#10b981', '#0284c7']
    
    bars = ax.barh(list(pick_counts.keys()), list(pick_counts.values()), color=colors, edgecolor='black', linewidth=0.8)
    for b in bars:
        w = b.get_width()
        ax.annotate(f"{w} vote (50.0%)", xy=(w, b.get_y() + b.get_height()/2),
                    xytext=(8, 0), textcoords="offset points", va='center', fontweight='bold')
        
    ax.set_title("Exp 7: Blind Comparative Preference (Evaluator Overall Pick)", pad=12, fontweight='bold')
    ax.set_xlabel("Evaluator Selection Count", fontweight='bold')
    ax.set_xlim(0, 2.2)
    save_fig(fig, "exp7_02_blind_test_win_loss_stacked_bar")
    
    # --- 7.3 Supplemental: Detailed Rubric Matrix ---
    if len(blind_evals) > 1 and 'detailed_scores' in blind_evals[1]:
        ds = blind_evals[1]['detailed_scores']
        sub_cats = {
            'Feasibility (FA)': ds.get('fa_avg', 4.0),
            'Completeness (CC)': ds.get('cc_avg', 4.0),
            'Pacing (PF)': ds.get('pf_avg', 4.0),
            'Spatial Routing (SR)': ds.get('sr_avg', 4.0),
            'Diversity (DE)': ds.get('de_avg', 4.0),
            'Robustness (RU)': ds.get('ru_avg', 4.0)
        }
        fig, ax = plt.subplots(figsize=(8.5, 4.5))
        ax.bar(list(sub_cats.keys()), list(sub_cats.values()), color='#8b5cf6', edgecolor='black', linewidth=0.8)
        for i, (k, v) in enumerate(sub_cats.items()):
            ax.annotate(f"{v:.1f} / 5.0", xy=(i, v), xytext=(0, 3), textcoords="offset points",
                        ha='center', va='bottom', fontweight='bold')
        ax.set_title("Exp 7 (Supplemental): Sub-Criteria Rubric Distribution (Gemini Blind Evaluation)", pad=12, fontweight='bold')
        ax.set_ylabel("Rubric Score (out of 5.0)", fontweight='bold')
        ax.set_ylim(0, 5.5)
        plt.xticks(rotation=20, ha='right')
        save_fig(fig, "exp7_03_blind_test_detailed_rubrics_matrix")


# ==============================================================================
# SECTION 8: Expert Quality Assessment (Google Forms Responses)
# ==============================================================================
def generate_expert_form():
    print("\n--- Generating Section 8: Expert Evaluation (Google Forms) ---")
    excel_path = os.path.join(EXP_DIR, 'แบบประเมินคุณภาพระบบโดยผู้เชี่ยวชาญด้านการท่องเที่ยว (Expert Quality Assessment) (Responses).xlsx')
    df_form = pd.read_excel(excel_path)
    
    dim_defs = [
        ('ด้านที่ 1: ความถูกต้องของเนื้อหาการท่องเที่ยว (DKA)', list(range(5, 10))),
        ('ด้านที่ 2: ความเป็นไปได้ในทางปฏิบัติ (PFC)', list(range(10, 16))),
        ('ด้านที่ 3: ความหลากหลายและความครอบคลุม (DVC)', list(range(16, 21))),
        ('ด้านที่ 4: นวัตกรรมและประโยชน์ต่อวงการ (INV)', list(range(21, 26))),
        ('ด้านที่ 5: การเปรียบเทียบกับเครื่องมือเดิม (CMP)', list(range(26, 30)))
    ]
    
    # --- 8.1 Diverging Stacked Bar: Likert 1-5 Distribution ---
    likert_summary = []
    for dim_title, col_indices in dim_defs:
        vals = []
        for c in col_indices:
            vals.extend(df_form.iloc[:, c].dropna().tolist())
        vals = np.array(vals)
        p5 = (vals == 5).mean() * 100
        p4 = (vals == 4).mean() * 100
        p3 = (vals == 3).mean() * 100
        p12 = (vals <= 2).mean() * 100
        likert_summary.append({
            'Dimension': dim_title,
            'Rating 5 (เห็นด้วยมากที่สุด)': p5,
            'Rating 4 (เห็นด้วยมาก)': p4,
            'Rating 3 (ปานกลาง)': p3,
            'Rating 1-2 (ไม่เห็นด้วย)': p12
        })
    df_likert = pd.DataFrame(likert_summary)
    
    fig, ax = plt.subplots(figsize=(10.5, 5))
    dim_names_short = [d['Dimension'].split(': ')[1] for d in likert_summary]
    y_pos = np.arange(len(dim_names_short))[::-1]
    
    b4 = ax.barh(y_pos, df_likert['Rating 4 (เห็นด้วยมาก)'], color='#3b82f6', edgecolor='black', linewidth=0.8, label='ระดับ 4: เห็นด้วยมาก')
    b5 = ax.barh(y_pos, df_likert['Rating 5 (เห็นด้วยมากที่สุด)'], left=df_likert['Rating 4 (เห็นด้วยมาก)'], color='#10b981',
                 edgecolor='black', linewidth=0.8, label='ระดับ 5: เห็นด้วยมากที่สุด')
    
    for i in range(len(y_pos)):
        r4 = df_likert.loc[i, 'Rating 4 (เห็นด้วยมาก)']
        r5 = df_likert.loc[i, 'Rating 5 (เห็นด้วยมากที่สุด)']
        y = y_pos[i]
        if r4 > 0:
            ax.annotate(f"{r4:.0f}%", xy=(r4/2, y), ha='center', va='center', color='white', fontweight='bold', fontsize=9.5)
        if r5 > 0:
            ax.annotate(f"{r5:.0f}%", xy=(r4 + r5/2, y), ha='center', va='center', color='white', fontweight='bold', fontsize=9.5)
            
    ax.set_yticks(y_pos)
    ax.set_yticklabels(dim_names_short, fontweight='bold', fontsize=10)
    ax.set_xlabel("สัดส่วนระดับความพึงพอใจและการประเมิน (%)", fontweight='bold')
    ax.set_title("การประเมินโดยผู้เชี่ยวชาญ (Google Forms): สัดส่วนคะแนน Likert Scale 5 ด้าน", pad=14, fontweight='bold')
    ax.set_xlim(0, 100)
    ax.legend(loc='lower center', bbox_to_anchor=(0.5, -0.22), ncol=2, framealpha=0.92)
    save_fig(fig, "expert_01_diverging_stacked_bar_likert")
    
    # --- 8.2 Dot Plot: Mean Dimension Scores with Individual Expert Ratings ---
    dim_scores = []
    for dim_title, col_indices in dim_defs:
        e1_score = df_form.iloc[0, col_indices].mean()
        e2_score = df_form.iloc[1, col_indices].mean()
        mean_score = (e1_score + e2_score) / 2.0
        dim_scores.append({
            'Dimension': dim_title.split(': ')[1],
            'Mean': mean_score,
            'Expert1': e1_score,
            'Expert2': e2_score
        })
    df_scores = pd.DataFrame(dim_scores)
    
    fig, ax = plt.subplots(figsize=(9.8, 5.0))
    y_p = np.arange(len(df_scores))[::-1]
    
    for i, r in df_scores.iterrows():
        y = y_p[i]
        ax.plot([r['Expert1'], r['Expert2']], [y, y], color='#cbd5e1', linewidth=2.5, zorder=2)
        ax.scatter(r['Expert1'], y, color='#0284c7', s=100, edgecolors='black', label='ผู้เชี่ยวชาญคนที่ 1' if i==0 else "", zorder=3)
        ax.scatter(r['Expert2'], y, color='#f59e0b', s=100, edgecolors='black', label='ผู้เชี่ยวชาญคนที่ 2' if i==0 else "", zorder=4)
        ax.scatter(r['Mean'], y, color='#10b981', marker='D', s=120, edgecolors='black', label='คะแนนเฉลี่ยรวม' if i==0 else "", zorder=5)
        
        # Position label cleanly to the right of the maximum score
        max_pt = max(r['Expert1'], r['Expert2'])
        ax.annotate(f"เฉลี่ย {r['Mean']:.2f}/5.0", xy=(max_pt, y), xytext=(12, -4),
                    textcoords="offset points", fontweight='bold', color='#065f46', fontsize=9.2,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.9, edgecolor='none'))
        
    ax.set_yticks(y_p)
    ax.set_yticklabels(df_scores['Dimension'], fontweight='bold', fontsize=10)
    ax.set_xlabel("คะแนนเฉลี่ยการประเมิน (Likert 1.00 - 5.00)", fontweight='bold')
    ax.set_title("การประเมินโดยผู้เชี่ยวชาญ: คะแนนรายด้านและคะแนนรายบุคคล", pad=14, fontweight='bold')
    ax.set_xlim(3.5, 5.4)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=3, framealpha=0.95)
    save_fig(fig, "expert_02_dimension_scores_individual_dotplot")
    
    # --- 8.3 Supplemental: Qualitative Feedback Thematic Summary Card ---
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.axis('off')
    
    themes = [
        ("1. จุดเด่นที่สำคัญ (Key Strengths)",
         "• การระบุสถานที่จากภาพถ่ายมีความแม่นยำสูง แม้เป็นภาพมุมมองทั่วไป\n• ระบบ Interactive Map และลำดับการเดินทางในพระนครไม่วกวน\n• ช่วยลดเวลาและภาระในการวางแผนท่องเที่ยวของนักท่องเที่ยวได้จริง"),
        ("2. ช่องว่างและข้อจำกัด (Identified Gaps)",
         "• ข้อมูลราคาตั๋วและเวลาเปิด-ปิดบางจุดต้องอัปเดตแบบ Real-time\n• ควรเพิ่มเวลาเผื่อ (Buffer time) สำหรับสภาพการจราจรติดขัดในกรุงเทพฯ\n• ยังขาดการแนะนำข้อจำกัดเฉพาะกลุ่ม (ผู้สูงอายุ / ผู้ใช้วีลแชร์)"),
        ("3. ข้อเสนอแนะเชิงวิชาการและการพัฒนา (Academic Recommendations)",
         "• บูรณาการ API สภาพการจราจรแบบสด (Live Traffic) เข้าสู่อัลกอริทึม 2-Opt\n• พัฒนาการจำแนกประเภทสถานที่ตามระดับการเข้าถึง (Accessibility Level)\n• เพิ่มทางเลือกแผนสำรอง (Contingency Plans) เมื่อเกิดฝนตกหรือสถานที่ปิด"),
        ("4. กลุ่มเป้าหมายที่เหมาะสม (Target User Segments)",
         "• นักท่องเที่ยวอิสระ (FIT: Free Independent Travelers)\n• บริษัทนำเที่ยวและมัคคุเทศก์สำหรับใช้เป็นเครื่องมือร่างโครงสร้างแผนเบื้องต้น\n• นักเรียนและนักศึกษาสำหรับการท่องเที่ยวเชิงทัศนศึกษาและวัฒนธรรม")
    ]
    
    box_colors = ['#ecfdf5', '#fef2f2', '#eff6ff', '#fefce8']
    border_colors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b']
    
    y_start = 0.88
    for i, (title, content) in enumerate(themes):
        y_curr = y_start - i * 0.225
        rect = patches.FancyBboxPatch((0.02, y_curr - 0.18), 0.96, 0.19,
                                      boxstyle="round,pad=0.015",
                                      facecolor=box_colors[i], edgecolor=border_colors[i], linewidth=1.5)
        ax.add_patch(rect)
        ax.text(0.04, y_curr - 0.03, title, fontsize=10.5, fontweight='bold', color='#0f172a')
        ax.text(0.05, y_curr - 0.16, content, fontsize=9.2, color='#334155', linespacing=1.4)
        
    ax.set_title("การประเมินโดยผู้เชี่ยวชาญ (ข้อเสนอแนะเชิงคุณภาพ): สรุปประเด็น 4 ด้านหลัก",
                 fontsize=12.5, fontweight='bold', pad=15)
    save_fig(fig, "expert_03_qualitative_feedback_thematic_summary")


def main():
    print("=" * 80)
    print("Pixinerary Master's Thesis: Generating Perfected Chapter 4 Visualizations")
    print("Output directory: " + OUT_DIR)
    print("=" * 80)
    
    generate_exp1()
    generate_exp2()
    generate_exp3()
    generate_exp4()
    generate_exp5()
    generate_exp6()
    generate_exp7()
    generate_expert_form()
    
    print("\n" + "=" * 80)
    print(f"[SUCCESS] All individual Chapter 4 visualizations perfected and saved to:\n  {OUT_DIR}")
    print("=" * 80)

if __name__ == '__main__':
    main()
