# -*- coding: utf-8 -*-
import os
import json
import numpy as np
import pandas as pd

csv_path = r'd:\Pixinerary_model_test\experiment\exp5_consistency.csv'
df = pd.read_csv(csv_path)

out = []
def p(s=""):
    out.append(str(s))

p("================================================================================")
p("EXP 5 FORENSIC INVESTIGATION REPORT")
p("================================================================================")

p(f"1. Basic shape: {df.shape}")
p(f"Total Rows: {len(df)}")

# Check groups
# Question 1:
# รหัสใดใช้แยกภาพทั้ง 12 สถานการณ์ได้โดยไม่ซ้ำกัน และมีตารางเชื่อมรหัสดังกล่าวกับ Image Name, Ground Truth, Tier, Session ID และ Temperature หรือไม่?
p("\n--- 1. SCENE DISAMBIGUATION & SESSION IDS ---")
# Check how Image Name, Ground Truth, Tier, Session ID relate
scenes = df[['Image Name', 'Ground Truth', 'Tier']].drop_duplicates()
p(f"Unique (Image Name, Ground Truth, Tier): {len(scenes)}")
p(scenes.to_string())

p("\nSession ID inspection:")
sess_df = df[['Session ID', 'Image Name', 'Ground Truth', 'Tier', 'Temperature']].drop_duplicates().sort_values(['Image Name', 'Temperature'])
p(sess_df.to_string())

# Check images01.jpg
p("\nImages named images01.jpg:")
img01 = df[df['Image Name'] == 'images01.jpg'][['Session ID', 'Image Name', 'Ground Truth', 'Tier', 'Temperature']].drop_duplicates()
p(img01.to_string())

# Check 144 groups (12 scenes x 6 models x 2 temperatures)
# How to define a unique scene?
# If we define Scene as (Image Name, Ground Truth, Tier) or (Ground Truth, Tier)
df['Scene_Key'] = df['Tier'] + '_' + df['Ground Truth'] + '_' + df['Image Name']
p(f"\nUnique Scene_Key: {df['Scene_Key'].nunique()}")
p("List of Scene_Keys:")
for sk in df['Scene_Key'].unique():
    p(f"  {sk}")

# Group by Model, Temperature, Scene_Key
grp_counts = df.groupby(['Model', 'Temperature', 'Scene_Key']).size()
p(f"\nTotal groups (Model x Temp x Scene_Key): {len(grp_counts)}")
p(f"Are all group counts exactly 5? {(grp_counts == 5).all()}")
p(f"Min group count: {grp_counts.min()}, Max group count: {grp_counts.max()}")

# Question 2: Consistency
p("\n--- 2. CONSISTENCY AFTER KEY RESOLUTION ---")
df['norm_pred'] = df['Predicted Place'].astype(str).str.strip().str.lower()
df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])

# Let's check consistency per Model and Temperature across the 12 Scene_Keys
# Consistency definition: all 5 runs have unique norm_pred == 1
models = ['google-gemini-38-flash', 'anthropic-claude-sonnet5', 'openai-gpt-54', 'openai-gpt-54-mini', 'qwen-25-vl-72b', 'meta-llama4']

cons_results = []
for m in models:
    for t in [0.1, 0.7]:
        sub = df[(df['Model'] == m) & (df['Temperature'] == t)]
        # Per scene
        scene_cons = sub.groupby('Scene_Key')['norm_pred'].nunique()
        perfect_scenes = (scene_cons == 1).sum()
        total_scenes = len(scene_cons)
        pct = (perfect_scenes / total_scenes) * 100
        
        # Accuracy
        acc_runs = sub['is_correct_bool'].sum()
        total_runs = len(sub)
        acc_pct = (acc_runs / total_runs) * 100
        
        # Confidence SD
        conf_sd_overall = sub['Confidence'].std()
        conf_sd_within = sub.groupby('Scene_Key')['Confidence'].std().mean()
        
        # Latency SD
        lat_sd_overall = sub['Time MS'].std()
        lat_sd_within = sub.groupby('Scene_Key')['Time MS'].std().mean()
        
        cons_results.append({
            'Model': m,
            'Temperature': t,
            'Perfect_Scenes': perfect_scenes,
            'Total_Scenes': total_scenes,
            'Consistency_%': pct,
            'Correct_Runs': acc_runs,
            'Total_Runs': total_runs,
            'Accuracy_%': acc_pct,
            'Conf_Mean': sub['Confidence'].mean(),
            'Conf_SD_Overall': conf_sd_overall,
            'Conf_SD_Within': conf_sd_within,
            'Lat_Mean_ms': sub['Time MS'].mean(),
            'Lat_SD_Overall_ms': lat_sd_overall,
            'Lat_SD_Within_ms': lat_sd_within
        })

cons_df = pd.DataFrame(cons_results)
p(cons_df.to_string())

# Question 3: Consistent but Wrong vs Semantic Alias alternation
p("\n--- 3. ACCURACY, CONSISTENT-BUT-WRONG & ALIAS CASES ---")
# Case 1: Consistent (nunique==1) but Wrong (is_correct_bool is all False or acc < 100)
for m in models:
    for t in [0.1, 0.7]:
        sub = df[(df['Model'] == m) & (df['Temperature'] == t)]
        for sk, grp in sub.groupby('Scene_Key'):
            if grp['norm_pred'].nunique() == 1 and not grp['is_correct_bool'].all():
                p(f"[Consistent but Wrong] Model: {m}, Temp: {t}, Scene: {sk}")
                p(f"   Pred: {grp['Predicted Place'].iloc[0]}, GT: {grp['Ground Truth'].iloc[0]}, Is Correct: {grp['is_correct_bool'].tolist()}")
                
# Case 2: Inconsistent (nunique > 1) but Correct all 5 runs (Semantic alias variation!)
for m in models:
    for t in [0.1, 0.7]:
        sub = df[(df['Model'] == m) & (df['Temperature'] == t)]
        for sk, grp in sub.groupby('Scene_Key'):
            if grp['norm_pred'].nunique() > 1 and grp['is_correct_bool'].all():
                p(f"[Semantic Alias Variation - 100% Correct] Model: {m}, Temp: {t}, Scene: {sk}")
                p(f"   Unique Preds: {grp['Predicted Place'].unique().tolist()}")

# Question 4: Confidence and Latency
p("\n--- 4. CONFIDENCE & LATENCY CHECKS ---")
p(f"Missing Confidence values: {df['Confidence'].isna().sum()}")
p(f"Confidence min: {df['Confidence'].min()}, max: {df['Confidence'].max()}")
p(f"Any 0 confidence? How many? {(df['Confidence'] == 0).sum()}")
if (df['Confidence'] == 0).sum() > 0:
    p(df[df['Confidence'] == 0][['Model', 'Scene_Key', 'Confidence', 'Predicted Place', 'AI Reasoning']].head(5).to_string())

p(f"\nMissing Time MS: {df['Time MS'].isna().sum()}")
p(f"Time MS min: {df['Time MS'].min()}, max: {df['Time MS'].max()}")

# Question 5: Figure 4.5 check
p("\n--- 5. FIGURE 4.5 GENERATION LOGIC ---")
# Check how generate_composite_exp5 in generate_chapter4_composite_figures.py calculates:
# (a), (b), (c), (d)
# Look at Session ID vs Scene_Key in generate_composite_exp5

with open(r'd:\Pixinerary_model_test\scratch_exp5_report.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print("Report generated successfully.")
