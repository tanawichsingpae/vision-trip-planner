import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("--- EXP1 BREAKDOWN ---")
df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
df1['is_correct_bool'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])
print("Total rows:", len(df1))
print("Models:", df1['Model'].value_counts())
print("\nTier Accuracy:")
print(df1.groupby('Tier')['is_correct_bool'].mean())
print("\nTier x Model Accuracy:")
print(df1.pivot_table(index='Tier', columns='Model', values='is_correct_bool', aggfunc='mean'))

print("\n--- EXP1 FAILURE MODES ---")
print(df1[~df1['is_correct_bool']].groupby(['Tier', 'Failure Mode'])['Model'].count())

print("\n--- EXP4 PROMPT SENSITIVITY ---")
df4 = pd.read_csv('experiment/exp4_prompt_sensitivity.csv')
df4['is_correct_bool'] = df4['Is Correct'].astype(str).str.lower().isin(['true', '1'])
print("Total rows:", len(df4))
print("Images tested in Exp4:", df4['Image Name'].nunique())
print("Tiers in Exp4:", df4['Tier'].value_counts())
print("\nAccuracy by Prompt Variant:")
print(df4.groupby('Prompt Variant Name')['is_correct_bool'].mean())
print("\nAccuracy by Tier x Prompt Variant:")
print(df4.pivot_table(index='Tier', columns='Prompt Variant Name', values='is_correct_bool', aggfunc='mean'))
print("\nAccuracy by Model x Prompt Variant:")
print(df4.pivot_table(index='Model', columns='Prompt Variant Name', values='is_correct_bool', aggfunc='mean'))

print("\n--- EXP5 CONSISTENCY ---")
df5 = pd.read_csv('experiment/exp5_consistency.csv')
df5['is_correct_bool'] = df5['Is Correct'].astype(str).str.lower().isin(['true', '1'])
print("Total rows:", len(df5))
print("Images tested in Exp5:", df5['Image Name'].nunique())
print("Tiers in Exp5:", df5['Tier'].value_counts())
print("Runs per image:", df5.groupby(['Image Name', 'Model'])['Run Number'].count().value_counts())
print("\nConsistency (flip rate / std) by Tier:")
consistency = df5.groupby(['Tier', 'Image Name', 'Model'])['is_correct_bool'].agg(['count', 'mean'])
consistency['is_inconsistent'] = (consistency['mean'] > 0) & (consistency['mean'] < 1)
print("Inconsistent cases count (where accuracy is between 0 and 1):", consistency['is_inconsistent'].sum(), "/", len(consistency))
print("Inconsistent cases by Tier:")
print(consistency.groupby('Tier')['is_inconsistent'].agg(['sum', 'count', 'mean']))

