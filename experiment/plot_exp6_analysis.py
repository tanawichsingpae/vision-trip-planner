"""
plot_exp6_analysis.py
================================================================================
Academic Evaluation & Visualization Script for Exp 6 (Plan Quality Evaluation)
Adapted from:
  1. Gao & Sun (2025) "Trustworthy Evaluation of Generative AI Models" (arXiv:2501.18897)
     - Relative score gap delta with 95% asymptotic/bootstrap confidence intervals
  2. Betzalel et al. (2024) "Evaluation Metrics for Generative Models: An Empirical Study" (MDPI)
     - Ranking correlation analysis (Kendall's tau / Spearman's rho)
     - Quality vs Latency efficiency trade-off (Pareto Frontier)
================================================================================
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Configure styling for academic publication
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Tahoma']
plt.rcParams['axes.edgecolor'] = '#334155'
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.color'] = '#e2e8f0'
plt.rcParams['grid.linestyle'] = '--'
plt.rcParams['grid.alpha'] = 0.7

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "plots"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "exp6_plan_evaluation.csv"))
if not os.path.exists(CSV_PATH):
    # fallback
    CSV_PATH = "exp6_plan_evaluation.csv"

# Model display names and colors
MODEL_DISPLAY_NAMES = {
    "openai-gpt-54": "GPT-5.4",
    "anthropic-claude-sonnet5": "Claude Sonnet 5",
    "openai-gpt-54-mini": "GPT-5.4 Mini",
    "google-gemini-38-flash": "Gemini 3.8 Flash",
    "qwen-38-flash": "Qwen 3.8 Flash",
    "meta-llama4": "Llama 4 Maverick",
}

MODEL_PALETTE = {
    "GPT-5.4": "#10b981",          # emerald
    "Claude Sonnet 5": "#f97316",  # orange
    "GPT-5.4 Mini": "#06b6d4",     # cyan
    "Gemini 3.8 Flash": "#3b82f6", # blue
    "Qwen 3.8 Flash": "#8b5cf6",   # purple
    "Llama 4 Maverick": "#ec4899", # pink
}

DIMENSIONS = [
    ("Dim1_ConstraintSatisfaction", "D1: Constraint"),
    ("Dim2_ActivityRelevance", "D2: Relevance"),
    ("Dim3_Spatiality", "D3: Spatiality"),
    ("Dim4_AccuracyValidity", "D4: Accuracy"),
    ("Dim5_OverallQuality", "D5: Overall Quality"),
]


def load_and_clean_data():
    df = pd.read_csv(CSV_PATH)
    # Filter out discontinued / legacy models
    df = df[~df["Model"].astype(str).str.contains("qwen-vl", case=False, na=False)]
    df["ModelClean"] = df["Model"].map(MODEL_DISPLAY_NAMES).fillna(df["Model"])
    df["LatencySec"] = df["Gen Latency MS"] / 1000.0
    return df


def plot_1_relative_score_ci(df):
    """
    Fig 1: Relative Score Performance Gap with 95% Confidence Intervals
    Adapted from Gao & Sun (2025) Fig 1 & Fig 5.
    Compares the reference model (GPT-5.4) vs other models across 5 evaluation dimensions.
    """
    ref_model = "GPT-5.4"
    other_models = [m for m in df["ModelClean"].unique() if m != ref_model]

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

    dim_cols = [d[0] for d in DIMENSIONS]
    dim_labels = [d[1] for d in DIMENSIONS]

    n_dims = len(dim_cols)
    width = 0.15
    x_indices = np.arange(n_dims)

    for i, model in enumerate(other_models):
        ref_vals = df[df["ModelClean"] == ref_model]
        tgt_vals = df[df["ModelClean"] == model]

        deltas = []
        ci_lows = []
        ci_highs = []

        for dim_col in dim_cols:
            v_ref = ref_vals[dim_col].dropna().values
            v_tgt = tgt_vals[dim_col].dropna().values

            # Relative score delta = Target - Reference
            # Negative delta means Reference outperforms Target
            delta = np.mean(tgt_vals[dim_col]) - np.mean(ref_vals[dim_col])
            deltas.append(delta)

            # Two-sample t-based confidence interval for difference
            n1, n2 = len(v_tgt), len(v_ref)
            s1, s2 = np.var(v_tgt, ddof=1), np.var(v_ref, ddof=1)
            se = np.sqrt(s1 / n1 + s2 / n2)
            ci = 1.96 * se  # 95% CI
            ci_lows.append(ci)
            ci_highs.append(ci)

        pos = x_indices + (i - len(other_models) / 2 + 0.5) * width
        color = MODEL_PALETTE.get(model, "#64748b")
        ax.errorbar(
            pos,
            deltas,
            yerr=[ci_lows, ci_highs],
            fmt='o',
            capsize=4,
            capthick=1.2,
            elinewidth=1.5,
            markersize=6,
            color=color,
            label=f"{model} vs. {ref_model}",
        )

    # Reference null line (delta = 0)
    ax.axhline(0, color="#ef4444", linestyle="--", linewidth=1.2, alpha=0.8, label="Null Baseline (Δ = 0)")

    ax.set_xticks(x_indices)
    ax.set_xticklabels(dim_labels, fontweight="bold", fontsize=11)
    ax.set_ylabel(r"Relative Score Gap $\hat{\delta} \pm 95\%$ CI", fontsize=12, fontweight="bold")
    ax.set_title(
        r"Relative Performance Gap with 95% Confidence Intervals (Gao & Sun 2025 Architecture)" "\n"
        f"Pairwise Difference Relative to {ref_model} across 5 Rubric Dimensions",
        fontsize=13,
        fontweight="bold",
        pad=15
    )
    ax.grid(True, axis="y", alpha=0.5)
    ax.legend(frameon=True, facecolor="#ffffff", edgecolor="#cbd5e1", fontsize=9, loc="lower left")

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig1_relative_score_ci.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")


def plot_2_radar_comparison(df):
    """
    Fig 2: 5-Dimensional Radar Comparison across AI Models
    """
    dim_cols = [d[0] for d in DIMENSIONS]
    dim_labels = [d[1] for d in DIMENSIONS]

    means_by_model = df.groupby("ModelClean")[dim_cols].mean()

    num_vars = len(dim_labels)
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]  # close polygon

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True), dpi=300)

    for model, row in means_by_model.iterrows():
        values = row.values.flatten().tolist()
        values += values[:1]
        color = MODEL_PALETTE.get(model, "#64748b")
        ax.plot(angles, values, color=color, linewidth=2, label=model)
        ax.fill(angles, values, color=color, alpha=0.1)

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(dim_labels, fontsize=10, fontweight="bold")
    ax.set_ylim(1.0, 5.0)
    ax.set_yticks([2.0, 3.0, 4.0, 5.0])
    ax.set_yticklabels(["2.0", "3.0", "4.0", "5.0"], color="#64748b", size=9)
    ax.set_title("5-Dimensional Rubric Quality Footprint\n(Model Competence Radar Chart)", fontsize=13, fontweight="bold", pad=25)
    ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1), fontsize=9, frameon=True)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig2_radar_5dimensions.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")


def plot_3_ranking_correlation_matrix(df):
    """
    Fig 3: Kendall's Tau & Spearman's Rho Ranking Correlation Matrix
    Adapted from Betzalel et al. (2024) Table 1.
    Evaluates concordance between human rubric scores, latency, and throughput.
    """
    metrics = {
        "D1 (Constraint)": "Dim1_ConstraintSatisfaction",
        "D2 (Relevance)": "Dim2_ActivityRelevance",
        "D3 (Spatiality)": "Dim3_Spatiality",
        "D4 (Accuracy)": "Dim4_AccuracyValidity",
        "D5 (Quality)": "Dim5_OverallQuality",
        "Total Score": "Total Score",
        "Latency (s)": "LatencySec",
        "Throughput": "Throughput TPS",
    }

    sub_df = df[list(metrics.values())].rename(columns={v: k for k, v in metrics.items()})

    # Compute Kendall's tau correlation matrix
    kendall_corr = sub_df.corr(method="kendall")

    fig, ax = plt.subplots(figsize=(9, 7.5), dpi=300)
    mask = np.triu(np.ones_like(kendall_corr, dtype=bool), k=1)
    
    cmap = sns.diverging_palette(220, 20, as_cmap=True)
    sns.heatmap(
        kendall_corr,
        mask=mask,
        cmap=cmap,
        vmax=1.0,
        vmin=-0.5,
        center=0,
        annot=True,
        fmt=".2f",
        square=True,
        linewidths=0.8,
        cbar_kws={"shrink": 0.8, "label": r"Kendall's Ranking Correlation ($\tau$)"},
        ax=ax
    )

    ax.set_title("Metric Concordance & Ranking Correlation Matrix\n(Kendall's Tau Analysis - Betzalel et al. 2024)", fontsize=13, fontweight="bold", pad=15)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig3_ranking_correlation_matrix.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")


def plot_4_quality_vs_latency_scatter(df):
    """
    Fig 4: Quality vs. Latency Pareto Frontier Trade-Off
    Adapted from Betzalel et al. (2024) Figure 6.
    Identifies the sweet spot for production deployment.
    """
    summary = df.groupby("ModelClean").agg({
        "Total Score": "mean",
        "LatencySec": "mean",
        "Throughput TPS": "mean",
        "Completion Tokens": "mean"
    }).reset_index()

    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

    for _, row in summary.iterrows():
        model = row["ModelClean"]
        color = MODEL_PALETTE.get(model, "#64748b")
        size = row["Throughput TPS"] * 12

        ax.scatter(
            row["LatencySec"],
            row["Total Score"],
            s=size,
            color=color,
            alpha=0.85,
            edgecolors="#1e293b",
            linewidth=1.2,
            label=f"{model} ({row['Throughput TPS']:.1f} tok/s)"
        )

        ax.annotate(
            f"{model}\n({row['Total Score']:.2f}★, {row['LatencySec']:.1f}s)",
            (row["LatencySec"], row["Total Score"]),
            textcoords="offset points",
            xytext=(10, -5),
            fontsize=9,
            fontweight="bold",
            color="#1e293b"
        )

    ax.set_xlabel("Average Generation Latency (seconds) [Lower is Better]", fontsize=11, fontweight="bold")
    ax.set_ylabel("Average Total Plan Quality Score (1.0 - 5.0) [Higher is Better]", fontsize=11, fontweight="bold")
    ax.set_title("Quality vs. Latency Pareto Frontier (Efficiency Trade-Off)\nBubble Size corresponds to Token Throughput (TPS)", fontsize=13, fontweight="bold", pad=15)
    ax.grid(True, alpha=0.5)

    # Highlight Optimal Zone
    x_min, x_max = ax.get_xlim()
    y_min, y_max = ax.get_ylim()
    ax.axhspan(3.8, y_max, color="#10b981", alpha=0.08, label="High Quality Region (Score >= 3.8)")

    ax.legend(frameon=True, facecolor="#ffffff", edgecolor="#cbd5e1", fontsize=9, loc="lower right")

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig4_quality_vs_latency_pareto.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")


def plot_5_ranked_leaderboard_ci(df):
    """
    Fig 5: Ranked Overall Quality Leaderboard with 95% Confidence Intervals
    """
    stats_df = df.groupby("ModelClean")["Total Score"].agg(
        mean="mean",
        std="std",
        count="count"
    ).reset_index()

    stats_df["ci"] = 1.96 * (stats_df["std"] / np.sqrt(stats_df["count"]))
    stats_df = stats_df.sort_values(by="mean", ascending=True)

    fig, ax = plt.subplots(figsize=(9, 5.5), dpi=300)

    y_pos = np.arange(len(stats_df))
    colors = [MODEL_PALETTE.get(m, "#64748b") for m in stats_df["ModelClean"]]

    bars = ax.barh(
        y_pos,
        stats_df["mean"],
        xerr=stats_df["ci"],
        capsize=5,
        color=colors,
        edgecolor="#334155",
        linewidth=0.8,
        alpha=0.9
    )

    for i, (m, c) in enumerate(zip(stats_df["mean"], stats_df["ci"])):
        ax.text(m + c + 0.05, i, f"{m:.2f} (±{c:.2f})", va="center", fontsize=9, fontweight="bold", color="#1e293b")

    ax.set_yticks(y_pos)
    ax.set_yticklabels(stats_df["ModelClean"], fontsize=11, fontweight="bold")
    ax.set_xlabel("Overall Quality Score (out of 5.0)", fontsize=11, fontweight="bold")
    ax.set_xlim(1.0, 5.2)
    n_total = len(df)
    n_per_model = stats_df["count"].iloc[0] if len(stats_df) > 0 else 12
    ax.set_title(f"Ranked Model Quality Leaderboard with 95% Confidence Intervals\n(Balanced Design: $N={n_total}$ Total Evaluations, {n_per_model} per Model)", fontsize=13, fontweight="bold", pad=15)
    ax.grid(True, axis="x", alpha=0.5)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig5_ranked_leaderboard_ci.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")


def main():
    print("Loading Exp 6 dataset...")
    df = load_and_clean_data()
    print(f"Loaded {len(df)} samples across models: {df['ModelClean'].unique().tolist()}")

    print("Generating Academic Plots...")
    plot_1_relative_score_ci(df)
    plot_2_radar_comparison(df)
    plot_3_ranking_correlation_matrix(df)
    plot_4_quality_vs_latency_scatter(df)
    plot_5_ranked_leaderboard_ci(df)
    print("\n[SUCCESS] All 5 publication-ready graphs have been generated in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
