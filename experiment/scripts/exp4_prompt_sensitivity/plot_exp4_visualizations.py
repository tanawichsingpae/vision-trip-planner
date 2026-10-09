"""
Experiment 4: Prompt Sensitivity & In-Context Reasoning Visualizations
Publication-Grade Figures for Master's Thesis / Academic Papers
Pixinerary Research Project
"""

import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
import seaborn as sns
import textwrap

# Set academic publication style
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 10.5
plt.rcParams['axes.titlesize'] = 12.5
plt.rcParams['axes.labelsize'] = 10.5
plt.rcParams['xtick.labelsize'] = 9.5
plt.rcParams['ytick.labelsize'] = 9.5
plt.rcParams['legend.fontsize'] = 9.5
plt.rcParams['figure.titlesize'] = 13.5
plt.rcParams['figure.dpi'] = 300

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'exp4_prompt_sensitivity.csv'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'figures', 'exp4_prompt_sensitivity'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(CSV_PATH)
df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
df['Time_Sec'] = df['Time MS'] / 1000.0

# Human-readable labels
PROMPT_LABELS = {
    'P1': 'P1: Zero-Shot (EN)',
    'P2': 'P2: Persona (Role)',
    'P3': 'P3: CoT Reasoning',
    'P4': 'P4: Native Thai (TH)',
    'P5': 'P5: Few-Shot ICL'
}
df['Prompt_Label'] = df['Prompt Variant ID'].map(PROMPT_LABELS)

MODEL_LABELS = {
    'anthropic-claude-sonnet5': 'Claude Sonnet 5',
    'google-gemini-38-flash': 'Gemini 3.8 Flash',
    'openai-gpt-54': 'GPT-5.4',
    'openai-gpt-54-mini': 'GPT-5.4 Mini',
    'qwen-25-vl-72b': 'Qwen 2.5 VL 72B',
    'meta-llama4': 'Llama 4 Maverick'
}
df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS.get(x, x))

MODEL_COLORS = {
    'Gemini 3.8 Flash': '#0284c7',    # Vibrant Cyan/Blue
    'GPT-5.4': '#10b981',             # Emerald Green
    'Claude Sonnet 5': '#8b5cf6',     # Purple
    'Qwen 2.5 VL 72B': '#f59e0b',     # Amber
    'GPT-5.4 Mini': '#06b6d4',        # Teal
    'Llama 4 Maverick': '#ef4444'     # Rose/Red
}

PROMPT_COLORS = {
    'P1': '#2563eb', # Blue (P1 Baseline)
    'P2': '#7c3aed', # Purple
    'P3': '#dc2626', # Red (CoT)
    'P4': '#d97706', # Amber (Thai)
    'P5': '#059669'  # Emerald (Few-Shot)
}

TIER_LABELS = {
    'tier1_iconic': 'Tier 1\n(Iconic)',
    'tier2_longtail': 'Tier 2\n(Regional)',
    'tier3_nature': 'Tier 3\n(Nature)',
    'tier4_ugc': 'Tier 4\n(Casual UGC)'
}
df['Tier_Label'] = df['Tier'].map(TIER_LABELS)


# =========================================================================
# Figure 0: Grouped Bar Chart of Accuracy per Prompt by Model
# =========================================================================
def plot_fig0_grouped_bar():
    prompt_order = ['P1: Zero-Shot (EN)', 'P2: Persona (Role)', 'P3: CoT Reasoning', 'P4: Native Thai (TH)', 'P5: Few-Shot ICL']
    prompt_palette = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899']

    pivot = df.pivot_table(
        index='Model_Label',
        columns='Prompt_Label',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(columns=prompt_order)

    model_order = pivot['P1: Zero-Shot (EN)'].sort_values(ascending=False).index.tolist()
    pivot = pivot.reindex(index=model_order)

    fig, ax = plt.subplots(figsize=(12, 5.5))
    n_models = len(model_order)
    n_prompts = len(prompt_order)
    bar_width = 0.15
    indices = np.arange(n_models)

    for i, p_col in enumerate(prompt_order):
        vals = pivot[p_col].values
        offset = (i - (n_prompts - 1) / 2) * bar_width
        bars = ax.bar(indices + offset, vals, width=bar_width, label=p_col,
                      color=prompt_palette[i], edgecolor='black', linewidth=0.7)
        for b in bars:
            h = b.get_height()
            if h > 0:
                ax.annotate(f"{h:.0f}%", xy=(b.get_x() + b.get_width() / 2, h),
                            xytext=(0, 2), textcoords="offset points", ha='center', va='bottom',
                            fontsize=7.5, rotation=90)

    ax.set_title("Experiment 4: Top-1 Accuracy across 5 Prompt Paradigms by Model", pad=12, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)")
    ax.set_xticks(indices)
    ax.set_xticklabels(model_order, rotation=15, ha='right', fontweight='semibold')
    ax.set_ylim(0, 115)
    ax.axhline(80, color='#64748b', linestyle=':', linewidth=1.0)
    ax.legend(title="Prompt Paradigm", loc='lower left', framealpha=0.9, bbox_to_anchor=(0.0, 1.02), ncol=5)

    ax.text(0.99, 0.02, "Note: Accuracies across Exp 1 & Exp 4 cannot be directly compared due to differing test image subsets.",
            transform=ax.transAxes, ha='right', va='bottom', fontsize=8, fontstyle='italic', color='#64748b')

    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig0_model_prompt_grouped_bar.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig0_model_prompt_grouped_bar.pdf"))
    plt.close()
    print("Saved Fig 0: Grouped Bar Chart of Accuracy per Prompt by Model")


# =========================================================================
# Figure 1: Model × Prompt Accuracy Heatmap (Cross-Paradigm Robustness)
# =========================================================================
def plot_fig1_heatmap():
    pivot = df.pivot_table(
        index='Model_Label',
        columns='Prompt_Label',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    )
    
    ordered_cols = [PROMPT_LABELS[k] for k in ['P1', 'P2', 'P3', 'P4', 'P5']]
    pivot = pivot[ordered_cols]
    
    fig, ax = plt.subplots(figsize=(9, 5))
    sns.heatmap(
        pivot,
        annot=True,
        fmt=".1f",
        cmap="YlGnBu",
        cbar_kws={'label': 'Accuracy (%)'},
        vmin=max(70, int(pivot.min().min() - 5)),
        vmax=100,
        linewidths=1,
        linecolor='white',
        ax=ax
    )
    ax.set_title("Exp 4: Cross-Paradigm Model Robustness Matrix\n(Accuracy % across Prompt Strategies)", pad=15, fontweight='bold')
    ax.set_xlabel("Prompt Paradigm", labelpad=10, fontweight='bold')
    ax.set_ylabel("Vision-Language Model", labelpad=10, fontweight='bold')
    plt.xticks(rotation=15, ha='right')
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig1_model_prompt_heatmap.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig1_model_prompt_heatmap.pdf"))
    plt.close()
    print("Saved Fig 1: Heatmap")


# =========================================================================
# Figure 2: Accuracy vs. Latency Pareto Frontier (FIXED & DYNAMIC)
# =========================================================================
def plot_fig2_pareto():
    summary = df.groupby('Prompt Variant ID').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat_mean=('Time MS', 'mean'),
        lat_std=('Time MS', 'std'),
        count=('is_correct_bool', 'count'),
        tokens_mean=('Total Tokens', 'mean'),
        cost_mean=('Cost USD', 'mean')
    ).reset_index()
    
    summary['label'] = summary['Prompt Variant ID'].map(PROMPT_LABELS)
    summary['lat_se'] = summary['lat_std'] / np.sqrt(summary['count'])
    
    # Calculate Pareto optimal points dynamically
    sorted_s = summary.sort_values('lat_mean').reset_index(drop=True)
    pareto_points = []
    curr_max_acc = -1.0
    for _, r in sorted_s.iterrows():
        if r['acc'] >= curr_max_acc:
            pareto_points.append(r)
            curr_max_acc = r['acc']
    pareto_df = pd.DataFrame(pareto_points)
    
    fig, ax = plt.subplots(figsize=(8.5, 5.5))
    
    for _, row in summary.iterrows():
        v = row['Prompt Variant ID']
        c = PROMPT_COLORS.get(v, '#333333')
        ax.errorbar(
            row['lat_mean'],
            row['acc'],
            xerr=row['lat_se'] * 1.96, # 95% CI for latency
            fmt='o',
            color=c,
            ecolor=c,
            elinewidth=1.6,
            capsize=4,
            markersize=11,
            label=row['label']
        )
        
        # Adaptive annotation offset to avoid overlapping
        offset_y = 6 if v not in ['P4', 'P5'] else -18
        offset_x = 10 if v != 'P3' else -95
        ax.annotate(
            f"{v}\n({row['acc']:.1f}%, {row['lat_mean']:.0f}ms)",
            (row['lat_mean'], row['acc']),
            textcoords="offset points",
            xytext=(offset_x, offset_y),
            fontsize=9.5,
            fontweight='bold',
            color=c,
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.75, edgecolor="none")
        )
        
    # Draw dynamic Pareto frontier curve
    if len(pareto_df) > 1:
        ax.plot(pareto_df['lat_mean'], pareto_df['acc'], '--', color='#10b981', linewidth=2.2, alpha=0.85, label='Pareto Frontier (Optimal Trade-off)')
    elif len(pareto_df) == 1:
        ax.scatter(pareto_df['lat_mean'], pareto_df['acc'], s=220, facecolors='none', edgecolors='#10b981', linewidths=2.5, label='Pareto Dominant Paradigm')
    
    ax.set_title("Exp 4: Accuracy vs. Inference Latency Trade-Off\n(Cross-Prompt Pareto Frontier Analysis)", pad=15, fontweight='bold')
    ax.set_xlabel("Mean Inference Latency (ms) — Lower is Better", labelpad=10, fontweight='bold')
    ax.set_ylabel("Overall Top-1 Accuracy (%) — Higher is Better", labelpad=10, fontweight='bold')
    
    # Dynamic axis limits with 10% breathing room
    x_min, x_max = summary['lat_mean'].min(), summary['lat_mean'].max()
    y_min, y_max = summary['acc'].min(), summary['acc'].max()
    ax.set_xlim(max(0, x_min - (x_max - x_min) * 0.25), x_max + (x_max - x_min) * 0.2)
    ax.set_ylim(max(0, y_min - 3.5), min(100.5, y_max + 2.5))
    
    ax.grid(True, linestyle='--', alpha=0.5)
    ax.legend(loc='lower left', frameon=True, framealpha=0.92, edgecolor='#cbd5e1')
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig2_pareto_accuracy_latency.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig2_pareto_accuracy_latency.pdf"))
    plt.close()
    print("Saved Fig 2: Pareto Frontier (Fixed & Dynamic)")


