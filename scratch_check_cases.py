# -*- coding: utf-8 -*-
import pandas as pd
import json

df = pd.read_csv(r'd:\Pixinerary_model_test\experiment\exp4_robustness.csv')
err = df[~df['Is Correct'].astype(str).str.lower().isin(['true', '1'])].copy()

# Print summary of errors
print(f"Total evaluated runs: {len(df)}")
print(f"Total errors: {len(err)}")
print("\nErrors by Condition:")
print(err['Condition Category'].value_counts())

print("\nErrors by Model:")
print(err['Model'].value_counts())

# Group errors by (Condition, Image Name, Landmark Ground Truth)
summary = []
for (cond, img, gt), grp in err.groupby(['Condition Category', 'Image Name', 'Landmark Ground Truth']):
    # Find what correct models called it
    all_runs_for_img = df[df['Image Name'] == img]
    correct_runs = all_runs_for_img[all_runs_for_img['Is Correct'].astype(str).str.lower().isin(['true', '1'])]
    true_place_name = correct_runs['Predicted Place'].iloc[0] if len(correct_runs) > 0 else gt
    
    models_wrong = grp['Model'].tolist()
    preds_wrong = grp['Predicted Place'].tolist()
    failure_modes = grp['Failure Mode'].tolist()
    reasonings = grp['AI Reasoning'].tolist()
    
    summary.append({
        'condition': cond,
        'image': img,
        'gt_id': gt,
        'true_place': true_place_name,
        'wrong_models': models_wrong,
        'wrong_preds': preds_wrong,
        'failure_modes': failure_modes,
        'sample_reasoning': reasonings[0] if reasonings else ''
    })

with open(r'd:\Pixinerary_model_test\exp4_error_case_studies.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("\nSaved detailed error cases to exp4_error_case_studies.json")
