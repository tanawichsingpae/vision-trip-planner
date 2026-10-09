"""
run_all_visualizations.py
Master runner to execute all Pixinerary publication visualization scripts
Covers: Exp 1, Exp 2, Exp 3, Exp 4, Exp 5, and Cross-Experiment Summary
Pixinerary Master's Thesis / Academic Paper
"""

import os
import sys
import time

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SCRIPTS = [
    ("Experiment 1 (Model Benchmark)", os.path.join(BASE_DIR, 'scripts', 'exp1_model_benchmark', 'plot_exp1_visualizations.py')),
    ("Experiment 2 (Two-Turn Pipeline)", os.path.join(BASE_DIR, 'scripts', 'exp2_pipeline_comparison', 'plot_exp2_visualizations.py')),
    ("Experiment 3 (Environmental Robustness)", os.path.join(BASE_DIR, 'scripts', 'exp3_robustness', 'plot_exp3_visualizations.py')),
    ("Experiment 4 (Prompt Sensitivity)", os.path.join(BASE_DIR, 'scripts', 'exp4_prompt_sensitivity', 'plot_exp4_visualizations.py')),
    ("Experiment 5 (Consistency & Stability)", os.path.join(BASE_DIR, 'scripts', 'exp5_consistency', 'plot_exp5_visualizations.py')),
    ("Cross-Experiment Synthesis Summary", os.path.join(BASE_DIR, 'scripts', 'summary_synthesis', 'plot_cross_experiment_summary.py'))
]

def run_all():
    print("=" * 80)
    print("Pixinerary VPR Research: Generating All Academic Publication Figures")
    print("=" * 80)
    
    start_total = time.time()
    results = []

    for name, script_path in SCRIPTS:
        print(f"\n>>> Running: {name}")
        print(f"    File: {script_path}")
        
        if not os.path.exists(script_path):
            print(f"    [Error] Script not found: {script_path}")
            results.append((name, False, "Script file missing"))
            continue
            
        import subprocess
        t0 = time.time()
        proc = subprocess.run([sys.executable, script_path], capture_output=False)
        duration = time.time() - t0
        
        if proc.returncode == 0:
            print(f"    [SUCCESS] Finished in {duration:.2f}s")
            results.append((name, True, f"{duration:.2f}s"))
        else:
            print(f"    [FAILED] Exit code {proc.returncode}")
            results.append((name, False, f"Exit code {proc.returncode}"))

    total_time = time.time() - start_total
    print("\n" + "=" * 80)
    print("EXECUTION SUMMARY")
    print("=" * 80)
    for name, success, note in results:
        status_str = "[OK]  " if success else "[FAIL]"
        print(f"  {status_str} {name:40s} -> {note}")
    print(f"\nTotal execution time: {total_time:.2f}s")
    
    # Audit figures directories
    figs_dir = os.path.join(BASE_DIR, 'figures')
    if os.path.exists(figs_dir):
        print("\n" + "-" * 80)
        print("GENERATED FIGURES DIRECTORY AUDIT")
        print("-" * 80)
        for folder in os.listdir(figs_dir):
            fp = os.path.join(figs_dir, folder)
            if os.path.isdir(fp):
                files = os.listdir(fp)
                pngs = [f for f in files if f.endswith('.png')]
                pdfs = [f for f in files if f.endswith('.pdf')]
                print(f"  Folder: {folder:35s} | PNG: {len(pngs):2d} | PDF: {len(pdfs):2d}")
    print("=" * 80)

if __name__ == '__main__':
    run_all()