# =========================================================================
# Figure 3: Tier-Stratified Clustered Bar Chart (Domain Difficulty)
# =========================================================================
def plot_fig3_tier_breakdown():
    tier_summary = df.groupby(['Tier', 'Prompt Variant ID']).agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100)
    ).reset_index()
    
    tier_summary['Tier_Name'] = tier_summary['Tier'].map(TIER_LABELS)
    tier_summary['Prompt_Name'] = tier_summary['Prompt Variant ID'].map(PROMPT_LABELS)
    
    fig, ax = plt.subplots(figsize=(10, 5.5))
    palette = [PROMPT_COLORS[k] for k in ['P1', 'P2', 'P3', 'P4', 'P5']]
    
    sns.barplot(
        data=tier_summary,
        x='Tier_Name',
        y='acc',
        hue='Prompt_Name',
        palette=palette,
        edgecolor='black',
        linewidth=0.6,
        ax=ax
    )
    
    ax.set_title("Exp 4: Accuracy by Environmental Difficulty Tier\n(Ceiling Effect in T1-T2 vs. Real-World Discrimination in T3-T4)", pad=15, fontweight='bold')
    ax.set_xlabel("Visual Domain & Difficulty Tier", labelpad=10, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)", labelpad=10, fontweight='bold')
    ax.set_ylim(60, 105)
    ax.axhline(100, color='gray', linestyle=':', alpha=0.6)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(title='Prompt Paradigm', bbox_to_anchor=(1.02, 1), loc='upper left', frameon=True)
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig3_tier_breakdown.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig3_tier_breakdown.pdf"))
    plt.close()
    print("Saved Fig 3: Tier Breakdown")


# =========================================================================
# Figure 4: Cost vs. Latency Distribution (Violin & Box Plot)
# =========================================================================
def plot_fig4_latency_cost():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8))
    palette = [PROMPT_COLORS[k] for k in ['P1', 'P2', 'P3', 'P4', 'P5']]
    
    # Latency Boxplot
    sns.boxplot(
        data=df,
        x='Prompt Variant ID',
        y='Time_Sec',
        hue='Prompt Variant ID',
        palette=palette,
        legend=False,
        ax=ax1,
        showmeans=True,
        meanprops={"marker":"o", "markerfacecolor":"white", "markeredgecolor":"black", "markersize":"6"}
    )
    ax1.set_title("(a) Response Latency Distribution", fontweight='bold', pad=10)
    ax1.set_xlabel("Prompt Variant", fontweight='bold')
    ax1.set_ylabel("Latency (Seconds)", fontweight='bold')
    ax1.grid(axis='y', linestyle='--', alpha=0.5)
    
    # Cost Comparison Bar
    cost_summary = df.groupby('Prompt Variant ID')['Cost USD'].mean() * 1000
    ax2.bar(
        cost_summary.index,
        cost_summary.values,
        color=palette,
        edgecolor='black',
        linewidth=0.6
    )
    for idx, val in enumerate(cost_summary.values):
        ax2.text(idx, val + 0.08, f"${val:.2f}", ha='center', fontsize=9.5, fontweight='bold')
        
    ax2.set_title("(b) Estimated Cost per 1,000 Queries (USD)", fontweight='bold', pad=10)
    ax2.set_xlabel("Prompt Variant", fontweight='bold')
    ax2.set_ylabel("Cost per 1k Queries ($)", fontweight='bold')
    ax2.set_ylim(0, max(cost_summary.values) * 1.25)
    ax2.grid(axis='y', linestyle='--', alpha=0.5)
    
    plt.suptitle("Exp 4: Computational Overhead & Financial Feasibility", fontsize=13, fontweight='bold', y=1.02)
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig4_latency_and_cost.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig4_latency_and_cost.pdf"))
    plt.close()
    print("Saved Fig 4: Latency & Cost")


