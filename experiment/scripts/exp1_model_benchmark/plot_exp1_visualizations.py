"""
plot_exp1_visualizations.py
Experiment 1: Pure Model Benchmark Visualizations
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
    TIER_COLORS,
    TIER_NAMES,
    save_academic_figure,
)

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'exp1_model_benchmark.csv'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'figures', 'exp1_model_benchmark'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_exp1_plots():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV not found: {CSV_PATH}")
        return

    set_academic_style()
    df = pd.read_csv(CSV_PATH)
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))
    df['Time_Sec'] = df['Time MS'] / 1000.0

    print("=" * 75)
    print("Generating Academic Publication Figures for Experiment 1 (Model Benchmark)")
    print(f"Data source: {CSV_PATH} ({len(df)} records)")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 75)

    # -------------------------------------------------------------
    # Fig 1: Overall Top-1 Place Recognition Accuracy across AI Models
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    acc_summary = df.groupby('Model_Label')['is_correct_bool'].mean() * 100
    acc_summary = acc_summary.sort_values(ascending=False)

    colors = [MODEL_COLORS.get(m, '#64748b') for m in acc_summary.index]
    bars = ax.bar(acc_summary.index, acc_summary.values, color=colors, width=0.55, edgecolor='black', linewidth=0.8)

    ax.set_title("Experiment 1: Overall Top-1 Place Recognition Accuracy by Model", pad=12, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)")
    ax.set_ylim(0, 108)
    ax.axhline(80, color='#059669', linestyle='--', linewidth=1.2, label='Target Benchmark (80%)')

    for bar in bars:
        h = bar.get_height()
        ax.annotate(f"{h:.1f}%", xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                    fontweight='bold', fontsize=9.5)

    ax.legend(loc='lower left')
    plt.xticks(rotation=15, ha='right')
    save_academic_figure(fig, OUTPUT_DIR, "exp1_fig1_model_accuracy_overall")

    # -------------------------------------------------------------
    # Fig 1b: Grouped Bar Chart of Accuracy per Model by Tier
    # -------------------------------------------------------------
    tier_order = ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']
    tier_grouped = df.groupby(['Model_Label', 'Tier'])['is_correct_bool'].mean().unstack() * 100
    tier_grouped = tier_grouped.reindex(index=acc_summary.index, columns=tier_order)

    fig, ax = plt.subplots(figsize=(11, 5.2))
    n_models = len(acc_summary)
    n_tiers = len(tier_order)
    bar_width = 0.18
    indices = np.arange(n_models)

    for i, t in enumerate(tier_order):
        vals = tier_grouped[t].values
        t_label = TIER_NAMES.get(t, t)
        t_color = TIER_COLORS.get(t, '#64748b')
        offset = (i - (n_tiers - 1) / 2) * bar_width
        ax.bar(indices + offset, vals, width=bar_width, label=t_label, color=t_color,
               edgecolor='black', linewidth=0.7)

    ax.set_title("Experiment 1: Stratified Accuracy across 4 VPR Complexity Tiers by Model", pad=12, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)")
    ax.set_xticks(indices)
    ax.set_xticklabels(acc_summary.index, rotation=15, ha='right')
    ax.set_ylim(0, 110)
    ax.axhline(80, color='#64748b', linestyle=':', linewidth=1.0)
    ax.legend(title="Complexity Tier", loc='lower left', framealpha=0.9)
    save_academic_figure(fig, OUTPUT_DIR, "exp1_fig1b_model_accuracy_grouped_tier")

    # -------------------------------------------------------------
    # Fig 2: 4-Tier Stratified Accuracy Matrix Heatmap (With Cell Values)
    # -------------------------------------------------------------
    tier_matrix = df.groupby(['Model_Label', 'Tier'])['is_correct_bool'].mean().unstack() * 100
    tier_matrix = tier_matrix.reindex(columns=tier_order)
    tier_matrix.columns = [TIER_NAMES[c] for c in tier_matrix.columns]
    tier_matrix = tier_matrix.reindex(acc_summary.index)

    fig, ax = plt.subplots(figsize=(9.5, 4.8))
    sns.heatmap(tier_matrix, annot=True, fmt=".1f", cmap="YlGnBu", cbar_kws={'label': 'Accuracy (%)'},
                linewidths=1, linecolor='white', vmin=40, vmax=100, ax=ax, annot_kws={'fontweight': 'bold', 'size': 10})
    ax.set_title("Experiment 1: Model × Tier Accuracy Matrix (Stratified Performance)", pad=12, fontweight='bold')
    ax.set_xlabel("VPR Complexity Tier")
    ax.set_ylabel("Evaluated AI Model")
    plt.xticks(rotation=20, ha='right')
    save_academic_figure(fig, OUTPUT_DIR, "exp1_fig2_tier_accuracy_matrix")

    # -------------------------------------------------------------
    # Fig 3: Stacked Bar Chart of Failure Modes per Model
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(9, 5))
    df_err = df[~df['is_correct_bool']].copy()
    failure_counts = pd.crosstab(df_err['Model_Label'], df_err['Failure Mode'])
    failure_counts = failure_counts.reindex(acc_summary.index).fillna(0)

    # Standard palette for failure modes
    fail_colors = {
        'visual_confusion': '#ef4444',        # Red
        'degradation_rejection': '#f59e0b',   # Amber
        'hallucination': '#8b5cf6'           # Purple
    }

    bottom = np.zeros(len(failure_counts))
    for col in ['visual_confusion', 'degradation_rejection', 'hallucination']:
        if col in failure_counts.columns:
            vals = failure_counts[col].values
            label_text = col.replace('_', ' ').title()
            if col == 'visual_confusion':
                label_text += " (94/98 Errors = 95.9%)"
            ax.bar(failure_counts.index, vals, bottom=bottom, label=label_text,
                   color=fail_colors.get(col, '#94a3b8'), edgecolor='black', linewidth=0.8, width=0.55)
            bottom += vals

    # Annotate total errors on top of stacked bars
    for idx, (m, total_err) in enumerate(zip(failure_counts.index, bottom)):
        if total_err > 0:
            ax.annotate(f"{int(total_err)} errors", xy=(idx, total_err),
                        xytext=(0, 4), textcoords="offset points", ha='center', va='bottom',
                        fontweight='bold', fontsize=9)

    ax.set_title("Experiment 1: Taxonomy of Failure Modes across Models (N = 98 Total Errors)", pad=12, fontweight='bold')
    ax.set_ylabel("Number of Error Instances")
    ax.set_ylim(0, max(bottom) * 1.18)
    ax.legend(title="Failure Category", loc='upper left')
    plt.xticks(rotation=15, ha='right')
    save_academic_figure(fig, OUTPUT_DIR, "exp1_fig3_failure_mode_stacked")

    # -------------------------------------------------------------
    # Fig 4: Scatter Plot: Accuracy vs. Cost USD (Pareto Frontier)
    # -------------------------------------------------------------
    if 'Cost USD' in df.columns:
        fig, ax = plt.subplots(figsize=(8.5, 5))
        cost_df = df.groupby('Model_Label').agg({
            'Cost USD': lambda x: x.mean() * 1000.0,  # cost per 1,000 queries
            'is_correct_bool': lambda x: x.mean() * 100
        }).sort_values('is_correct_bool', ascending=False)

        for m_label, r in cost_df.iterrows():
            col = MODEL_COLORS.get(m_label, '#64748b')
            ax.scatter(r['Cost USD'], r['is_correct_bool'], s=220, color=col,
                       edgecolors='black', linewidth=1.2, zorder=5)
            # Offset annotations
            offset_y = 1.2 if 'Gemini' in m_label or 'Claude' in m_label else -2.2
            offset_x = 0.05
            ax.annotate(f"{m_label}\n(${r['Cost USD']:.2f}, {r['is_correct_bool']:.1f}%)",
                        xy=(r['Cost USD'], r['is_correct_bool']),
                        xytext=(8, -2), textcoords='offset points',
                        fontsize=9.5, fontweight='bold')

        ax.set_title("Experiment 1: Cost-Effectiveness Frontier (Accuracy vs Cost per 1,000 Queries)", pad=12, fontweight='bold')
        ax.set_xlabel("Estimated Cost per 1,000 Queries (USD)")
        ax.set_ylabel("Top-1 Accuracy (%)")
        ax.set_ylim(70, 103)
        save_academic_figure(fig, OUTPUT_DIR, "exp1_fig4_cost_effectiveness")

    # -------------------------------------------------------------
    # Fig 5: Dual Box Plot: Latency (Log Scale) + Pure Tokens Per Sec by Provider
    # -------------------------------------------------------------
    if 'Provider Name' in df.columns and 'Pure Tokens Per Sec' in df.columns:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))

        # Filter out providers with very few records for clean boxplot or sort by count
        top_providers = df['Provider Name'].value_counts()
        valid_providers = top_providers[top_providers >= 5].index.tolist()
        df_prov = df[df['Provider Name'].isin(valid_providers)].copy()

        # Sort providers by median latency
        prov_order = df_prov.groupby('Provider Name')['Time MS'].median().sort_values().index.tolist()

        sns.boxplot(data=df_prov, x='Provider Name', y='Time MS', order=prov_order,
                    palette='Blues_r', ax=ax1, width=0.55, fliersize=3)
        ax1.set_yscale('log')
        ax1.set_title("Total Latency by Provider (Log Scale)", pad=10, fontweight='bold')
        ax1.set_xlabel("Cloud / Inference Provider")
        ax1.set_ylabel("Latency (Time MS - Log Scale)")
        ax1.tick_params(axis='x', rotation=25)

        # Subplot 2: Pure Tokens Per Sec
        tokens_order = df_prov.groupby('Provider Name')['Pure Tokens Per Sec'].median().sort_values(ascending=False).index.tolist()
        sns.boxplot(data=df_prov, x='Provider Name', y='Pure Tokens Per Sec', order=tokens_order,
                    palette='Greens_r', ax=ax2, width=0.55, fliersize=3)
        ax2.set_title("Generation Throughput (Pure Tokens / Sec)", pad=10, fontweight='bold')
        ax2.set_xlabel("Cloud / Inference Provider")
        ax2.set_ylabel("Tokens / Second")
        ax2.tick_params(axis='x', rotation=25)

        fig.suptitle("Experiment 1: Provider Latency Distribution & Generation Throughput", fontsize=13, fontweight='bold', y=1.02)
        save_academic_figure(fig, OUTPUT_DIR, "exp1_fig5_latency_tokens_by_provider")

    # -------------------------------------------------------------
    # Fig 6: Calibration Reliability Diagram (Confidence vs. Actual Accuracy)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(8, 5.5))
    df_cal = df[['Confidence', 'is_correct_bool']].dropna().copy()
    
    # 5 confidence bins: [0.5, 0.6), [0.6, 0.7), ..., [0.9, 1.0]
    bins = [0.0, 0.6, 0.75, 0.85, 0.95, 1.01]
    bin_labels = ['<0.60', '0.60-0.75', '0.75-0.85', '0.85-0.95', '0.95-1.00']
    df_cal['bin'] = pd.cut(df_cal['Confidence'], bins=bins, labels=bin_labels, right=False)

    cal_stats = df_cal.groupby('bin', observed=False).agg(
        mean_conf=('Confidence', 'mean'),
        empirical_acc=('is_correct_bool', 'mean'),
        count=('is_correct_bool', 'count')
    ).reset_index()

    # Calculate ECE (Expected Calibration Error)
    total_n = len(df_cal)
    ece = (np.abs(cal_stats['empirical_acc'] - cal_stats['mean_conf']) * (cal_stats['count'] / total_n)).sum() * 100

    # Plot empirical calibration curve
    ax.plot([0, 1], [0, 1], 'k--', linewidth=1.5, label='Perfect Calibration (y = x)')
    ax.plot(cal_stats['mean_conf'], cal_stats['empirical_acc'], marker='o', color='#2563eb',
            linewidth=2.2, markersize=8, label=f'VLM Empirical Reliability (ECE = {ece:.2f}%)')

    # Shaded overconfidence gap
    ax.fill_between(cal_stats['mean_conf'], cal_stats['empirical_acc'], cal_stats['mean_conf'],
                    where=(cal_stats['mean_conf'] > cal_stats['empirical_acc']),
                    color='#ef4444', alpha=0.18, label='Overconfidence Gap (Confidence > Accuracy)')

    for _, r in cal_stats.iterrows():
        if pd.notna(r['mean_conf']) and pd.notna(r['empirical_acc']):
            ax.annotate(f"N={int(r['count'])}\nAcc={r['empirical_acc']*100:.1f}%\nConf={r['mean_conf']*100:.1f}%",
                        xy=(r['mean_conf'], r['empirical_acc']),
                        xytext=(10, -15), textcoords='offset points', fontsize=8.5)

    ax.set_title("Experiment 1: Model Confidence Calibration (Reliability Diagram)", pad=12, fontweight='bold')
    ax.set_xlabel("Mean Self-Reported Confidence")
    ax.set_ylabel("Observed Empirical Accuracy")
    ax.set_xlim(0.45, 1.02)
    ax.set_ylim(0.40, 1.05)
    ax.legend(loc='upper left', framealpha=0.9)
    save_academic_figure(fig, OUTPUT_DIR, "exp1_fig6_confidence_calibration")

    print(f"\n[SUCCESS] All Experiment 1 figures exported to:\n  {OUTPUT_DIR}\n")

if __name__ == '__main__':
    generate_exp1_plots()
