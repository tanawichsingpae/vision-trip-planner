import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')

print("=== TIER 1 ICONIC IMAGES ===")
t1 = df1[df1['Tier'] == 'tier1_iconic']
t1_imgs = t1.groupby('Image Name').agg(
    gt=('Ground Truth', 'first'),
    acc=('Is Correct', lambda x: x.astype(str).str.lower().isin(['true', '1']).mean()),
    conf=('Confidence', 'mean'),
    models_pred=('Predicted Place', lambda x: list(x.unique())[:3])
).reset_index()
print(t1_imgs)

print("\n=== TIER 2 LONGTAIL IMAGES ===")
t2 = df1[df1['Tier'] == 'tier2_longtail']
t2_imgs = t2.groupby('Image Name').agg(
    gt=('Ground Truth', 'first'),
    acc=('Is Correct', lambda x: x.astype(str).str.lower().isin(['true', '1']).mean()),
    conf=('Confidence', 'mean'),
    models_pred=('Predicted Place', lambda x: list(x.unique())[:3])
).reset_index()
print(t2_imgs)