# =========================================================================
# Figure 5: Model-Level Tri-Factor Pareto (Accuracy × Latency × Cost)
# =========================================================================
def plot_fig5_model_pareto():
    m_summary = df.groupby('Model_Label').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat_sec=('Time_Sec', 'mean'),
        cost_1k=('Cost USD', lambda x: np.mean(x) * 1000.0),
        tps=('Tokens Per Sec', 'mean'),
        total_tokens=('Total Tokens', 'mean')
    ).reset_index()
    
    fig, ax = plt.subplots(figsize=(9.5, 6))
    
    # Sort for Pareto calculation
    sorted_m = m_summary.sort_values('lat_sec').reset_index(drop=True)
    pareto_models = []
    curr_max_acc = -1.0
    for _, r in sorted_m.iterrows():
        if r['acc'] >= curr_max_acc:
            pareto_models.append(r)
            curr_max_acc = r['acc']
    pareto_m_df = pd.DataFrame(pareto_models)
    
    # Plot bubbles: size proportional to cost per 1k
    for _, row in m_summary.iterrows():
        m_name = row['Model_Label']
        c = MODEL_COLORS.get(m_name, '#475569')
        bubble_size = max(160, row['cost_1k'] * 120 + 80)
        
        ax.scatter(
            row['lat_sec'],
            row['acc'],
            s=bubble_size,
            color=c,
            alpha=0.82,
            edgecolors='black',
            linewidth=1.2,
            zorder=4
        )
        
        # Smart label offsets
        offset_x, offset_y = 12, 5
        if m_name == 'Gemini 3.8 Flash':
            offset_x, offset_y = -120, -18
        elif m_name == 'Claude Sonnet 5':
            offset_x, offset_y = 12, 10
        elif m_name == 'GPT-5.4':
            offset_x, offset_y = -75, 12
        elif m_name == 'Llama 4 Maverick':
            offset_x, offset_y = -115, -16
            
        ax.annotate(
            f"{m_name}\n({row['acc']:.1f}%, {row['lat_sec']:.2f}s, ${row['cost_1k']:.2f}/1k)",
            (row['lat_sec'], row['acc']),
            textcoords="offset points",
            xytext=(offset_x, offset_y),
            fontsize=9.2,
            fontweight='bold',
            color='#1e293b',
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", alpha=0.85, edgecolor=c, linewidth=1),
            zorder=5
        )
        
    # Draw Pareto frontier line
    if len(pareto_m_df) > 1:
        ax.plot(
            pareto_m_df['lat_sec'],
            pareto_m_df['acc'],
            '--',
            color='#059669',
            linewidth=2.2,
            alpha=0.85,
            label='Pareto Optimal Frontier (Speed vs. Accuracy)',
            zorder=3
        )
        
    ax.set_title("Exp 4: Model-Level Tri-Factor Pareto Frontier\n(Accuracy vs. Latency vs. Cost per 1,000 Queries)", pad=16, fontweight='bold')
    ax.set_xlabel("Mean Inference Latency (Seconds) — Lower is Better", labelpad=10, fontweight='bold')
    ax.set_ylabel("Overall Top-1 Accuracy (%) — Higher is Better", labelpad=10, fontweight='bold')
    
    # Dynamic limits
    x_min, x_max = m_summary['lat_sec'].min(), m_summary['lat_sec'].max()
    y_min, y_max = m_summary['acc'].min(), m_summary['acc'].max()
    ax.set_xlim(max(0, x_min - 0.7), x_max + 0.8)
    ax.set_ylim(max(60, y_min - 4.5), min(101.5, y_max + 3.0))
    ax.grid(True, linestyle='--', alpha=0.5, zorder=1)
    
    # Legend for bubble size & Pareto
    legend_elements = [
        plt.Line2D([0], [0], linestyle='--', color='#059669', lw=2, label='Pareto Optimal Line'),
        plt.scatter([], [], s=120, color='#94a3b8', alpha=0.7, edgecolors='black', label='Bubble Area ∝ Cost per 1k ($ USD)')
    ]
    ax.legend(handles=legend_elements, loc='lower left', frameon=True, framealpha=0.92, edgecolor='#cbd5e1')
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig5_model_trifactor_pareto.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig5_model_trifactor_pareto.pdf"))
    plt.close()
    print("Saved Fig 5: Model Tri-Factor Pareto")


# =========================================================================
# Figure 6: Multi-Dimensional Radar Chart (Spider Plot)
# =========================================================================
def plot_fig6_radar():
    m_summary = df.groupby('Model_Label').agg(
        overall_acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat_mean=('Time MS', 'mean'),
        cost_1k=('Cost USD', lambda x: np.mean(x) * 1000.0),
        tps=('Tokens Per Sec', 'mean')
    )
    
    # Specific dimensions
    p4_acc = df[df['Prompt Variant ID'] == 'P4'].groupby('Model_Label')['is_correct_bool'].mean() * 100
    hard_acc = df[df['Tier'].isin(['tier3_nature', 'tier4_ugc'])].groupby('Model_Label')['is_correct_bool'].mean() * 100
    
    radar_df = pd.DataFrame({
        'Overall\nAccuracy': m_summary['overall_acc'],
        'Cross-Lingual\nThai (P4)': p4_acc,
        'Hard Tiers\n(Nature/UGC)': hard_acc,
        'Inference\nSpeed': 100 * (m_summary['lat_mean'].min() / m_summary['lat_mean']),
        'Cost\nEconomy': 100 * (m_summary['cost_1k'].min() / m_summary['cost_1k']),
        'Reasoning\nThroughput': 100 * (m_summary['tps'] / m_summary['tps'].max())
    })
    
    categories = list(radar_df.columns)
    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]
    
    fig, ax = plt.subplots(figsize=(8.5, 7.5), subplot_kw=dict(polar=True))
    plt.xticks(angles[:-1], categories, color='#1e293b', size=9.5, fontweight='bold')
    
    ax.set_rlabel_position(22)
    plt.yticks([25, 50, 75, 100], ["25", "50", "75", "100"], color="#64748b", size=8.5)
    plt.ylim(0, 105)
    
    for model_name, row in radar_df.iterrows():
        values = row.values.flatten().tolist()
        values += values[:1]
        c = MODEL_COLORS.get(model_name, '#333333')
        lw = 2.4 if model_name == 'Gemini 3.8 Flash' else 1.6
        ax.plot(angles, values, linewidth=lw, linestyle='solid', label=model_name, color=c)
        ax.fill(angles, values, color=c, alpha=0.08)
        
    ax.set_title("Exp 4: Multi-Dimensional Model Capability Profile\n(Normalized Holistic Benchmark Across 6 Axes)", pad=24, fontweight='bold')
    ax.legend(loc='upper right', bbox_to_anchor=(1.25, 1.1), frameon=True, framealpha=0.9)
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig6_multidimensional_radar.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig6_multidimensional_radar.pdf"))
    plt.close()
    print("Saved Fig 6: Radar Chart")


# =========================================================================
# Figure 7: Prompt Elasticity & Stability Index (Slope Graph / Parallel)
# =========================================================================
def plot_fig7_prompt_elasticity():
    pivot = df.pivot_table(
        index='Model_Label',
        columns='Prompt Variant ID',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    )[['P1', 'P2', 'P3', 'P4', 'P5']]
    
    # Calculate stability index (standard deviation and max-min spread across prompts)
    stds = pivot.std(axis=1).round(2)
    spreads = (pivot.max(axis=1) - pivot.min(axis=1)).round(2)
    
    fig, ax = plt.subplots(figsize=(9, 5.5))
    x_coords = np.arange(len(pivot.columns))
    
    for model_name, row in pivot.iterrows():
        c = MODEL_COLORS.get(model_name, '#333333')
        lw = 2.6 if model_name in ['Gemini 3.8 Flash', 'Llama 4 Maverick'] else 1.7
        ls = '-' if model_name != 'Llama 4 Maverick' else '--'
        ax.plot(x_coords, row.values, marker='o', markersize=7, linewidth=lw, linestyle=ls, color=c, label=f"{model_name} (σ={stds[model_name]:.1f})")
        
        # Annotate end points
        ax.annotate(
            f"{row.values[-1]:.1f}%",
            (x_coords[-1], row.values[-1]),
            textcoords="offset points",
            xytext=(8, -3),
            fontsize=8.8,
            fontweight='bold',
            color=c
        )
        
    ax.set_xticks(x_coords)
    ax.set_xticklabels([f"{k}\n({PROMPT_LABELS[k].split(': ')[1]})" for k in pivot.columns], fontweight='bold')
    ax.set_title("Exp 4: Cross-Paradigm Prompt Elasticity & Stability\n(Evaluating Model Invariance vs. Sensitivity to Prompt Changes)", pad=15, fontweight='bold')
    ax.set_xlabel("Prompt Paradigm (Single-Variable Isolation)", labelpad=10, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)", labelpad=10, fontweight='bold')
    
    y_min = pivot.values.min()
    ax.set_ylim(max(50, y_min - 5), 102.5)
    ax.grid(True, linestyle='--', alpha=0.5)
    ax.legend(loc='lower left', frameon=True, framealpha=0.92, title="Model (Stability Index σ)")
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig7_prompt_elasticity_slope.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig7_prompt_elasticity_slope.pdf"))
    plt.close()
    print("Saved Fig 7: Prompt Elasticity Slope")


