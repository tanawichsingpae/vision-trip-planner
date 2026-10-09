"""
plot_cross_experiment_summary.py
Cross-Experiment Synthesis & Multi-Dimensional Benchmark Visualizations
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

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTPUT_DIR = os.path.abspath(os.path.join(BASE_DIR, 'figures', 'cross_experiment_summary'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_cross_summary_plots():
    set_academic_style()
    print("=" * 75)
    print("Generating Academic Cross-Experiment Synthesis Visualizations")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 75)

    # -------------------------------------------------------------
    # Fig 1: Comprehensive Model Benchmark Ranking Matrix (All Exp 1-5)
    # -------------------------------------------------------------
    # Load and aggregate data from all experiments
    # Exp 1: Baseline Acc, Latency, Cost
    f1 = os.path.join(BASE_DIR, 'exp1_model_benchmark.csv')
    df1 = pd.read_csv(f1)
    df1['is_correct_bool'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df1['Model_Label'] = df1['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    exp1_stats = df1.groupby('Model_Label').agg(
        Exp1_Accuracy=('is_correct_bool', lambda x: x.mean() * 100),
        Cost_Per_1k=('Cost USD', lambda x: x.mean() * 1000.0),
        Mean_Latency_Sec=('Time MS', lambda x: (x / 1000.0).mean())
    )

    # Exp 2: Top-3 Candidate Recall
    f2 = os.path.join(BASE_DIR, 'exp2_pipeline_comparison.csv')
    df2 = pd.read_csv(f2)
    df2['Model_Label'] = df2['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df2['Top_3_Recall_bool'] = df2['Top 3 Recall'].astype(str).str.lower().isin(['true', '1'])
    exp2_stats = df2.groupby('Model_Label')['Top_3_Recall_bool'].mean() * 100
    exp2_stats.name = 'Exp2_Top3_Recall'

    # Exp 3: Stress Condition Retention Rate
    f3 = os.path.join(BASE_DIR, 'exp3_robustness.csv')
    df3 = pd.read_csv(f3)
    df3['Model_Label'] = df3['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df3['is_correct_bool'] = df3['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    exp3_stats = df3.groupby('Model_Label')['is_correct_bool'].mean() * 100
    exp3_stats.name = 'Exp3_Robustness'

    # Exp 4: Prompt Stability (Average across all 5 Prompts)
    f4 = os.path.join(BASE_DIR, 'exp4_prompt_sensitivity.csv')
    df4 = pd.read_csv(f4)
    df4['Model_Label'] = df4['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df4['is_correct_bool'] = df4['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    exp4_stats = df4.groupby('Model_Label')['is_correct_bool'].mean() * 100
    exp4_stats.name = 'Exp4_Prompt_Mean'

    # Exp 5: Strict Consistency Rate at T=0.1
    f5 = os.path.join(BASE_DIR, 'exp5_consistency.csv')
    df5 = pd.read_csv(f5)
    df5['Model_Label'] = df5['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df5_t01 = df5[df5['Temperature'] == 0.1]
    def calc_strict(group):
        return len(set(group['Predicted Place'].tolist())) == 1
    exp5_stats = df5_t01.groupby(['Model_Label', 'Image Name', 'Ground Truth']).apply(
        calc_strict, include_groups=False
    ).groupby('Model_Label').mean() * 100
    exp5_stats.name = 'Exp5_Consistency'

    # Combine all dimensions into a master summary dataframe
    summary_df = pd.concat([exp1_stats, exp2_stats, exp3_stats, exp4_stats, exp5_stats], axis=1)
    summary_df = summary_df.sort_values('Exp1_Accuracy', ascending=False)

    # Rename columns for clear publication presentation
    col_labels = {
        'Exp1_Accuracy': 'Exp 1: Baseline Acc (%)',
        'Exp2_Top3_Recall': 'Exp 2: Fallback Top-3 (%)',
        'Exp3_Robustness': 'Exp 3: Robustness Acc (%)',
        'Exp4_Prompt_Mean': 'Exp 4: Prompt Stability (%)',
        'Exp5_Consistency': 'Exp 5: Consistency @ T=0.1 (%)',
        'Cost_Per_1k': 'Cost ($/1k Queries)',
        'Mean_Latency_Sec': 'Mean Latency (Sec)'
    }
    summary_display = summary_df.rename(columns=col_labels)

    # Normalization (0 - 100 Scale) for heatmap coloring
    norm_df = pd.DataFrame(index=summary_display.index)
    for col in summary_display.columns:
        vals = summary_display[col]
        if 'Cost' in col or 'Latency' in col:
            # Lower is better (inverted normalization)
            norm_df[col] = (vals.max() - vals) / (vals.max() - vals.min() + 1e-9) * 100
        else:
            # Higher is better
            norm_df[col] = (vals - vals.min()) / (vals.max() - vals.min() + 1e-9) * 100

    fig, ax = plt.subplots(figsize=(13.5, 6.0))
    # Create formatted text annotations: show raw actual metric in each cell
    annot_matrix = summary_display.copy()
    for col in annot_matrix.columns:
        if 'Cost' in col:
            annot_matrix[col] = annot_matrix[col].apply(lambda v: f"${v:.2f}")
        elif 'Latency' in col:
            annot_matrix[col] = annot_matrix[col].apply(lambda v: f"{v:.2f}s")
        else:
            annot_matrix[col] = annot_matrix[col].apply(lambda v: f"{v:.1f}%")

    sns.heatmap(norm_df, annot=annot_matrix.values, fmt="", cmap="YlGnBu",
                cbar_kws={'label': 'Normalized Performance Benchmark Score (0 - 100 Scale)'},
                linewidths=1.2, linecolor='white', vmin=0, vmax=100, ax=ax,
                annot_kws={'fontweight': 'bold', 'size': 10})

    ax.set_title("Synthesis: Cross-Experiment Model Performance & Operational Ranking Matrix\n(Exp 1 Baseline, Exp 2 Human Fallback, Exp 3 Stress, Exp 4 Prompts, Exp 5 Determinism, Cost & Latency)",
                 pad=14, fontweight='bold', fontsize=12)
    ax.set_xlabel("Core Evaluation Dimensions Across Experiments", fontweight='bold', labelpad=8)
    ax.set_ylabel("Evaluated AI Model (Ranked by Baseline Accuracy)", fontweight='bold', labelpad=8)
    plt.xticks(rotation=20, ha='right', fontweight='semibold')
    plt.yticks(fontweight='semibold')
    save_academic_figure(fig, OUTPUT_DIR, "summary_fig1_model_ranking_matrix")

    # -------------------------------------------------------------
    # Fig 2: Total Time MS vs Generation Time MS by Provider
    # -------------------------------------------------------------
    dfs_lat = []
    for f_name in ['exp1_model_benchmark.csv', 'exp2_pipeline_comparison.csv', 'exp3_robustness.csv', 'exp4_prompt_sensitivity.csv', 'exp5_consistency.csv']:
        p = os.path.join(BASE_DIR, f_name)
        if os.path.exists(p):
            sub = pd.read_csv(p)
            needed = ['Time MS', 'Generation Time MS', 'Provider Name', 'Model']
            valid_cols = [c for c in needed if c in sub.columns]
            if 'Time MS' in valid_cols and 'Generation Time MS' in valid_cols and 'Provider Name' in valid_cols:
                # Crucial condition: Skip rows where Generation Time is null/empty or <= 0
                sub_clean = sub[valid_cols].dropna(subset=['Time MS', 'Generation Time MS']).copy()
                sub_clean = sub_clean[sub_clean['Generation Time MS'] > 0]
                dfs_lat.append(sub_clean)

    comb_lat = pd.concat(dfs_lat, ignore_index=True)
    # Convert to seconds for intuitive visualization
    comb_lat['Time_Sec'] = comb_lat['Time MS'] / 1000.0
    comb_lat['Gen_Time_Sec'] = comb_lat['Generation Time MS'] / 1000.0

    # Group rare providers (< 15 records) to 'Other Providers'
    prov_counts = comb_lat['Provider Name'].value_counts()
    main_providers = prov_counts[prov_counts >= 20].index.tolist()
    comb_lat['Provider_Group'] = comb_lat['Provider Name'].apply(lambda x: x if x in main_providers else 'Other Providers')

    fig, ax = plt.subplots(figsize=(9.5, 6))
    provider_palette = {
        'OpenAI': '#10b981',
        'Parasail': '#3b82f6',
        'Google': '#0284c7',
        'Claude Platform on AWS': '#8b5cf6',
        'DigitalOcean': '#f59e0b',
        'Novita': '#ef4444',
        'Other Providers': '#94a3b8'
    }

    # Plot scatter points
    for prov in comb_lat['Provider_Group'].unique():
        sub = comb_lat[comb_lat['Provider_Group'] == prov]
        col = provider_palette.get(prov, '#64748b')
        ax.scatter(sub['Gen_Time_Sec'], sub['Time_Sec'], color=col, alpha=0.55,
                   s=28, edgecolors='none', label=f"{prov} (N={len(sub)})")

    # Add diagonal y = x identity line
    max_val = min(max(comb_lat['Gen_Time_Sec'].quantile(0.99), comb_lat['Time_Sec'].quantile(0.99)) * 1.08, 45.0)
    ax.plot([0, max_val], [0, max_val], 'k--', linewidth=1.5, label='Inference Only Line (y = x, 0ms Network Delay)')

    # Shaded Network Overhead Area
    ax.fill_between([0, max_val], [0, max_val], [max_val, max_val], color='#64748b', alpha=0.06)
    ax.text(max_val * 0.25, max_val * 0.82, "Network Gateway & Transmission Overhead Area\n(Time MS > Generation Time MS)",
            fontsize=9, fontstyle='italic', color='#475569', bbox=dict(boxstyle='round,pad=0.3', facecolor='#f1f5f9', alpha=0.8))

    ax.set_title("Synthesis: End-to-End Latency vs. Pure Model Generation Time by Cloud Provider\n(Cross-Experiment Aggregation: N = 3,052 Valid Request Traces)",
                 pad=12, fontweight='bold', fontsize=12)
    ax.set_xlabel("Model Inference Time: Generation Time (Seconds)")
    ax.set_ylabel("Total End-to-End Latency: Time MS (Seconds)")
    ax.set_xlim(0, max_val)
    ax.set_ylim(0, max_val)
    ax.legend(loc='lower right', framealpha=0.92, fontsize=8.5)

    save_academic_figure(fig, OUTPUT_DIR, "summary_fig2_total_vs_generation_latency_scatter")

    print(f"\n[SUCCESS] Cross-Experiment Summary figures exported to:\n  {OUTPUT_DIR}\n")

if __name__ == '__main__':
    generate_cross_summary_plots()
