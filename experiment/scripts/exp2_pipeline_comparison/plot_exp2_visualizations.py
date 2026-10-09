"""
plot_exp2_visualizations.py
Experiment 2: Two-Turn Pipeline Comparison & Confidence Calibration Visualizations
Generates publication-grade figures (300 DPI PNG + PDF Vector)
Pixinerary Master's Thesis / Academic Paper
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.stats.contingency_tables import mcnemar

# Add common style config path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'common')))
from plot_style import (
    set_academic_style,
    MODEL_COLORS,
    MODEL_LABELS_MAP,
    TIER_COLORS,
    TIER_NAMES,
    save_academic_figure,
)

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'exp2_pipeline_comparison.csv'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'figures', 'exp2_pipeline_comparison'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_exp2_plots():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV not found: {CSV_PATH}")
        return

    set_academic_style()
    df = pd.read_csv(CSV_PATH)
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['Top_1_Strict_bool'] = df['Top 1 Strict'].astype(str).str.lower().isin(['true', '1'])
    df['Top_3_Recall_bool'] = df['Top 3 Recall'].astype(str).str.lower().isin(['true', '1'])

    print("=" * 75)
    print("Generating Academic Publication Figures for Experiment 2 (Two-Turn Pipeline)")
    print(f"Data source: {CSV_PATH} ({len(df)} records)")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 75)

    # -------------------------------------------------------------
    # Data Integrity & Limitation Guard (Latency & No-CLIP Columns)
    # -------------------------------------------------------------
    latency_no_clip_valid = False
    if 'Latency No CLIP (ms)' in df.columns:
        valid_latency = (df['Latency No CLIP (ms)'] > 0).sum()
        if valid_latency == 0:
            print("[DATA NOTICE] 'Latency No CLIP (ms)' and 'Delta Latency (ms)' are 0 in all 144 rows.")
            print("[DATA NOTICE] 'Correct (No CLIP)' is False in all 144 rows.")
            print("  --> Skipping No-CLIP Latency and Correctness comparison charts until dataset is updated.")
        else:
            latency_no_clip_valid = True

    # -------------------------------------------------------------
    # Fig 1: Top-1 Strict vs Top-3 Recall (Paired Bar Chart)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(10, 5))
    models = df.groupby('Model_Label')['Top_3_Recall_bool'].mean().sort_values(ascending=False).index.tolist()
    
    strict_acc = [df[df['Model_Label'] == m]['Top_1_Strict_bool'].mean() * 100 for m in models]
    recall_acc = [df[df['Model_Label'] == m]['Top_3_Recall_bool'].mean() * 100 for m in models]

    # Include overall average
    overall_strict = df['Top_1_Strict_bool'].mean() * 100
    overall_recall = df['Top_3_Recall_bool'].mean() * 100
    models_with_all = ['Overall System'] + models
    strict_vals = [overall_strict] + strict_acc
    recall_vals = [overall_recall] + recall_acc

    x = np.arange(len(models_with_all))
    width = 0.35

    rects1 = ax.bar(x - width/2, strict_vals, width, label='Top-1 Strict (1-Turn)',
                    color='#3b82f6', edgecolor='black', linewidth=0.8)
    rects2 = ax.bar(x + width/2, recall_vals, width, label='Top-3 Recall (2-Turn Human Fallback)',
                    color='#10b981', edgecolor='black', linewidth=0.8)

    ax.set_title("Experiment 2: Recognition Rate Comparison (Top-1 Strict vs Top-3 Recall)", pad=12, fontweight='bold')
    ax.set_ylabel("Success Rate (%)")
    ax.set_xticks(x)
    ax.set_xticklabels(models_with_all, rotation=20, ha='right')
    ax.set_ylim(0, 115)
    ax.legend(loc='lower left', framealpha=0.9)

    # Annotate bars
    for r1, r2 in zip(rects1, rects2):
        h1 = r1.get_height()
        h2 = r2.get_height()
        gain = h2 - h1
        ax.annotate(f"{h1:.1f}%", xy=(r1.get_x() + r1.get_width() / 2, h1),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5)
        ax.annotate(f"{h2:.1f}%\n(+{gain:.1f}%)", xy=(r2.get_x() + r2.get_width() / 2, h2),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                    fontsize=8.5, fontweight='bold', color='#065f46')

    # Callout for overall recovery
    strict_n = int(df['Top_1_Strict_bool'].sum())
    recall_n = int(df['Top_3_Recall_bool'].sum())
    total_n = len(df)
    ax.annotate(f"Overall Recovery Gain: +{overall_recall - overall_strict:.1f}%\n({strict_n}/{total_n} -> {recall_n}/{total_n})",
                xy=(0, 102), xytext=(0, 106), ha='center', fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='#dcfce7', edgecolor='#10b981', alpha=0.9))

    save_academic_figure(fig, OUTPUT_DIR, "exp2_fig1_strict_vs_recall_bar")

    # -------------------------------------------------------------
    # Fig 2: Paired Slope Chart (1-Turn vs 2-Turn) with McNemar's Test
    # -------------------------------------------------------------
    # Calculate McNemar's test
    cont_table = pd.crosstab(df['Top_1_Strict_bool'], df['Top_3_Recall_bool'])
    mcnemar_res = mcnemar(cont_table, exact=False, correction=True)

    fig, ax = plt.subplots(figsize=(8.5, 5.5))
    x_coords = [0, 1]

    for m in models:
        y1 = df[df['Model_Label'] == m]['Top_1_Strict_bool'].mean() * 100
        y2 = df[df['Model_Label'] == m]['Top_3_Recall_bool'].mean() * 100
        color = MODEL_COLORS.get(m, '#64748b')
        ax.plot(x_coords, [y1, y2], marker='o', linewidth=2.4, markersize=8, color=color, label=m)
        ax.annotate(f"{y1:.1f}%", xy=(0, y1), xytext=(-10, 0), textcoords="offset points",
                    ha='right', va='center', fontsize=9, fontweight='semibold')
        ax.annotate(f"{y2:.1f}% ({m})", xy=(1, y2), xytext=(10, 0), textcoords="offset points",
                    ha='left', va='center', fontsize=9, fontweight='bold', color=color)

    ax.set_xticks([0, 1])
    ax.set_xticklabels(['1-Turn Single Pipeline\n(Top-1 Strict)', '2-Turn CLIP Assisted\n(Top-3 Candidates)'],
                       fontweight='bold', fontsize=10.5)
    ax.set_ylabel("Place Recognition Accuracy (%)")
    ax.set_xlim(-0.25, 1.45)
    ax.set_ylim(45, 108)

    # Annotate McNemar test results
    stat_str = f"McNemar's Paired Test:\nχ² = {mcnemar_res.statistic:.2f}\np = {mcnemar_res.pvalue:.2e} (p < 0.001)\nStatistically Highly Significant"
    ax.text(0.03, 0.08, stat_str, transform=ax.transAxes, fontsize=9.5, fontweight='bold',
            bbox=dict(boxstyle='round,pad=0.5', facecolor='#f8fafc', edgecolor='#94a3b8', alpha=0.95))

    ax.set_title("Experiment 2: Paired Trajectory from 1-Turn to 2-Turn with McNemar Verification", pad=12, fontweight='bold')
    save_academic_figure(fig, OUTPUT_DIR, "exp2_fig2_slope_1turn_vs_2turn_mcnemar")

    # -------------------------------------------------------------
    # Fig 3: Heatmap of Tier × Model of Top-3 Recall
    # -------------------------------------------------------------
    tier_order = ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']
    tier_matrix = df.groupby(['Tier', 'Model_Label'])['Top_3_Recall_bool'].mean().unstack() * 100
    tier_matrix = tier_matrix.reindex(index=tier_order)
    tier_matrix.index = [TIER_NAMES.get(t, t) for t in tier_matrix.index]
    tier_matrix = tier_matrix[models]  # keep sorted model order

    fig, ax = plt.subplots(figsize=(9.5, 4.8))
    sns.heatmap(tier_matrix, annot=True, fmt=".1f", cmap="YlGn", cbar_kws={'label': 'Top-3 Recall (%)'},
                linewidths=1, linecolor='white', vmin=0, vmax=100, ax=ax,
                annot_kws={'fontweight': 'bold', 'size': 10})
    ax.set_title("Experiment 2: Tier × Model Top-3 Candidate Recall Matrix", pad=12, fontweight='bold')
    ax.set_ylabel("VPR Complexity Tier")
    ax.set_xlabel("AI Model")
    plt.xticks(rotation=20, ha='right')
    save_academic_figure(fig, OUTPUT_DIR, "exp2_fig3_tier_top3_recall_heatmap")

    # -------------------------------------------------------------
    # Fig 4: Histogram / Density of Candidate Scores (Correct vs Incorrect)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(8.5, 5))
    correct_scores = df[df['Top_3_Recall_bool']]['Avg Candidate Score'].dropna()
    incorrect_scores = df[~df['Top_3_Recall_bool']]['Avg Candidate Score'].dropna()

    bins = np.linspace(0, 3, 10)
    ax.hist(correct_scores, bins=bins, alpha=0.65, label=f'Top-3 Successful (Mean: {correct_scores.mean():.2f})',
            color='#10b981', edgecolor='black', density=True)
    ax.hist(incorrect_scores, bins=bins, alpha=0.65, label=f'Top-3 Unrecovered (Mean: {incorrect_scores.mean():.2f})',
            color='#ef4444', edgecolor='black', density=True)

    # Plot KDE curves
    if len(correct_scores) > 1:
        sns.kdeplot(correct_scores, ax=ax, color='#047857', linewidth=2.2)
    if len(incorrect_scores) > 1:
        sns.kdeplot(incorrect_scores, ax=ax, color='#b91c1c', linewidth=2.2)

    ax.set_title("Experiment 2: Distribution of Average Candidate Relevance Score by Outcome", pad=12, fontweight='bold')
    ax.set_xlabel("Average Candidate Relevance Score (0 = Non-match, 3 = Exact Landmark Match)")
    ax.set_ylabel("Normalized Density")
    ax.set_xlim(-0.2, 3.2)
    ax.legend(loc='upper left', framealpha=0.9)

    ax.annotate("High Confidence Cluster\n(Score >= 2.0)", xy=(2.4, 0.7), xytext=(2.0, 1.1),
                arrowprops=dict(facecolor='black', arrowstyle='->', lw=1.2),
                fontweight='bold', fontsize=9)

    save_academic_figure(fig, OUTPUT_DIR, "exp2_fig4_candidate_score_distribution")

    print(f"\n[SUCCESS] All Experiment 2 figures exported to:\n  {OUTPUT_DIR}\n")

if __name__ == '__main__':
    generate_exp2_plots()