# =========================================================================
# Figure 8: Failure Mode Taxonomy Distribution (Stacked Bar Charts)
# =========================================================================
def plot_fig8_failure_taxonomy():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    
    # Subplot (a): Errors by Tier
    tier_err = pd.crosstab(df['Tier_Label'], df['Failure Mode'], normalize='index') * 100
    cols = [c for c in ['none', 'visual_confusion', 'hallucination_overconfidence'] if c in tier_err.columns]
    tier_err = tier_err[cols]
    
    error_colors = {
        'none': '#10b981',                         # Emerald (Success)
        'visual_confusion': '#f59e0b',             # Amber (Visual Confusion)
        'hallucination_overconfidence': '#ef4444'  # Red (Hallucination)
    }
    palette_a = [error_colors[c] for c in cols]
    
    tier_err.plot(
        kind='bar',
        stacked=True,
        color=palette_a,
        edgecolor='black',
        linewidth=0.6,
        ax=ax1
    )
    ax1.set_title("(a) Failure Mode Distribution by Visual Tier", fontweight='bold', pad=12)
    ax1.set_xlabel("Environmental Difficulty Tier", fontweight='bold')
    ax1.set_ylabel("Percentage of Total Inferences (%)", fontweight='bold')
    ax1.set_ylim(0, 100)
    ax1.grid(axis='y', linestyle='--', alpha=0.5)
    ax1.set_xticklabels(tier_err.index, rotation=0)
    ax1.legend(title='Outcome / Error Mode', frameon=True)
    
    # Subplot (b): Errors by Model
    model_err = pd.crosstab(df['Model_Label'], df['Failure Mode'])
    cols_m = [c for c in ['visual_confusion', 'hallucination_overconfidence'] if c in model_err.columns]
    
    # Only plot error counts (excluding 'none' to highlight failures)
    model_err_counts = model_err[cols_m]
    palette_b = [error_colors[c] for c in cols_m]
    
    model_err_counts.plot(
        kind='barh',
        stacked=True,
        color=palette_b,
        edgecolor='black',
        linewidth=0.6,
        ax=ax2
    )
    ax2.set_title("(b) Absolute Error Count by Model & Category", fontweight='bold', pad=12)
    ax2.set_xlabel("Number of Failed Inferences (out of 200)", fontweight='bold')
    ax2.set_ylabel("Vision-Language Model", fontweight='bold')
    ax2.grid(axis='x', linestyle='--', alpha=0.5)
    ax2.legend(title='Failure Category', frameon=True)
    
    plt.suptitle("Exp 4: Failure Mode Taxonomy & Root Cause Breakdown", fontsize=13.5, fontweight='bold', y=1.02)
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig8_failure_taxonomy_distribution.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig8_failure_taxonomy_distribution.pdf"))
    plt.close()
    print("Saved Fig 8: Failure Taxonomy Distribution")


# =========================================================================
# Figure 9: CoT Cost-Benefit ROI (Chain-of-Thought Efficiency)
# =========================================================================
def plot_fig9_cot_efficiency():
    p1 = df[df['Prompt Variant ID'] == 'P1'].groupby('Model_Label').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat=('Time MS', 'mean'),
        tokens=('Total Tokens', 'mean'),
        cost=('Cost USD', 'mean')
    )
    p3 = df[df['Prompt Variant ID'] == 'P3'].groupby('Model_Label').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat=('Time MS', 'mean'),
        tokens=('Total Tokens', 'mean'),
        cost=('Cost USD', 'mean')
    )
    
    cot_roi = pd.DataFrame({
        'delta_acc': p3['acc'] - p1['acc'],
        'delta_lat_pct': ((p3['lat'] - p1['lat']) / p1['lat']) * 100,
        'delta_cost_pct': ((p3['cost'] - p1['cost']) / p1['cost']) * 100
    }).reset_index()
    
    fig, ax = plt.subplots(figsize=(9, 5.5))
    
    # Horizontal line at 0 accuracy gain
    ax.axhline(0, color='#64748b', linestyle='--', linewidth=1.2, alpha=0.8)
    
    for _, row in cot_roi.iterrows():
        m_name = row['Model_Label']
        c = MODEL_COLORS.get(m_name, '#333333')
        
        ax.scatter(
            row['delta_lat_pct'],
            row['delta_acc'],
            s=180,
            color=c,
            edgecolors='black',
            linewidth=1.2,
            zorder=4
        )
        
        # Annotate
        offset_y = 6 if row['delta_acc'] >= 0 else -18
        ax.annotate(
            f"{m_name}\n(ΔAcc: {row['delta_acc']:+.1f}%, +{row['delta_lat_pct']:.0f}% Latency)",
            (row['delta_lat_pct'], row['delta_acc']),
            textcoords="offset points",
            xytext=(10, offset_y),
            fontsize=9.2,
            fontweight='bold',
            color='#1e293b',
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", alpha=0.85, edgecolor=c, linewidth=1),
            zorder=5
        )
        
    ax.set_title("Exp 4: Chain-of-Thought (P3 CoT) Cost-Benefit ROI\n(Accuracy Gain vs. Inference Latency Penalty Relative to P1 Zero-Shot)", pad=15, fontweight='bold')
    ax.set_xlabel("Latency Overhead from CoT (% Increase in Inference Time) — Lower is Better", labelpad=10, fontweight='bold')
    ax.set_ylabel("Accuracy Gain from CoT (Δ Percentage Points) — Higher is Better", labelpad=10, fontweight='bold')
    
    # Quadrant shading
    x_min, x_max = max(0, cot_roi['delta_lat_pct'].min() - 10), cot_roi['delta_lat_pct'].max() + 35
    y_min, y_max = cot_roi['delta_acc'].min() - 2.5, cot_roi['delta_acc'].max() + 2.5
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    
    # Color-coded zones
    ax.axhspan(0, y_max, facecolor='#ecfdf5', alpha=0.4, label='Beneficial CoT Zone (Net Positive ROI)')
    ax.axhspan(y_min, 0, facecolor='#fef2f2', alpha=0.4, label='Harmful CoT Zone (Overthinking Penalty)')
    
    ax.grid(True, linestyle='--', alpha=0.5, zorder=1)
    ax.legend(loc='lower left', frameon=True, framealpha=0.92, edgecolor='#cbd5e1')
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig9_cot_cost_benefit_roi.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig9_cot_cost_benefit_roi.pdf"))
    plt.close()
    print("Saved Fig 9: CoT Cost-Benefit ROI")


