"""
clean_exp1_duplicates.py
Script to safely deduplicate rows in exp1_model_benchmark.csv
Retains the latest trial record for each (Tier, Image Name, Model) combination.
Automatically creates a safety backup before overwriting.
"""

import os
import shutil
import pandas as pd
from datetime import datetime

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'exp1_model_benchmark.csv'))
BACKUP_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', f'exp1_model_benchmark_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'))
STATIC_BACKUP_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'exp1_model_benchmark_backup.csv'))

def clean_duplicates():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] CSV not found at: {CSV_PATH}")
        return

    # 1. Create safety backups
    shutil.copy2(CSV_PATH, BACKUP_PATH)
    shutil.copy2(CSV_PATH, STATIC_BACKUP_PATH)
    print(f"Safety backup created at:\n  -> {BACKUP_PATH}\n  -> {STATIC_BACKUP_PATH}")

    # 2. Read existing CSV
    df = pd.read_csv(CSV_PATH)
    initial_len = len(df)
    print(f"\nInitial total rows: {initial_len}")

    print("\n--- Initial Count by Tier ---")
    print(df['Tier'].value_counts())

    # 3. Sort by Timestamp ascending so that 'last' keeps the most recent entry
    if 'Timestamp' in df.columns:
        df['dt_temp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        df = df.sort_values(by=['dt_temp'], ascending=True)
        df = df.drop(columns=['dt_temp'])

    # 4. Deduplicate based on Tier, Image Name, and Model (keep latest run)
    dedup_cols = ['Tier', 'Image Name', 'Model']
    cleaned_df = df.drop_duplicates(subset=dedup_cols, keep='last')
    final_len = len(cleaned_df)
    dropped_count = initial_len - final_len

    # Sort logically by Tier, Image Name, Model for clean readability
    cleaned_df = cleaned_df.sort_values(by=['Tier', 'Image Name', 'Model'])

    # 5. Save back to original file
    cleaned_df.to_csv(CSV_PATH, index=False, encoding='utf-8')
    print(f"\nSuccessfully cleaned and saved to: {CSV_PATH}")
    print(f"Rows removed: {dropped_count} duplicate records")
    print(f"Total remaining rows: {final_len}")

    print("\n--- Cleaned Count by Tier ---")
    for tier in ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']:
        count = len(cleaned_df[cleaned_df['Tier'] == tier])
        unique_imgs = cleaned_df[cleaned_df['Tier'] == tier]['Image Name'].nunique()
        print(f"  {tier:16s}: {count:3d} rows ({unique_imgs:2d}/25 images)")

    # 6. Check missing combinations
    print("\n--- Completeness Check ---")
    all_models = df['Model'].unique()
    for tier in ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']:
        sub = cleaned_df[cleaned_df['Tier'] == tier]
        if len(sub) < 150:
            print(f"[Attention] {tier} has {len(sub)}/150 records:")
            for img in sub['Image Name'].unique():
                img_sub = sub[sub['Image Name'] == img]
                if len(img_sub) < len(all_models):
                    missing_m = [m for m in all_models if m not in img_sub['Model'].tolist()]
                    print(f"  - Image: {img} is missing model(s): {missing_m}")

if __name__ == '__main__':
    clean_duplicates()
