import pandas as pd
import json

df = pd.read_csv('experiment/exp1_model_benchmark.csv')

print("=== 1. SUMMARY BY TIER ===")
for tier in ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']:
    grp = df[df['Tier'] == tier]
    imgs = grp['Image Name'].unique()
    gts = grp['Ground Truth'].unique()
    print(f"{tier}: {len(grp)} rows, {len(imgs)} unique images, {len(gts)} unique GTs")

print("\n=== 2. DUPLICATES (Image Name + Model) ===")
dup_counts = df.groupby(['Tier', 'Image Name', 'Model']).size().reset_index(name='count')
over_dups = dup_counts[dup_counts['count'] > 1]
print(f"Total over-duplicated (Image + Model) pairs: {len(over_dups)}")
if len(over_dups) > 0:
    for tier, grp in over_dups.groupby('Tier'):
        print(f"\nDuplicate images in {tier}:")
        img_dups = grp.groupby('Image Name')['count'].sum().reset_index()
        for _, r in img_dups.iterrows():
            print(f"  - Image: {r['Image Name']} (Total runs: {r['count']})")

print("\n=== 3. ALL IMAGES & GROUND TRUTHS IN EXP1 CSV ===")
for tier in ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']:
    grp = df[df['Tier'] == tier]
    print(f"\n=================== {tier} (Found {grp['Image Name'].nunique()} images / {len(grp)} rows) ===================")
    img_summary = grp.groupby(['Image Name', 'Ground Truth']).size().reset_index(name='runs')
    for idx, r in img_summary.iterrows():
        print(f"  [{idx+1:02d}] {r['Image Name']} | GT: '{r['Ground Truth']}' | {r['runs']} records")