# =========================================================================
# Figure 10: Tier-Stratified Model × Prompt Accuracy Heatmap Matrix (2x2)
# =========================================================================
def plot_fig10_tier_heatmaps():
    tier_configs = [
        ('tier1_iconic', '(a) Tier 1: Iconic Landmarks (N = 10 / cell)', 0, 0),
        ('tier2_longtail', '(b) Tier 2: Regional / Long-Tail (N = 10 / cell)', 0, 1),
        ('tier3_nature', '(c) Tier 3: Nature & Landscapes (N = 10 / cell)', 1, 0),
        ('tier4_ugc', '(d) Tier 4: Casual UGC / Uncurated (N = 10 / cell)', 1, 1),
    ]
    
    model_order = [
        'Gemini 3.8 Flash',
        'Claude Sonnet 5',
        'GPT-5.4',
        'GPT-5.4 Mini',
        'Qwen 2.5 VL 72B',
        'Llama 4 Maverick'
    ]
    prompt_order = ['P1', 'P2', 'P3', 'P4', 'P5']
    prompt_tick_labels = ['P1\n(Zero-Shot)', 'P2\n(Persona)', 'P3\n(CoT)', 'P4\n(Thai)', 'P5\n(Few-Shot)']
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    cbar_ax = fig.add_axes([0.92, 0.15, 0.02, 0.7])
    
    for tier_key, tier_title, r, c in tier_configs:
        ax = axes[r, c]
        sub_df = df[df['Tier'] == tier_key]
        pivot = sub_df.pivot_table(
            index='Model_Label',
            columns='Prompt Variant ID',
            values='is_correct_bool',
            aggfunc=lambda x: np.mean(x) * 100
        ).reindex(index=model_order, columns=prompt_order)
        
        is_first = (r == 0 and c == 0)
        sns.heatmap(
            pivot,
            annot=True,
            fmt='.1f',
            cmap='YlGnBu',
            vmin=0,
            vmax=100,
            linewidths=1.2,
            linecolor='white',
            cbar=is_first,
            cbar_ax=cbar_ax if is_first else None,
            cbar_kws={'label': 'Top-1 Accuracy (%)'} if is_first else None,
            annot_kws={'fontsize': 10, 'fontweight': 'bold'},
            ax=ax
        )
        ax.set_title(tier_title, pad=12, fontweight='bold', fontsize=12)
        ax.set_xticklabels(prompt_tick_labels, rotation=0, fontsize=9.5)
        ax.set_yticklabels(model_order, rotation=0, fontsize=9.5)
        if c == 0:
            ax.set_ylabel('Vision-Language Model', fontweight='bold', fontsize=10.5)
        else:
            ax.set_ylabel('')
        if r == 1:
            ax.set_xlabel('Prompt Paradigm', fontweight='bold', fontsize=10.5)
        else:
            ax.set_xlabel('')
            
    fig.suptitle('Exp 4: Tier-Stratified Cross-Paradigm Accuracy Heatmap Matrix\n(Dissecting Prompt Sensitivity & Ceiling Effects Across Visual Difficulty Tiers)',
                 fontsize=14, fontweight='bold', y=0.98)
    fig.subplots_adjust(right=0.90, hspace=0.32, wspace=0.28, top=0.90, bottom=0.08, left=0.12)
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig10_tier_stratified_heatmaps.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig10_tier_stratified_heatmaps.pdf"))
    plt.close()
    print("Saved Fig 10: Tier-Stratified Accuracy Heatmap Matrix")


# =========================================================================
# Figure 11: Prompt Sensitivity Delta Matrix (ΔAccuracy vs. P1 Baseline)
# =========================================================================
def plot_fig11_prompt_delta():
    model_order = [
        'Gemini 3.8 Flash',
        'Claude Sonnet 5',
        'GPT-5.4',
        'GPT-5.4 Mini',
        'Qwen 2.5 VL 72B',
        'Llama 4 Maverick'
    ]
    prompt_variants = ['P2', 'P3', 'P4', 'P5']
    prompt_labels = ['P2: Persona', 'P3: CoT', 'P4: Thai', 'P5: Few-Shot']
    
    # Subplot (a): Overall Delta
    pivot_all = df.pivot_table(
        index='Model_Label',
        columns='Prompt Variant ID',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(model_order)
    
    deltas_all = pd.DataFrame(index=model_order)
    for p in prompt_variants:
        deltas_all[p] = pivot_all[p] - pivot_all['P1']
        
    # Subplot (b): Tier 4 (UGC) Delta where prompt sensitivity is strongest
    pivot_ugc = df[df['Tier'] == 'tier4_ugc'].pivot_table(
        index='Model_Label',
        columns='Prompt Variant ID',
        values='is_correct_bool',
        aggfunc=lambda x: np.mean(x) * 100
    ).reindex(model_order)
    
    deltas_ugc = pd.DataFrame(index=model_order)
    for p in prompt_variants:
        deltas_ugc[p] = pivot_ugc[p] - pivot_ugc['P1']
        
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.2))
    
    sns.heatmap(
        deltas_all,
        annot=True,
        fmt='+.1f',
        cmap='vlag',
        center=0,
        vmin=-15,
        vmax=15,
        linewidths=1,
        linecolor='white',
        cbar_kws={'label': 'Δ Accuracy (% points)'},
        ax=ax1
    )
    ax1.set_title('(a) Overall Prompt Sensitivity Delta (All Tiers vs. P1)', fontweight='bold', pad=12)
    ax1.set_xlabel('Prompt Paradigm (vs. P1 Baseline)', fontweight='bold', labelpad=8)
    ax1.set_ylabel('Vision-Language Model', fontweight='bold', labelpad=8)
    ax1.set_xticklabels(prompt_labels, rotation=15, ha='right')
    
    sns.heatmap(
        deltas_ugc,
        annot=True,
        fmt='+.1f',
        cmap='vlag',
        center=0,
        vmin=-30,
        vmax=30,
        linewidths=1,
        linecolor='white',
        cbar_kws={'label': 'Δ Accuracy (% points)'},
        ax=ax2
    )
    ax2.set_title('(b) UGC Domain Prompt Sensitivity Delta (Tier 4 vs. P1)', fontweight='bold', pad=12)
    ax2.set_xlabel('Prompt Paradigm (vs. P1 Baseline)', fontweight='bold', labelpad=8)
    ax2.set_ylabel('', labelpad=8)
    ax2.set_xticklabels(prompt_labels, rotation=15, ha='right')
    
    fig.suptitle('Exp 4: Prompt Sensitivity Delta Matrix\n(Net Top-1 Accuracy Gain/Loss Relative to P1 Zero-Shot Baseline)',
                 fontsize=13.5, fontweight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.92])
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig11_prompt_sensitivity_delta.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig11_prompt_sensitivity_delta.pdf"))
    plt.close()
    print("Saved Fig 11: Prompt Sensitivity Delta Matrix")


# =========================================================================
# Figure 12: Epistemic Confidence Calibration & Overconfidence Analysis
# =========================================================================
def plot_fig12_calibration_box():
    model_order = [
        'Gemini 3.8 Flash',
        'Claude Sonnet 5',
        'GPT-5.4',
        'GPT-5.4 Mini',
        'Qwen 2.5 VL 72B',
        'Llama 4 Maverick'
    ]
    df_box = df.copy()
    df_box['Outcome'] = df_box['is_correct_bool'].map({True: 'Correct Prediction', False: 'Incorrect (Error / Hallucination)'})
    
    fig, ax = plt.subplots(figsize=(11, 5.5))
    palette = {'Correct Prediction': '#10b981', 'Incorrect (Error / Hallucination)': '#ef4444'}
    
    sns.boxplot(
        data=df_box,
        x='Model_Label',
        y='Confidence',
        hue='Outcome',
        order=model_order,
        palette=palette,
        ax=ax,
        showmeans=True,
        meanprops={'marker': 'o', 'markerfacecolor': 'white', 'markeredgecolor': 'black', 'markersize': 6}
    )
    
    ax.set_title('Exp 4: Model Epistemic Confidence Calibration\n(Detecting Overconfident Hallucinations vs. Well-Calibrated Uncertainty)', pad=15, fontweight='bold')
    ax.set_ylabel('Model Reported Confidence Score (0.0 - 1.0)', labelpad=10, fontweight='bold')
    ax.set_xlabel('Vision-Language Model', labelpad=10, fontweight='bold')
    ax.set_ylim(-0.05, 1.05)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(title='Prediction Outcome', loc='lower left', frameon=True, framealpha=0.92, edgecolor='#cbd5e1')
    plt.xticks(rotation=15, ha='right')
    plt.tight_layout()
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig12_confidence_calibration.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig12_confidence_calibration.pdf"))
    plt.close()
    print("Saved Fig 12: Confidence Calibration & Overconfidence Analysis")


