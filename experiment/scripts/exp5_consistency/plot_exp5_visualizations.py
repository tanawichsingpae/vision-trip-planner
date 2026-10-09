"""
plot_exp5_visualizations.py
Experiment 5: Operational Consistency & Multi-Run Determinism Visualizations
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

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'exp5_consistency.csv'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'figures', 'exp5_consistency'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def compute_fleiss_kappa(ratings_df):
    """
    Computes Fleiss' Kappa for inter-rater agreement across N subjects and n runs.
    ratings_df has rows = subjects, columns = raters (runs).
    """
    subjects = ratings_df.index
    raters = ratings_df.columns
    n = len(raters)
    N = len(subjects)
    
    categories = sorted(list(set(ratings_df.values.flatten())))
    k = len(categories)
    if k <= 1:
        return 1.0
        
    counts = np.zeros((N, k))
    cat_to_idx = {c: idx for idx, c in enumerate(categories)}
    for i, sub in enumerate(subjects):
        for val in ratings_df.loc[sub].values:
            counts[i, cat_to_idx[val]] += 1
            
    P_i = (np.sum(counts**2, axis=1) - n) / (n * (n - 1))
    P_mean = np.mean(P_i)
    
    p_j = np.sum(counts, axis=0) / (N * n)
    P_e = np.sum(p_j**2)
    
    if 1.0 - P_e == 0:
        return 1.0
    return (P_mean - P_e) / (1.0 - P_e)

def generate_exp5_plots():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV not found: {CSV_PATH}")
        return

    set_academic_style()
    df = pd.read_csv(CSV_PATH)
    df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    df['Model_Label'] = df['Model'].map(lambda x: MODEL_LABELS_MAP.get(x, x))

    print("=" * 75)
    print("Generating Academic Publication Figures for Experiment 5 (Consistency & Stability)")
    print(f"Data source: {CSV_PATH} ({len(df)} records)")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 75)

    models_order = ['Gemini 3.8 Flash', 'Claude Sonnet 5', 'GPT-5.4', 'GPT-5.4 Mini', 'Qwen 2.5 VL 72B', 'Llama 4 Maverick']
    existing_models = [m for m in models_order if m in df['Model_Label'].unique()]

    # -------------------------------------------------------------
    # Fig 1: Accuracy per Temperature by Model (Grouped Bar Chart)
    # -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(10, 5))
    acc_piv = df.pivot_table(index='Model_Label', columns='Temperature', values='is_correct_bool', aggfunc='mean') * 100
    acc_piv = acc_piv.reindex(existing_models)

    x = np.arange(len(existing_models))
    width = 0.35

    rects1 = ax.bar(x - width/2, acc_piv[0.1].values, width, label='Temperature = 0.1 (Controlled Low Jitter)',
                    color='#0284c7', edgecolor='black', linewidth=0.8)
    rects2 = ax.bar(x + width/2, acc_piv[0.7].values, width, label='Temperature = 0.7 (High Sampling Entropy)',
                    color='#f59e0b', edgecolor='black', linewidth=0.8)

    ax.set_title("Experiment 5: Top-1 Accuracy under Controlled vs Stochastic Temperature", pad=12, fontweight='bold')
    ax.set_ylabel("Top-1 Accuracy (%)")
    ax.set_xticks(x)
    ax.set_xticklabels(existing_models, rotation=15, ha='right', fontweight='semibold')
    ax.set_ylim(0, 115)
    ax.legend(loc='lower left', framealpha=0.9)

    for r1, r2 in zip(rects1, rects2):
        h1 = r1.get_height()
        h2 = r2.get_height()
        ax.annotate(f"{h1:.1f}%", xy=(r1.get_x() + r1.get_width() / 2, h1),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5)
        ax.annotate(f"{h2:.1f}%", xy=(r2.get_x() + r2.get_width() / 2, h2),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5)

    save_academic_figure(fig, OUTPUT_DIR, "exp5_fig1_temp_accuracy_bar")

    # -------------------------------------------------------------
    # Fig 2: Consistency Rate (Strict Answer Invariance across 5 Runs)
    # -------------------------------------------------------------
    # Consistency rate: proportion of images where all 5 runs give the exact same answer
    def get_strict_consistency(group):
        preds = group['Predicted Place'].tolist()
        return len(set(preds)) == 1

    # Unique evaluation instances: (Temperature, Model, Image Name, Ground Truth)
    consist_series = df.groupby(['Temperature', 'Model_Label', 'Image Name', 'Ground Truth']).apply(
        get_strict_consistency, include_groups=False
    ).groupby(['Temperature', 'Model_Label']).mean() * 100

    consist_piv = consist_series.unstack(level='Temperature').reindex(existing_models)

    fig, ax = plt.subplots(figsize=(10, 5))
    rects1 = ax.bar(x - width/2, consist_piv[0.1].values, width, label='Temperature = 0.1 (Strict 5-Run Agreement)',
                    color='#059669', edgecolor='black', linewidth=0.8)
    rects2 = ax.bar(x + width/2, consist_piv[0.7].values, width, label='Temperature = 0.7 (Strict 5-Run Agreement)',
                    color='#ef4444', edgecolor='black', linewidth=0.8)

    ax.set_title("Experiment 5: Strict Consistency Rate (100% Deterministic Agreement across 5 Runs)", pad=12, fontweight='bold')
    ax.set_ylabel("Consistency Rate (%)")
    ax.set_xticks(x)
    ax.set_xticklabels(existing_models, rotation=15, ha='right', fontweight='semibold')
    ax.set_ylim(0, 115)
    ax.legend(loc='lower left', framealpha=0.9)

    for r1, r2 in zip(rects1, rects2):
        h1 = r1.get_height()
        h2 = r2.get_height()
        drop = h2 - h1
        ax.annotate(f"{h1:.1f}%", xy=(r1.get_x() + r1.get_width() / 2, h1),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5)
        ax.annotate(f"{h2:.1f}%\n({drop:+.1f}%)", xy=(r2.get_x() + r2.get_width() / 2, h2),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom',
                    fontsize=8.5, fontweight='bold', color='#991b1b')

    # Discussion footnote
    ax.text(0.99, 0.02, "Sample Scope: 12 Representative Benchmark Scenes × 5 Runs = 60 Inferences per Model/Temp Condition",
            transform=ax.transAxes, ha='right', va='bottom', fontsize=8, fontstyle='italic', color='#64748b')

    save_academic_figure(fig, OUTPUT_DIR, "exp5_fig2_consistency_rate_bar")

    # -------------------------------------------------------------
    # Fig 3: Faceted Heatmap: Image × Run (Run 1–5) Outcome by Model
    # -------------------------------------------------------------
    # We display a 2x3 grid of subplots (one for each model at Temp 0.1)
    fig, axes = plt.subplots(2, 3, figsize=(15, 8.5), sharex=True, sharey=True)
    axes = axes.flatten()

    df_t01 = df[df['Temperature'] == 0.1].copy()
    # Create unified scene index (1 to 12)
    scene_keys = df_t01[['Image Name', 'Ground Truth']].drop_duplicates().reset_index(drop=True)
    scene_keys['Scene_ID'] = [f"Scene {i+1}" for i in range(len(scene_keys))]
    df_t01 = df_t01.merge(scene_keys, on=['Image Name', 'Ground Truth'])

    for idx, m in enumerate(existing_models):
        ax_m = axes[idx]
        sub = df_t01[df_t01['Model_Label'] == m]
        grid = sub.pivot_table(index='Scene_ID', columns='Run Number', values='is_correct_bool', aggfunc='first')
        grid = grid.reindex(index=[f"Scene {i+1}" for i in range(len(scene_keys))], columns=[1, 2, 3, 4, 5]).fillna(False).astype(int)

        # 1 = Correct (Green #10b981), 0 = Incorrect (Red #ef4444)
        cmap = sns.color_palette(['#ef4444', '#10b981'])
        sns.heatmap(grid, cmap=cmap, cbar=False, linewidths=1, linecolor='white', ax=ax_m)
        ax_m.set_title(m, fontweight='bold', fontsize=11, color=MODEL_COLORS.get(m, '#1e293b'))
        ax_m.set_xlabel("Run Number" if idx >= 3 else "")
        ax_m.set_ylabel("Test Landmark Scene" if idx % 3 == 0 else "")

    # Add custom legend
    from matplotlib.patches import Patch
    legend_elements = [Patch(facecolor='#10b981', edgecolor='black', label='Correct Place Identification'),
                       Patch(facecolor='#ef4444', edgecolor='black', label='Error / Failure Mode')]
    fig.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, 0.99), ncol=2, framealpha=0.9)
    fig.suptitle("Experiment 5: Multi-Run Determinism Matrix (Image Scene × Run 1–5 at T=0.1)",
                 fontsize=13.5, fontweight='bold', y=1.02)
    fig.tight_layout()
    save_academic_figure(fig, OUTPUT_DIR, "exp5_fig3_image_run_heatmap")

    # -------------------------------------------------------------
    # Fig 4: Confidence Standard Deviation (Jitter) Box Plot
    # -------------------------------------------------------------
    conf_jitter = df.groupby(['Temperature', 'Model_Label', 'Image Name', 'Ground Truth'])['Confidence'].std().reset_index()
    conf_jitter['Temperature_Label'] = conf_jitter['Temperature'].map({0.1: 'T = 0.1', 0.7: 'T = 0.7'})

    fig, ax = plt.subplots(figsize=(9.5, 5))
    sns.boxplot(data=conf_jitter, x='Model_Label', y='Confidence', hue='Temperature_Label',
                order=existing_models, palette=['#0284c7', '#f59e0b'], width=0.55, ax=ax)

    ax.set_title("Experiment 5: Confidence Score Dispersion (Standard Deviation across 5 Runs)", pad=12, fontweight='bold')
    ax.set_ylabel("Confidence Standard Deviation (σ_conf)")
    ax.set_xlabel("AI Model")
    ax.set_ylim(-0.005, 0.12)
    plt.xticks(rotation=15, ha='right')
    ax.legend(title="Operating Temperature", loc='upper left')

    save_academic_figure(fig, OUTPUT_DIR, "exp5_fig4_confidence_std_boxplot")

    # -------------------------------------------------------------
    # Fig 5: Fleiss' Kappa Inter-Rater Reliability Score
    # -------------------------------------------------------------
    kappa_results = []
    for temp in [0.1, 0.7]:
        for m in existing_models:
            sub = df[(df['Temperature'] == temp) & (df['Model_Label'] == m)]
            # Pivot table: Subject (Scene) vs Run -> Predicted Place
            piv = sub.pivot_table(index=['Image Name', 'Ground Truth'], columns='Run Number', values='Predicted Place', aggfunc='first')
            k_val = compute_fleiss_kappa(piv)
            kappa_results.append({'Model_Label': m, 'Temperature': temp, 'Fleiss_Kappa': k_val})

    kappa_df = pd.DataFrame(kappa_results)
    kappa_piv = kappa_df.pivot(index='Model_Label', columns='Temperature', values='Fleiss_Kappa').reindex(existing_models)

    fig, ax = plt.subplots(figsize=(10, 5))
    rects1 = ax.bar(x - width/2, kappa_piv[0.1].values, width, label='Temperature = 0.1',
                    color='#6366f1', edgecolor='black', linewidth=0.8)
    rects2 = ax.bar(x + width/2, kappa_piv[0.7].values, width, label='Temperature = 0.7',
                    color='#a855f7', edgecolor='black', linewidth=0.8)

    ax.axhline(0.80, color='#059669', linestyle='--', linewidth=1.2, label='Almost Perfect Agreement (κ >= 0.80)')
    ax.axhline(0.60, color='#f59e0b', linestyle=':', linewidth=1.2, label='Substantial Agreement (κ >= 0.60)')

    ax.set_title("Experiment 5: Inter-Run Agreement Reliability (Fleiss' Kappa κ across 5 Runs)", pad=12, fontweight='bold')
    ax.set_ylabel("Fleiss' Kappa (κ)")
    ax.set_xticks(x)
    ax.set_xticklabels(existing_models, rotation=15, ha='right', fontweight='semibold')
    ax.set_ylim(0, 1.15)
    ax.legend(loc='lower left', framealpha=0.9)

    for r1, r2 in zip(rects1, rects2):
        h1 = r1.get_height()
        h2 = r2.get_height()
        ax.annotate(f"{h1:.2f}", xy=(r1.get_x() + r1.get_width() / 2, h1),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5, fontweight='bold')
        ax.annotate(f"{h2:.2f}", xy=(r2.get_x() + r2.get_width() / 2, h2),
                    xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8.5, fontweight='bold')

    save_academic_figure(fig, OUTPUT_DIR, "exp5_fig5_fleiss_kappa_reliability")

    print(f"\n[SUCCESS] All Experiment 5 figures exported to:\n  {OUTPUT_DIR}\n")

if __name__ == '__main__':
    generate_exp5_plots()
