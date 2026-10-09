"""
plot_exp3_visualizations.py
Experiment 3: Environmental Stress Test & Robustness Visualizations
Generates publication-grade figures (300 DPI PNG + PDF Vector)
Pixinerary Master's Thesis / Academic Paper
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Add common style config path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'common')))
from plot_style import (
    set_academic_style,
    MODEL_COLORS,
    MODEL_LABELS_MAP,
    save_academic_figure,
)

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'exp3_robustness.csv'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'figures', 'exp3_robustness'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_exp3_plots():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV not found: {CSV_PATH}")
        return

    set_academic_style()
    df = pd.read_csv(CSV_PATH)
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))

    print("=" * 75)
    print("Generating Academic Publication Figures for Experiment 3 (Environmental Robustness)")
    print(f"Data source: {CSV_PATH} ({len(df)} records)")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 75)

    condition_order = ['Baseline', 'Illumination', 'Atmospheric', 'Occlusion', 'Geometric']
    condition_colors = {
        'Baseline': '#2563eb',       # Primary Blue
        'Illumination': '#f59e0b',   # Amber
        'Atmospheric': '#06b6d4',    # Cyan
        'Occlusion': '#8b5cf6',      # Purple
        'Geometric': '#ef4444'       # Red (Strictest drop)
    }

    # -------------------------------------------------------------
    # Fig 1: Accuracy per Condition Bar Chart with Baseline Reference
    # -------------------------------------------------------------
    cond_acc = df.groupby('Condition Category')['is_correct_bool'].mean() * 100
    cond_acc = cond_acc.reindex(condition_order)

    fig, ax = plt.subplots(figsize=(8.5, 5))
    bars = ax.bar(cond_acc.index, cond_acc.values,
                  color=[condition_colors[c] for c in cond_acc.index],
                  width=0.55, edgecolor='black', linewidth=0.8)

    baseline_val = cond_acc['Baseline']
    ax.axhline(baseline_val, color='#1e3a8a', linestyle='--', linewidth=1.4,
               label=f'Baseline Reference ({baseline_val:.1f}%)')

    ax.set_title("Experiment 3: VPR Recognition Accuracy across Environmental Stress Conditions", pad=12, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)")
    ax.set_ylim(80, 105)
    ax.legend(loc='lower left', framealpha=0.9)

    for bar, c_name in zip(bars, cond_acc.index):
        h = bar.get_height()
        delta = h - baseline_val
        delta_str = f" ({delta:+.1f}%)" if c_name != 'Baseline' else " (Ref)"
        ax.annotate(f"{h:.1f}%{delta_str}", xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                    fontweight='bold', fontsize=9.5)

    save_academic_figure(fig, OUTPUT_DIR, "exp3_fig1_condition_accuracy_bar")

    # -------------------------------------------------------------
    # Fig 2: Heatmap of Accuracy Drop (Model × Condition Category)
    # -------------------------------------------------------------
    acc_matrix = df.groupby(['Model_Label', 'Condition Category'])['is_correct_bool'].mean().unstack() * 100
    acc_matrix = acc_matrix.reindex(columns=condition_order)

    # Calculate Drop relative to Baseline
    drop_matrix = pd.DataFrame(index=acc_matrix.index)
    stress_cols = ['Illumination', 'Atmospheric', 'Occlusion', 'Geometric']
    for c in stress_cols:
        drop_matrix[c] = acc_matrix[c] - acc_matrix['Baseline']

    # Sort models by baseline accuracy then by mean stress drop
    sorted_models = drop_matrix.mean(axis=1).sort_values(ascending=False).index.tolist()
    drop_matrix = drop_matrix.reindex(sorted_models)

    fig, ax = plt.subplots(figsize=(9, 4.8))
    sns.heatmap(drop_matrix, annot=True, fmt="+.1f", cmap="Reds_r", cbar_kws={'label': 'Accuracy Change (% Points)'},
                linewidths=1, linecolor='white', vmin=-25, vmax=0, ax=ax,
                annot_kws={'fontweight': 'bold', 'size': 10})

    ax.set_title("Experiment 3: Performance Drop from Baseline (Model × Stress Condition)", pad=12, fontweight='bold')
    ax.set_xlabel("Environmental Stress Condition")
    ax.set_ylabel("Evaluated AI Model")
    plt.xticks(rotation=20, ha='right')
    save_academic_figure(fig, OUTPUT_DIR, "exp3_fig2_model_condition_drop_heatmap")

    # -------------------------------------------------------------
    # Fig 3: Categorical Dot Plot of Failure Modes (N = 24 Errors)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(9.5, 5))
    df_err = df[~df['is_correct_bool']].copy()
    
    # We display dots for each error instance
    models_list = list(MODEL_COLORS.keys())
    model_y_map = {m: i for i, m in enumerate(models_list)}

    # Group counts of errors per (Condition, Model, Failure Mode)
    err_counts = df_err.groupby(['Condition Category', 'Model_Label', 'Failure Mode']).size().reset_index(name='count')

    markers = {'visual_confusion': 'o', 'degradation_rejection': 's'}
    colors = {'visual_confusion': '#ef4444', 'degradation_rejection': '#d97706'}
    labels = {'visual_confusion': 'Visual Confusion (17 cases)',
              'degradation_rejection': 'Degradation Rejection (7 cases)'}

    for f_mode in ['visual_confusion', 'degradation_rejection']:
        sub = err_counts[err_counts['Failure Mode'] == f_mode]
        x_vals = [condition_order.index(c) for c in sub['Condition Category']]
        y_vals = [model_y_map[m] for m in sub['Model_Label']]
        sizes = sub['count'] * 120  # scale dot size with count

        scatter = ax.scatter(x_vals, y_vals, s=sizes, color=colors[f_mode],
                             marker=markers[f_mode], edgecolors='black', linewidth=1.2,
                             alpha=0.85, label=labels[f_mode], zorder=4)

        # Annotate count inside/next to marker if count > 1
        for _, row in sub.iterrows():
            if row['count'] > 1:
                cx = condition_order.index(row['Condition Category'])
                cy = model_y_map[row['Model_Label']]
                ax.annotate(f"×{row['count']}", xy=(cx, cy), xytext=(8, -3),
                            textcoords="offset points", fontsize=8.5, fontweight='bold', color=colors[f_mode])

    ax.set_xticks(range(len(condition_order)))
    ax.set_xticklabels(condition_order, fontweight='bold')
    ax.set_yticks(range(len(models_list)))
    ax.set_yticklabels(models_list, fontweight='bold')
    ax.set_xlim(-0.5, len(condition_order) - 0.5)
    ax.set_ylim(-0.5, len(models_list) - 0.5)

    ax.grid(True, linestyle=':', alpha=0.6, zorder=1)
    ax.set_title("Experiment 3: Failure Mode Occurrence Map (N = 24 Total Errors out of 450 Runs)", pad=12, fontweight='bold')
    ax.set_xlabel("Stress Condition Category")
    ax.set_ylabel("Evaluated AI Model")
    ax.legend(loc='upper left', framealpha=0.9)

    save_academic_figure(fig, OUTPUT_DIR, "exp3_fig3_failure_mode_dotplot")

    print(f"\n[SUCCESS] All Experiment 3 figures exported to:\n  {OUTPUT_DIR}\n")

if __name__ == '__main__':
    generate_exp3_plots()