# =========================================================================
# Figure 13: Cross-Lingual Evaluation (English P1 vs. Native Thai P4)
# =========================================================================
def plot_fig13_crosslingual_tradeoff():
    model_order = [
        'Gemini 3.8 Flash',
        'Claude Sonnet 5',
        'GPT-5.4',
        'GPT-5.4 Mini',
        'Qwen 2.5 VL 72B',
        'Llama 4 Maverick'
    ]
    p1 = df[df['Prompt Variant ID'] == 'P1'].groupby('Model_Label').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat=('Time MS', 'mean'),
        p_tok=('Prompt Tokens', 'mean'),
        c_tok=('Completion Tokens', 'mean')
    ).reindex(model_order)
    
    p4 = df[df['Prompt Variant ID'] == 'P4'].groupby('Model_Label').agg(
        acc=('is_correct_bool', lambda x: np.mean(x) * 100),
        lat=('Time MS', 'mean'),
        p_tok=('Prompt Tokens', 'mean'),
        c_tok=('Completion Tokens', 'mean')
    ).reindex(model_order)
    
    comp = pd.DataFrame({
        'Model': model_order,
        'delta_acc': (p4['acc'] - p1['acc']).values,
        'lat_inflation_pct': (((p4['lat'] - p1['lat']) / p1['lat']) * 100).values,
        'tok_inflation_pct': (((p4['p_tok'] - p1['p_tok']) / p1['p_tok']) * 100).values
    })
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12.5, 5.2))
    
    # Subplot (a): Accuracy Delta
    colors_acc = ['#10b981' if x >= 0 else '#ef4444' for x in comp['delta_acc']]
    bars1 = ax1.barh(comp['Model'], comp['delta_acc'], color=colors_acc, edgecolor='black', linewidth=0.6)
    ax1.axvline(0, color='gray', linestyle='--', alpha=0.7)
    for bar in bars1:
        val = bar.get_width()
        offset = 0.3 if val >= 0 else -1.4
        ax1.text(val + offset, bar.get_y() + bar.get_height() / 2, f'{val:+.1f}%', va='center', fontweight='bold', fontsize=9.2)
        
    ax1.set_title('(a) Cross-Lingual Accuracy Impact (P4 Thai vs. P1 English)', fontweight='bold', pad=12)
    ax1.set_xlabel('Δ Top-1 Accuracy (% points)', fontweight='bold', labelpad=8)
    ax1.set_xlim(-9.5, 4.5)
    ax1.grid(axis='x', linestyle='--', alpha=0.5)
    
    # Subplot (b): Overhead (Latency and Tokens)
    x = np.arange(len(comp))
    width = 0.38
    ax2.bar(x - width / 2, comp['lat_inflation_pct'], width, label='Inference Latency Overhead (%)', color='#f59e0b', edgecolor='black', linewidth=0.6)
    ax2.bar(x + width / 2, comp['tok_inflation_pct'], width, label='Prompt Token Overhead (%)', color='#6366f1', edgecolor='black', linewidth=0.6)
    ax2.set_xticks(x)
    ax2.set_xticklabels(comp['Model'], rotation=25, ha='right', fontweight='bold', fontsize=9)
    ax2.set_title('(b) Computational & Latency Overhead in Native Thai', fontweight='bold', pad=12)
    ax2.set_ylabel('Overhead vs. English Baseline (%)', fontweight='bold', labelpad=8)
    ax2.grid(axis='y', linestyle='--', alpha=0.5)
    ax2.legend(frameon=True, framealpha=0.92, edgecolor='#cbd5e1')
    
    fig.suptitle('Exp 4: Cross-Lingual Sensitivity & Computational Overhead\n(Assessing Performance Shifts & Latency Penalties for Localized Thai Queries)',
                 fontsize=13.5, fontweight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.92])
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig13_crosslingual_tradeoff.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig13_crosslingual_tradeoff.pdf"))
    plt.close()
    print("Saved Fig 13: Cross-Lingual Evaluation Trade-Off")


