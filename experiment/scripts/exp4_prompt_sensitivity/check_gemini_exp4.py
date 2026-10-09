import os
import sys
import pandas as pd
import json

# Ensure stdout handles UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'exp4_prompt_sensitivity.csv')
df = pd.read_csv(CSV_PATH)

print(f"Total rows in CSV: {len(df)}")
print(f"Models: {df['Model'].unique().tolist()}")

# Check Is Correct for Gemini 3.8 Flash
gemini_rows = df[df['Model'] == 'google-gemini-38-flash']
print(f"Total Gemini rows: {len(gemini_rows)}")
print(f"Gemini Is Correct value counts:")
print(gemini_rows['Is Correct'].value_counts(dropna=False))

# Group by (Image Name, Tier) and inspect differences across models
images = df[['Image Name', 'Tier']].drop_duplicates()
print(f"Total unique (Image Name, Tier): {len(images)}")

output_report = []

for idx, (_, img_row) in enumerate(images.iterrows(), 1):
    img_name = img_row['Image Name']
    tier = img_row['Tier']
    sub = df[(df['Image Name'] == img_name) & (df['Tier'] == tier)]
    
    g_sub = sub[sub['Model'] == 'google-gemini-38-flash']
    other_sub = sub[sub['Model'] != 'google-gemini-38-flash']
    
    g_preds = g_sub['Predicted Place'].tolist()
    g_variants = g_sub['Prompt Variant ID'].tolist()
    g_correct = g_sub['Is Correct'].tolist()
    
    # Check if other models had any False or what they predicted
    other_preds = other_sub[['Model', 'Prompt Variant ID', 'Predicted Place', 'Is Correct', 'Failure Mode']].to_dict('records')
    
    output_report.append({
        'index': idx,
        'image_name': img_name,
        'tier': tier,
        'gemini_preds': dict(zip(g_variants, g_preds)),
        'gemini_all_correct': all(str(c).lower() in ['true', '1'] for c in g_correct),
        'other_preds': other_preds
    })

# Save detailed JSON report
out_json_path = os.path.join(os.path.dirname(__file__), 'gemini_exp4_analysis.json')
with open(out_json_path, 'w', encoding='utf-8') as f:
    json.dump(output_report, f, ensure_ascii=False, indent=2)

print(f"Analysis saved to {out_json_path}")
