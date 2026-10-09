import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
for tier, grp in df1.groupby('Tier'):
    unique_imgs = grp[['Image Name', 'Ground Truth']].drop_duplicates()
    print(f"\n=== TIER: {tier} (Total: {len(unique_imgs)} images) ===")
    for idx, r in unique_imgs.reset_index(drop=True).iterrows():
        print(f"  {idx+1}. {r['Image Name']} -> {r['Ground Truth']}")
