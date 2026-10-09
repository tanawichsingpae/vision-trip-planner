import os
import sys
import pandas as pd
import json

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'exp4_prompt_sensitivity.csv')
df = pd.read_csv(CSV_PATH)

models = df['Model'].unique().tolist()
images = df[['Image Name', 'Tier']].drop_duplicates()

analysis = []

for _, img_row in images.iterrows():
    img = img_row['Image Name']
    tier = img_row['Tier']
    sub = df[(df['Image Name'] == img) & (df['Tier'] == tier)]
    
    g_sub = sub[sub['Model'] == 'google-gemini-38-flash']
    g_preds = {row['Prompt Variant ID']: row['Predicted Place'] for _, row in g_sub.iterrows()}
    g_correct = {row['Prompt Variant ID']: row['Is Correct'] for _, row in g_sub.iterrows()}
    
    # Other models P1 and failures
    other_p1 = {}
    other_failures = []
    for m in models:
        if m == 'google-gemini-38-flash':
            continue
        m_sub = sub[sub['Model'] == m]
        p1_row = m_sub[m_sub['Prompt Variant ID'] == 'P1']
        if len(p1_row) > 0:
            other_p1[m] = p1_row['Predicted Place'].values[0]
        
        fails = m_sub[m_sub['Is Correct'].astype(str).str.lower().isin(['false', '0'])]
        for _, f in fails.iterrows():
            other_failures.append({
                'model': m,
                'variant': f['Prompt Variant ID'],
                'predicted': f['Predicted Place'],
                'failure_mode': f['Failure Mode']
            })
            
    # Check differences between Gemini and others
    # 1. Did other models fail while Gemini succeeded?
    # 2. Did Gemini name a different landmark/sub-landmark?
    
    analysis.append({
        'image': img,
        'tier': tier,
        'gemini_preds': g_preds,
        'gemini_all_correct': all(str(v).lower() in ['true', '1'] for v in g_correct.values()),
        'other_p1': other_p1,
        'other_failures': other_failures
    })

print(f"Total images analyzed: {len(analysis)}")
with open(os.path.join(os.path.dirname(__file__), 'detailed_comparison.json'), 'w', encoding='utf-8') as f:
    json.dump(analysis, f, ensure_ascii=False, indent=2)
print("Saved detailed_comparison.json successfully.")