# =========================================================================
# Figure 14: Prompt Invariance Chord Diagram & Model Consistency Spectrum
# =========================================================================
def plot_fig14_prompt_invariance_chord():
    prompt_ids = ['P1', 'P2', 'P3', 'P4', 'P5']
    prompt_names = {
        'P1': 'P1: Zero-Shot',
        'P2': 'P2: Persona',
        'P3': 'P3: CoT Reasoning',
        'P4': 'P4: Native Thai',
        'P5': 'P5: Few-Shot (3-Ex)'
    }
    
    pivot_preds = df.pivot_table(
        index=['Model_Label', 'Image Name'],
        columns='Prompt Variant ID',
        values='is_correct_bool',
        aggfunc='first'
    ).dropna()
    
    # Pairwise Jaccard Index
    jaccard_matrix = np.zeros((5, 5))
    for i, p1 in enumerate(prompt_ids):
        for j, p2 in enumerate(prompt_ids):
            if i == j:
                jaccard_matrix[i, j] = 1.0
            else:
                s1 = set(pivot_preds[pivot_preds[p1] == True].index)
                s2 = set(pivot_preds[pivot_preds[p2] == True].index)
                jacc = len(s1.intersection(s2)) / len(s1.union(s2))
                jaccard_matrix[i, j] = jacc

    model_list = [
        'Gemini 3.8 Flash',
        'Claude Sonnet 5',
        'GPT-5.4',
        'GPT-5.4 Mini',
        'Qwen 2.5 VL 72B',
        'Llama 4 Maverick'
    ]
    
    spectrum_data = []
    for m in model_list:
        sub = pivot_preds.loc[m]
        correct_counts = sub.sum(axis=1) # 0 to 5
        robust_succ = np.mean(correct_counts == 5) * 100
        robust_fail = np.mean(correct_counts == 0) * 100
        fragile = np.mean((correct_counts > 0) & (correct_counts < 5)) * 100
        spectrum_data.append({
            'Model': m,
            'Robust Success (5/5)': robust_succ,
            'Prompt-Fragile (1-4/5)': fragile,
            'Robust Failure (0/5)': robust_fail
        })
    df_spec = pd.DataFrame(spectrum_data)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15.8, 6.8), gridspec_kw={'width_ratios': [1.1, 1.2], 'wspace': 0.38})
    fig.patch.set_facecolor('white')
    
    # --- PANEL 1: Circular Chord Diagram ---
    ax1.set_aspect('equal')
    ax1.set_xlim(-1.42, 1.42)
    ax1.set_ylim(-1.42, 1.42)
    ax1.axis('off')
    ax1.set_title('(a) Inter-Prompt Concordance Network\n(Pairwise Jaccard Index on Target Recognition, N = 240 pairs)',
                  fontweight='bold', fontsize=10.8, pad=12)
    
    angles = np.linspace(np.pi/2, np.pi/2 - 2*np.pi, 6)[:-1]
    R = 0.88
    node_coords = {p: (R * np.cos(a), R * np.sin(a)) for p, a in zip(prompt_ids, angles)}
    node_colors = ['#2563eb', '#8b5cf6', '#dc2626', '#d97706', '#059669']
    
    min_jacc = 0.90
    max_jacc = 0.95
    
    for i in range(5):
        for j in range(i + 1, 5):
            p1, p2 = prompt_ids[i], prompt_ids[j]
            j_val = jaccard_matrix[i, j]
            norm_val = np.clip((j_val - min_jacc) / (max_jacc - min_jacc), 0, 1)
            
            x1, y1 = node_coords[p1]
            x2, y2 = node_coords[p2]
            
            verts = [(x1, y1), (0.0, 0.0), (x2, y2)]
            codes = [Path.MOVETO, Path.CURVE3, Path.CURVE3]
            path = Path(verts, codes)
            
            lw = 2.0 + norm_val * 6.5
            alpha = 0.35 + norm_val * 0.45
            
            patch = patches.PathPatch(path, facecolor='none', edgecolor='#475569',
                                      linewidth=lw, alpha=alpha, capstyle='round')
            ax1.add_patch(patch)
            
            mid_x = (x1 + x2) * 0.32
            mid_y = (y1 + y2) * 0.32
            ax1.text(mid_x, mid_y, f'J={j_val*100:.1f}%', fontsize=7.2, ha='center', va='center',
                     color='#0f172a', fontweight='bold',
                     bbox=dict(boxstyle='round,pad=0.18', facecolor='white', edgecolor='#cbd5e1', alpha=0.94, lw=0.6))
            
    for idx, p in enumerate(prompt_ids):
        x, y = node_coords[p]
        circle = patches.Circle((x, y), 0.12, facecolor=node_colors[idx], edgecolor='white', linewidth=2.2, zorder=5)
        ax1.add_patch(circle)
        ax1.text(x, y, p, color='white', fontweight='bold', fontsize=9.8, ha='center', va='center', zorder=6)
        
        offset_dist = 0.28
        ang = angles[idx]
        tx = (R + offset_dist) * np.cos(ang)
        ty = (R + offset_dist) * np.sin(ang)
        ha = 'center'
        if np.cos(ang) > 0.3:
            ha = 'left'
        elif np.cos(ang) < -0.3:
            ha = 'right'
        ax1.text(tx, ty, prompt_names[p], fontweight='bold', fontsize=8.8, color='#0f172a', ha=ha, va='center')

    ax1.text(0, -1.35, "Ribbon width indicates pairwise Jaccard consistency between prompt paradigms",
             fontsize=8.0, style='italic', color='#64748b', ha='center')

    # --- PANEL 2: Model Invariance Spectrum Stacked Bar ---
    ax2.set_title('(b) Model Prompt Sensitivity Spectrum\n(Prediction Stability Under 5 Alternative Prompt Paradigms)',
                  fontweight='bold', fontsize=10.8, pad=12)
    
    y_pos = np.arange(len(model_list))
    bars_succ = ax2.barh(y_pos, df_spec['Robust Success (5/5)'], height=0.55,
                         label='Robust Success (5/5 Correct)', color='#10b981', edgecolor='black', linewidth=0.6)
    bars_frag = ax2.barh(y_pos, df_spec['Prompt-Fragile (1-4/5)'], left=df_spec['Robust Success (5/5)'], height=0.55,
                         label='Prompt-Fragile / Flip (1–4/5)', color='#f59e0b', edgecolor='black', linewidth=0.6)
    bars_fail = ax2.barh(y_pos, df_spec['Robust Failure (0/5)'],
                         left=df_spec['Robust Success (5/5)'] + df_spec['Prompt-Fragile (1-4/5)'], height=0.55,
                         label='Robust Failure (0/5 Correct)', color='#ef4444', edgecolor='black', linewidth=0.6)
    
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(df_spec['Model'], fontweight='bold', fontsize=9.5)
    ax2.set_xlabel('Proportion of Test Benchmark Images (%)', fontweight='bold', fontsize=10, labelpad=8)
    ax2.set_xlim(0, 102)
    ax2.grid(axis='x', linestyle='--', alpha=0.5)
    ax2.invert_yaxis()
    
    for idx in range(len(df_spec)):
        s_val = df_spec.loc[idx, 'Robust Success (5/5)']
        f_val = df_spec.loc[idx, 'Prompt-Fragile (1-4/5)']
        fl_val = df_spec.loc[idx, 'Robust Failure (0/5)']
        
        if s_val > 8:
            ax2.text(s_val / 2, idx, f'{s_val:.1f}%', va='center', ha='center', color='white', fontweight='bold', fontsize=8.6)
        if f_val > 6:
            ax2.text(s_val + f_val / 2, idx, f'{f_val:.1f}%', va='center', ha='center', color='white', fontweight='bold', fontsize=8.6)
        if fl_val > 6:
            ax2.text(s_val + f_val + fl_val / 2, idx, f'{fl_val:.1f}%', va='center', ha='center', color='white', fontweight='bold', fontsize=8.6)
            
    ax2.legend(loc='lower center', bbox_to_anchor=(0.5, -0.22), ncol=3, frameon=True, framealpha=0.95, edgecolor='#cbd5e1', fontsize=8.5)
    
    fig.suptitle('Exp 4: Cross-Prompt Invariance Analysis & Algorithmic Sensitivity\n(Concordance Network & Model Fragility Spectrum Across 5 Prompt Paradigms)',
                 fontsize=12.5, fontweight='bold', y=0.965)
    
    plt.subplots_adjust(top=0.76, bottom=0.15, left=0.06, right=0.96)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig14_prompt_invariance_chord.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig14_prompt_invariance_chord.pdf"))
    plt.close()
    print("Saved Fig 14: Prompt Invariance Chord Diagram")


