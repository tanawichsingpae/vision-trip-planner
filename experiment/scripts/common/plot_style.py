"""
plot_style.py
Common styling configuration for all Pixinerary academic publication figures.
Ensures unified typography, 300 DPI resolution, consistent color palettes,
and automated dual export (.png + .pdf vector) across Exp 1 to Exp 5.
"""

import os
import matplotlib.pyplot as plt

def set_academic_style():
    """Applies clean, publication-grade academic style settings to matplotlib."""
    plt.rcParams['font.family'] = 'DejaVu Sans'
    plt.rcParams['font.size'] = 10.5
    plt.rcParams['axes.titlesize'] = 12.5
    plt.rcParams['axes.labelsize'] = 10.5
    plt.rcParams['xtick.labelsize'] = 9.5
    plt.rcParams['ytick.labelsize'] = 9.5
    plt.rcParams['legend.fontsize'] = 9.5
    plt.rcParams['figure.titlesize'] = 13.5
    plt.rcParams['figure.dpi'] = 300
    plt.rcParams['axes.grid'] = True
    plt.rcParams['grid.alpha'] = 0.3
    plt.rcParams['grid.linestyle'] = '--'

# Canonical Model Colors
MODEL_COLORS = {
    'Gemini 3.8 Flash': '#0284c7',       # Vibrant Blue/Cyan
    'GPT-5.4': '#10b981',                # Emerald Green
    'Claude Sonnet 5': '#8b5cf6',        # Royal Purple
    'Qwen 2.5 VL 72B': '#f59e0b',        # Amber/Orange
    'GPT-5.4 Mini': '#06b6d4',           # Teal
    'Llama 4 Maverick': '#ef4444'        # Rose/Red
}

MODEL_LABELS_MAP = {
    'anthropic-claude-sonnet5': 'Claude Sonnet 5',
    'google-gemini-38-flash': 'Gemini 3.8 Flash',
    'openai-gpt-54': 'GPT-5.4',
    'openai-gpt-54-mini': 'GPT-5.4 Mini',
    'qwen-25-vl-72b': 'Qwen 2.5 VL 72B',
    'meta-llama4': 'Llama 4 Maverick'
}

# Canonical Tier Colors
TIER_COLORS = {
    'tier1_iconic': '#2563eb',          # Blue
    'tier2_longtail': '#7c3aed',        # Purple
    'tier3_nature': '#059669',          # Green
    'tier4_ugc': '#d97706'              # Amber
}

TIER_NAMES = {
    'tier1_iconic': 'Tier 1: Iconic Landmarks',
    'tier2_longtail': 'Tier 2: Regional Heritage',
    'tier3_nature': 'Tier 3: Nature & Scenic',
    'tier4_ugc': 'Tier 4: In-The-Wild UGC'
}

def save_academic_figure(fig, output_dir: str, file_prefix: str, tight: bool = True):
    """
    Saves figure in both high-res .png (300 DPI) and vector .pdf for LaTeX inclusion.
    """
    os.makedirs(output_dir, exist_ok=True)
    png_path = os.path.join(output_dir, f"{file_prefix}.png")
    pdf_path = os.path.join(output_dir, f"{file_prefix}.pdf")
    
    kwargs = {'dpi': 300}
    if tight:
        kwargs['bbox_inches'] = 'tight'

    fig.savefig(png_path, **kwargs)
    fig.savefig(pdf_path, **kwargs)
    plt.close(fig)
    print(f"  -> Saved: {file_prefix}.png & .pdf")
