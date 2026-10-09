import os
import sys
import pandas as pd

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'exp4_prompt_sensitivity.csv')
df = pd.read_csv(CSV_PATH)
g = df[df['Model'] == 'google-gemini-38-flash']

images_to_check = ['images15.1.jpg', 'images17.1.jpg', 'images20.1.jpg', 'images23.1.jpg', 'images25.1.jpg', '3.PNG', '11.jpg']

for img in images_to_check:
    print(f"==================================================")
    print(f"IMAGE: {img}")
    print(f"==================================================")
    sub = df[df['Image Name'] == img]
    print("--- Other models predictions ---")
    for m in df['Model'].unique():
        if m == 'google-gemini-38-flash':
            continue
        p1 = sub[(sub['Model'] == m) & (sub['Prompt Variant ID'] == 'P1')]
        if len(p1) > 0:
            print(f"  {m}: {p1['Predicted Place'].values[0]} (Correct: {p1['Is Correct'].values[0]})")
    
    print("\n--- Gemini 3.8 Flash predictions & reasoning ---")
    g_img = g[g['Image Name'] == img]
    for _, r in g_img.iterrows():
        print(f"  [{r['Prompt Variant ID']}] Predicted: {r['Predicted Place']} | Correct: {r['Is Correct']}")
        print(f"      Reasoning: {r['AI Reasoning']}")
    print()