# =========================================================================
# Figure 15: Qualitative Case Vignettes (Card-Based Layout)
# =========================================================================
def plot_fig15_qualitative_vignettes():
    fig, axes = plt.subplots(3, 1, figsize=(15.8, 14.2))
    fig.patch.set_facecolor('#f8fafc')
    
    cases = [
        {
            'title': 'Case A: Tier 3 Nature — Hup Pa Tat Sinkhole Cave (Uthai Thani, Thailand)',
            'img_meta': 'Image: images08.jpg | Ground Truth: Hup Pa Tat | Domain: Karst Sinkhole & Endemic Flora | Gemini: 5/5 (100%) vs. All Others: 0/5 (0%)',
            'ambiguity': 'Key Visual Nuance: Enclosed limestone karst sinkhole valley; dense canopy of ancient Arenga westerhoutii (Tad) palms; wooden boardwalk walkway.',
            'models': [
                ('Gemini 3.8 Flash', 'Hup Pa Tat Cave', True, 'Enclosed karst sinkhole valley; dense canopy of ancient Arenga westerhoutii (Tad) palms; sheer cliff walls.'),
                ('Claude Sonnet 5', 'Batu Caves (Malaysia)', False, 'Limestone karst cliff formation; tropical rainforest vegetation with palm trees; cave-like rock structure.'),
                ('GPT-5.4', 'Undetermined tropical cave', False, 'Dense tropical rainforest with palms; no distinctive signage or unique architecture; abstains from specific name.'),
                ('GPT-5.4 Mini', 'Maya Cave (Koh Phi Phi)', False, 'Tropical cave/forest; massive limestone cliff walls with dense jungle, characteristic of Railay area.'),
                ('Qwen 2.5 VL 72B', 'Gunung Mulu Nat. Park (MY)', False, 'Large limestone cliffs surrounded by dense tropical vegetation match features typical of Gunung Mulu.'),
                ('Llama 4 Maverick', 'Phraya Nakhon Cave (TH)', False, 'Large rock formation with hole allowing sunlight to enter, surrounded by lush greenery and sandy path.')
            ],
            'takeaway': 'Scientific Insight: Fine-grained endemic botanical grounding. Only Gemini identifies Arenga westerhoutii (Tad palms) endemic to Uthai Thani; all competitors suffer from geographic substitution into overseas or generic tropical caves.'
        },
        {
            'title': 'Case B: Tier 3 Nature — Haew Narok Waterfall (Khao Yai National Park, Thailand)',
            'img_meta': 'Image: images13.jpg | Ground Truth: Haew Narok Waterfall | Domain: Hydrological Landscape | Gemini: 5/5 (100%) vs. All Others: 0/5 (0%)',
            'ambiguity': 'Key Visual Nuance: Three-tier vertical ravine plunge into dark chasm; sheer reddish-brown rock face; complete lack of human-made infrastructure.',
            'models': [
                ('Gemini 3.8 Flash', 'Haew Narok Waterfall', True, 'Tall vertical waterfall plunging into deep ravine pool; sheer reddish-brown rock cliff faces; dense canopy.'),
                ('Claude Sonnet 5', 'Waterfall (unidentified)', False, 'Tall narrow waterfall cascading over rocky cliff; dense green vegetation; dark plunge pool; lacks markers.'),
                ('GPT-5.4', 'Unknown waterfall', False, 'Single-drop waterfall plunging into dark plunge pool; sheer rocky cliff face; no unique signage or architecture.'),
                ('GPT-5.4 Mini', 'Unknown waterfall', False, 'Tall narrow waterfall dropping over rocky cliff; no distinctive signage, buildings, or uniquely identifying landmarks.'),
                ('Qwen 2.5 VL 72B', 'Kanger Ghati Nat. Park (IN)', False, 'Waterfall distinctive shape and surrounding dense greenery match features typical of Kanger Ghati Park.'),
                ('Llama 4 Maverick', 'Mutawintji Falls (AU)', False, 'Rocky cliff face; waterfall cascading into pool surrounded by lush greenery; distinct landscape and water flow.')
            ],
            'takeaway': 'Scientific Insight: Natural hydrological ambiguity boundary. Commercial frontier models (Claude, GPT-5.4) appropriately abstain due to lack of man-made anchors, while open-weights models hallucinate distant continents (India, Australia).'
        },
        {
            'title': 'Case C: Tier 4 Casual UGC — 57th Street – 7th Avenue Subway Station (MTA, New York City)',
            'img_meta': 'Image: 11.jpg | Ground Truth: 57th St – 7th Ave | Domain: Casual Crowdsourced Photo | Prompt Shift: Reasoning Drift & Naive OCR Trap',
            'ambiguity': 'Key Visual Nuance: Angled smartphone photo of subway mezzanine; overhead exit sign reads \'55 Street & 7 Ave\', while platform column tiles display \'57\'.',
            'models': [
                ('Gemini 3.8 Flash (P1–P5)', '57th Street–7th Ave', True, 'Contextual fusion: exit sign reads \'55 St\' but platform column signage clearly verifies station stop \'57\'.'),
                ('Claude Sonnet 5 (P1–P5)', '57th Street & 7th Ave', True, 'Directional sign indicates 55 St exit, but column marker \'57\' correctly disambiguates station identity.'),
                ('GPT-5.4 (P1–P5)', '57 Street–7 Ave', True, 'Overhead sign reads \'55 St\' but multiple platform columns marked \'57\' conclusively match NYC Subway 57 St.'),
                ('GPT-5.4 Mini (CoT Drift)', '57 St (P1) → 145th St (P3)', False, 'Prompt Fragility: P1/P2 correct, but Chain-of-Thought (P3) overthinks and drifts into 145th Street–Lenox Ave!'),
                ('Qwen 2.5 VL (Naive OCR)', '55th Street & 7th Ave', False, 'Superficial OCR: Blindly transcribed overhead exit sign \'55 St\' and fabricated a non-existent station name.'),
                ('Llama 4 (Naive OCR)', '55 Street & 7 Ave', False, 'Superficial OCR: Read \'55 St\' header without verifying against New York City transit station geography.')
            ],
            'takeaway': 'Scientific Insight: Contextual multi-cue disambiguation vs. superficial OCR shortcuts. Exposes "Overthinking Drift" in lightweight models under Chain-of-Thought (P3 CoT) and naive visual reading in open-weights models.'
        }
    ]
    
    for idx, case in enumerate(cases):
        ax = axes[idx]
        ax.set_facecolor('white')
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 100)
        ax.axis('off')
        
        card = patches.FancyBboxPatch((0.8, 1.5), 98.4, 97.0, boxstyle='round,pad=0.8,rounding_size=2.5',
                                      facecolor='white', edgecolor='#cbd5e1', linewidth=1.2)
        ax.add_patch(card)
        
        banner_color = '#0284c7' if idx == 0 else ('#059669' if idx == 1 else '#7c3aed')
        banner = patches.FancyBboxPatch((0.8, 80.5), 98.4, 18.0, boxstyle='round,pad=0.2,rounding_size=2.5',
                                       facecolor=banner_color, edgecolor='none')
        ax.add_patch(banner)
        
        ax.text(2.2, 91.5, case['title'], color='white', fontweight='bold', fontsize=10.6, va='center')
        ax.text(2.2, 84.5, case['img_meta'], color='#f0fdf4' if idx == 1 else ('#e0f2fe' if idx == 0 else '#f5f3ff'),
                fontsize=8.4, va='center')
        
        ax.text(2.2, 75.5, case['ambiguity'], color='#334155', fontsize=8.3, style='italic', va='center')
        
        col_xs = [2.0, 34.6, 67.2]
        col_w = 30.8
        row_ys = [47.5, 20.0]
        row_h = 24.5
        
        for m_idx, (m_name, pred, is_c, reas) in enumerate(case['models']):
            cx = col_xs[m_idx % 3]
            cy = row_ys[m_idx // 3]
            
            sub_bg = '#f0fdf4' if is_c else '#fff1f2'
            sub_edge = '#86efac' if is_c else '#fca5a5'
            sub_card = patches.FancyBboxPatch((cx, cy), col_w, row_h, boxstyle='round,pad=0.3,rounding_size=1.8',
                                             facecolor=sub_bg, edgecolor=sub_edge, linewidth=0.9)
            ax.add_patch(sub_card)
            
            symbol = '✓' if is_c else '✗'
            badge_color = '#15803d' if is_c else '#b91c1c'
            
            # Header
            ax.text(cx + 1.2, cy + row_h - 2.5, f'{symbol} {m_name}',
                    fontweight='bold', color=badge_color, fontsize=8.3, va='top')
            
            # Prediction
            wrapped_pred = textwrap.fill(pred, width=27)
            ax.text(cx + 1.2, cy + row_h - 7.5, f'Pred: {wrapped_pred}',
                    fontweight='bold', color='#0f172a', fontsize=7.8, va='top')
            
            # Reasoning
            wrapped_reas = textwrap.fill(f'"{reas}"', width=34)
            ax.text(cx + 1.2, cy + row_h - 13.8, wrapped_reas,
                    color='#475569', fontsize=6.7, style='italic', va='top')
            
        t_box = patches.FancyBboxPatch((1.5, 3.0), 97.0, 13.5, boxstyle='round,pad=0.3,rounding_size=1.5',
                                       facecolor='#f8fafc', edgecolor='#e2e8f0', linewidth=0.8)
        ax.add_patch(t_box)
        wrapped_takeaway = textwrap.fill(case['takeaway'], width=148)
        ax.text(3.0, 9.8, wrapped_takeaway, color='#0f172a', fontweight='bold', fontsize=8.0, va='center')
    
    fig.suptitle('Exp 4: Qualitative Case Vignettes — Dissecting High-Disagreement Edge Cases\n(Fine-Grained Flora Grounding, Hydrological Ambiguity, and Prompt-Induced Reasoning Drift)',
                 fontsize=13.0, fontweight='bold', y=0.988)
    plt.tight_layout(rect=[0, 0, 1, 0.965])
    
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig15_qualitative_case_vignettes.png"), dpi=300)
    fig.savefig(os.path.join(OUTPUT_DIR, "exp4_fig15_qualitative_case_vignettes.pdf"))
    plt.close()
    print("Saved Fig 15: Qualitative Case Vignettes")


# =========================================================================
# Main Execution: Generate All 15 Publication Figures
# =========================================================================
if __name__ == '__main__':
    print("================================================================================")
    print("Generating Academic Publication Figures for Experiment 4 (Pixinerary Research)")
    print("================================================================================")
    plot_fig0_grouped_bar()
    plot_fig1_heatmap()
    plot_fig2_pareto()
    plot_fig3_tier_breakdown()
    plot_fig4_latency_cost()
    plot_fig5_model_pareto()
    plot_fig6_radar()
    plot_fig7_prompt_elasticity()
    plot_fig8_failure_taxonomy()
    plot_fig9_cot_efficiency()
    plot_fig10_tier_heatmaps()
    plot_fig11_prompt_delta()
    plot_fig12_calibration_box()
    plot_fig13_crosslingual_tradeoff()
    plot_fig14_prompt_invariance_chord()
    plot_fig15_qualitative_vignettes()
    print(f"\n[SUCCESS] All 15 figures successfully exported to:\n  {os.path.abspath(OUTPUT_DIR)}")
    print("================================================================================")


