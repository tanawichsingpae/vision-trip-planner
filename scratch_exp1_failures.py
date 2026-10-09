import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
df1['is_correct_bool'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])

# Find failure cases in Exp 1
fails = df1[~df1['is_correct_bool']]
print("Total failures in Exp 1:", len(fails), "/", len(df1))
print("Failures by Tier:")
print(fails['Tier'].value_counts())

# Group failures by Image Name
fail_summary = fails.groupby(['Tier', 'Image Name', 'Ground Truth']).agg(
    fail_models=('Model', 'unique'),
    fail_count=('Model', 'count'),
    pred_examples=('Predicted Place', lambda x: list(x)[:3]),
    conf_mean=('Confidence', 'mean')
).reset_index().sort_values(by=['Tier', 'fail_count'], ascending=[True, False])

print("\nImages with most failures in Exp 1:")
for _, r in fail_summary.iterrows():
    print(f"[{r['Tier']}] {r['Image Name']} ({r['Ground Truth']}): {r['fail_count']} models failed. Preds: {r['pred_examples']} (Avg Conf: {r['conf_mean']:.2f})")
