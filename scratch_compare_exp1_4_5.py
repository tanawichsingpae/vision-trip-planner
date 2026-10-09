import sys, pandas as pd
if hasattr(sys.stdout, 'reconfigure'): 
    sys.stdout.reconfigure(encoding='utf-8')

# Load Exp 1, Exp 4, Exp 5
df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
df4 = pd.read_csv('experiment/exp4_prompt_sensitivity.csv')
df5 = pd.read_csv('experiment/exp5_consistency.csv')

df1['is_correct'] = df1['Is Correct'].astype(str).str.lower().isin(['true', '1'])
df5['is_correct'] = df5['Is Correct'].astype(str).str.lower().isin(['true', '1'])

df4_clean = df4.drop_duplicates(subset=['Tier', 'Image Name', 'Model', 'Prompt Variant ID']).copy()
df4_clean['Cost USD'] = pd.to_numeric(df4_clean['Cost USD'], errors='coerce')
df4_clean = df4_clean[df4_clean['Cost USD'] < 10.0]  # exclude corrupted shifted row
df4_clean['is_correct'] = df4_clean['Is Correct'].astype(str).str.lower().isin(['true', '1'])
df4_clean['Total Tokens'] = pd.to_numeric(df4_clean['Total Tokens'], errors='coerce')
df4_clean['Time MS'] = pd.to_numeric(df4_clean['Time MS'], errors='coerce')

print('=== 1. SUMMARY OF EXPERIMENT DIMENSIONS ===')
print(f"Exp 1: {len(df1)} rows | {df1['Image Name'].nunique()} images | Models: {df1['Model'].nunique()}")
print(f"Exp 4: {len(df4)} raw rows ({len(df4_clean)} clean) | {df4_clean['Image Name'].nunique()} images | Models: {df4_clean['Model'].nunique()} | Prompts: {df4_clean['Prompt Variant ID'].nunique()}")
print(f"Exp 5: {len(df5)} rows | {df5['Image Name'].nunique()} images | Models: {df5['Model'].nunique()}")

print('\n=== 2. OVERALL MODEL ACCURACY (%) ===')
m1 = (df1.groupby('Model')['is_correct'].mean()*100).round(1)
m4_p1 = (df4_clean[df4_clean['Prompt Variant ID']=='P1'].groupby('Model')['is_correct'].mean()*100).round(1)
m4_avg = (df4_clean.groupby('Model')['is_correct'].mean()*100).round(1)
m5 = (df5.groupby('Model')['is_correct'].mean()*100).round(1)

m_df = pd.DataFrame({'Exp 1 (100 imgs, P1)': m1, 'Exp 4 P1 (40 imgs)': m4_p1, 'Exp 4 (Avg P1-P5)': m4_avg, 'Exp 5 (Repeated Consistency)': m5})
print(m_df)

print('\n=== 3. EXP 4: PROMPT ACCURACY BY MODEL ===')
piv = (df4_clean.pivot_table(index='Model', columns='Prompt Variant ID', values='is_correct', aggfunc='mean')*100).round(1)
print(piv)

print('\n=== 4. EXP 4: COST & LATENCY TRADE-OFF (PARETO) ===')
p_tradeoff = df4_clean.groupby('Prompt Variant ID').agg(
    acc=('is_correct', lambda x: round(x.mean()*100, 1)),
    latency_ms=('Time MS', lambda x: round(x.mean())),
    total_tokens=('Total Tokens', lambda x: round(x.mean(), 1)),
    cost_usd=('Cost USD', lambda x: round(x.mean(), 6))
)
print(p_tradeoff)

print('\n=== 5. CROSS-LINGUAL GAP (P1 English vs P4 Thai) ===')
gap = pd.DataFrame({
    'P1 (EN)': piv['P1'],
    'P4 (TH)': piv['P4'],
    'Delta (TH - EN)': piv['P4'] - piv['P1']
})
print(gap)

print('\n=== 6. ACCURACY BY TIER ACROSS EXP 1 vs EXP 4 vs EXP 5 ===')
t1 = (df1.groupby('Tier')['is_correct'].mean()*100).round(1)
t4 = (df4_clean.groupby('Tier')['is_correct'].mean()*100).round(1)
t5 = (df5.groupby('Tier')['is_correct'].mean()*100).round(1)
t_df = pd.DataFrame({'Exp 1 (100 imgs)': t1, 'Exp 4 (40 imgs, 5 prompts)': t4, 'Exp 5 (24 imgs, 5 runs)': t5})
print(t_df)
