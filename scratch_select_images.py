import sys
import pandas as pd
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
df4 = pd.read_csv('experiment/exp4_prompt_sensitivity.csv')
df5 = pd.read_csv('experiment/exp5_consistency.csv')

df1['corr'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])
df4['corr'] = df4['Is Correct'].astype(str).str.lower().isin(['true', '1'])
df5['corr'] = df5['Is Correct'].astype(str).str.lower().isin(['true', '1'])

print("=== IMAGE ACCURACY PROFILES ACROSS EXPERIMENTS ===")

# Group df1 by Tier, Image Name
p1 = df1.groupby(['Tier', 'Image Name']).agg(
    gt1=('Ground Truth', 'first'),
    exp1_acc=('corr', 'mean'),
    exp1_conf=('Confidence', 'mean'),
    exp1_fails=('corr', lambda x: (~x).sum()),
    exp1_modes=('Failure Mode', lambda x: list(x[x != 'none'].unique()))
).reset_index()

# Group df4 by Image Name
p4 = df4.groupby(['Tier', 'Image Name']).agg(
    gt4=('Ground Truth', 'first'),
    exp4_acc=('corr', 'mean'),
    exp4_conf=('Confidence', 'mean'),
    exp4_n=('corr', 'count')
).reset_index()

# Group df5 by Image Name
p5 = df5.groupby(['Tier', 'Image Name']).agg(
    gt5=('Ground Truth', 'first'),
    exp5_acc=('corr', 'mean'),
    exp5_conf=('Confidence', 'mean'),
    exp5_inconsist=('corr', lambda x: 1 if (0 < x.mean() < 1) else 0)
).reset_index()

merged = pd.merge(p1, p4[['Tier', 'Image Name', 'exp4_acc', 'exp4_conf']], on=['Tier', 'Image Name'], how='left')
merged = pd.merge(merged, p5[['Tier', 'Image Name', 'exp5_acc', 'exp5_inconsist']], on=['Tier', 'Image Name'], how='left')

print(f"Total images in Exp1: {len(merged)}")
print("\n--- TIER 3 (Nature) images sorted by Exp1 Acc: ---")
t3 = merged[merged['Tier'] == 'tier3_nature'].sort_values(by=['exp1_acc', 'exp1_conf'])
for _, r in t3.iterrows():
    print(f"{r['Image Name']:15s} | Acc1: {r['exp1_acc']*100:5.1f}% | Acc4: {r['exp4_acc']*100 if pd.notnull(r['exp4_acc']) else -1:5.1f}% | Incons5: {r['exp5_inconsist']} | GT: {r['gt1']} | Fails: {r['exp1_modes']}")

print("\n--- TIER 4 (UGC) images sorted by Exp1 Acc: ---")
t4 = merged[merged['Tier'] == 'tier4_ugc'].sort_values(by=['exp1_acc', 'exp1_conf'])
for _, r in t4.iterrows():
    print(f"{r['Image Name']:15s} | Acc1: {r['exp1_acc']*100:5.1f}% | Acc4: {r['exp4_acc']*100 if pd.notnull(r['exp4_acc']) else -1:5.1f}% | Incons5: {r['exp5_inconsist']} | GT: {r['gt1']} | Fails: {r['exp1_modes']}")

print("\n--- TIER 1 & TIER 2 Top Samples: ---")
t1_2 = merged[merged['Tier'].isin(['tier1_iconic', 'tier2_longtail'])].head(10)
for _, r in t1_2.iterrows():
    print(f"[{r['Tier']}] {r['Image Name']:15s} | Acc1: {r['exp1_acc']*100:5.1f}% | GT: {r['gt1']}")
