import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("=== 1. EXP1 BENCHMARK SUMMARY ===")
try:
    df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
    print("Shape:", df1.shape)
    print("Models:", df1['Model'].unique().tolist())
    print("Tiers:", df1['Tier'].unique().tolist())
    df1['is_correct_bool'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    acc_by_tier_model = df1.groupby(['Tier', 'Model'])['is_correct_bool'].mean().unstack()
    print("\nAccuracy by Tier & Model:\n", acc_by_tier_model)
    print("\nOverall Accuracy by Model:\n", df1.groupby('Model')['is_correct_bool'].mean())
    print("\nFailure Modes in Exp1:\n", df1['Failure Mode'].value_counts())
    print("\nHardest Images in Exp1 (lowest accuracy across models):")
    hard_imgs = df1.groupby(['Tier', 'Image Name', 'Ground Truth'])['is_correct_bool'].agg(['count', 'sum', 'mean']).sort_values(by='mean')
    print(hard_imgs.head(15))
except Exception as e:
    print("Exp1 Error:", e)

print("\n" + "="*50)
print("=== 2. EXP4 PROMPT SENSITIVITY SUMMARY ===")
try:
    df4 = pd.read_csv('experiment/exp4_prompt_sensitivity.csv')
    print("Shape:", df4.shape)
    print("Models:", df4['Model'].unique().tolist())
    print("Prompt Variants:", df4['Prompt Variant Name'].unique().tolist())
    df4['is_correct_bool'] = df4['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    print("\nAccuracy by Prompt Variant & Model:")
    print(df4.groupby(['Prompt Variant Name', 'Model'])['is_correct_bool'].mean().unstack())
    print("\nFailure Modes in Exp4:\n", df4['Failure Mode'].value_counts() if 'Failure Mode' in df4.columns else "No Failure Mode col")
except Exception as e:
    print("Exp4 Error:", e)

print("\n" + "="*50)
print("=== 3. EXP5 CONSISTENCY SUMMARY ===")
try:
    df5 = pd.read_csv('experiment/exp5_consistency.csv')
    print("Shape:", df5.shape)
    print("Models:", df5['Model'].unique().tolist())
    df5['is_correct_bool'] = df5['Is Correct'].astype(str).str.lower().isin(['true', '1'])
    print("\nAccuracy & Confidence std by Model:")
    print(df5.groupby('Model').agg(
        acc=('is_correct_bool', 'mean'),
        conf_mean=('Confidence', 'mean'),
        conf_std=('Confidence', 'std'),
        count=('Model', 'count')
    ))
    if 'Run Number' in df5.columns:
        print("\nConsistency per image across runs:")
        img_consistency = df5.groupby(['Model', 'Image Name'])['is_correct_bool'].agg(['count', 'mean', 'std'])
        print(img_consistency.head(10))
except Exception as e:
    print("Exp5 Error:", e)

print("\n" + "="*50)
print("=== 4. EXP2 PIPELINE COMPARISON CURRENT STATE ===")
try:
    df2 = pd.read_csv('experiment/exp2_pipeline_comparison.csv')
    print("Shape:", df2.shape)
    print("Models:", df2['Model'].unique().tolist())
    print("Tiers:", df2['Tier'].unique().tolist())
    print("Top 1 Strict Mean:", df2['Top 1 Strict'].mean())
    print("Top 3 Recall Mean:", df2['Top 3 Recall'].mean())
    print("Avg Candidate Score:", df2['Avg Candidate Score'].mean())
    print("Images tested:", df2['Image Name'].unique().tolist())
    print("Ground truths:", df2['Ground Truth'].unique().tolist())
    print("\nRow details:")
    print(df2[['Image Name', 'Ground Truth', 'Tier', 'Model', 'Top 1 Place', 'Candidate 1 Name', 'Candidate 1 Score', 'Candidate 2 Name', 'Candidate 2 Score', 'Candidate 3 Name', 'Candidate 3 Score', 'Top 1 Strict', 'Top 3 Recall']].to_string())
except Exception as e:
    print("Exp2 Error:", e)
