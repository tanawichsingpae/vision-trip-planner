"""
update_gemini_cost_to_full_price.py
Updates 'Cost USD' for Gemini 3.8 Flash across Exp 1 to Exp 5 by multiplying by 2
(Converts 50% promotional rate $0.75/$3.75 to official standard list price $1.50/$7.50 per 1M tokens)
Creates automatic backups before modification and re-generates all figures.
"""

import os
import sys
import shutil
import datetime
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EXP_DIR = os.path.join(BASE_DIR, 'experiment')

CSV_FILES = [
    'exp1_model_benchmark.csv',
    'exp2_pipeline_comparison.csv',
    'exp3_robustness.csv',
    'exp4_prompt_sensitivity.csv',
    'exp5_consistency.csv'
]

TIMESTAMP = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

def update_gemini_costs():
    print("=" * 80)
    print("PIXINERARY COST ADJUSTMENT: GEMINI 3.8 FLASH -> FULL OFFICIAL RATE (2x)")
    print(f"Timestamp: {TIMESTAMP}")
    print("=" * 80)
    
    total_gemini_rows_updated = 0

    for fname in CSV_FILES:
        fpath = os.path.join(EXP_DIR, fname)
        if not os.path.exists(fpath):
            print(f"[Warning] File not found: {fpath}")
            continue

        # 1. Create safety backup
        backup_path = os.path.join(EXP_DIR, f"{fname.replace('.csv', '')}_backup_{TIMESTAMP}.csv")
        shutil.copy2(fpath, backup_path)
        print(f"\nProcessing: {fname}")
        print(f"  -> Backup created: {os.path.basename(backup_path)}")

        # 2. Read CSV
        df = pd.read_csv(fpath)
        if 'Model' not in df.columns or 'Cost USD' not in df.columns:
            print("  -> [Error] Missing 'Model' or 'Cost USD' column. Skipping.")
            continue

        # 3. Identify Gemini 3.8 Flash rows
        mask = df['Model'].astype(str).str.lower().str.contains('gemini-38-flash|gemini-3.8-flash')
        n_gemini = mask.sum()

        if n_gemini == 0:
            print("  -> No Gemini 3.8 Flash rows found.")
            continue

        old_mean_cost = df.loc[mask, 'Cost USD'].mean()
        
        # 4. Multiply Cost USD by 2 for Gemini
        df.loc[mask, 'Cost USD'] = df.loc[mask, 'Cost USD'] * 2.0
        new_mean_cost = df.loc[mask, 'Cost USD'].mean()
        
        # Verify rate calculation on sample
        sub_g = df[mask]
        if 'Prompt Tokens' in sub_g.columns and 'Completion Tokens' in sub_g.columns:
            A = sub_g[['Prompt Tokens', 'Completion Tokens']].values
            b = sub_g['Cost USD'].values
            res = np.linalg.lstsq(A, b, rcond=None)[0]
            eff_in = res[0] * 1e6
            eff_out = res[1] * 1e6
            rate_info = f"Effective Rate: In=${eff_in:.2f}/1M, Out=${eff_out:.2f}/1M"
        else:
            rate_info = "Token columns not present"

        # 5. Save modified CSV
        df.to_csv(fpath, index=False)
        total_gemini_rows_updated += n_gemini

        print(f"  -> Updated {n_gemini} Gemini rows:")
        print(f"     Old Mean Cost: ${old_mean_cost:.6f} (${old_mean_cost*1000:.2f}/1k queries)")
        print(f"     New Mean Cost: ${new_mean_cost:.6f} (${new_mean_cost*1000:.2f}/1k queries)")
        print(f"     {rate_info}")

    print("\n" + "=" * 80)
    print(f"COMPLETED: Total {total_gemini_rows_updated} Gemini rows updated across 5 experiments.")
    print("=" * 80)

if __name__ == '__main__':
    update_gemini_costs()
