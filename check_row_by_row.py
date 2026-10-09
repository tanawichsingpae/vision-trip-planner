import pandas as pd
import numpy as np

expected_rates = {
    'anthropic-claude-sonnet5': (2.00, 10.00),
    'google-gemini-38-flash': (0.75, 3.75), # promo
    'openai-gpt-54': (2.50, 15.00),
    'openai-gpt-54-mini': (0.75, 4.50),
    'qwen-25-vl-72b': (0.80, 1.00),
    'meta-llama4': (0.1875, 0.6525)
}

files = ['exp1_model_benchmark', 'exp2_pipeline_comparison', 'exp3_robustness', 'exp4_prompt_sensitivity', 'exp5_consistency']

for f in files:
    df = pd.read_csv(f'experiment/{f}.csv')
    print('=' * 80)
    print(f'DATASET: {f}.csv ({len(df)} rows)')
    print('=' * 80)
    for m in sorted(df['Model'].unique()):
        sub = df[df['Model'] == m]
        r_in, r_out = expected_rates[m]
        calc = (sub['Prompt Tokens'] * r_in + sub['Completion Tokens'] * r_out) / 1e6
        diff = np.abs(sub['Cost USD'] - calc)
        exact = (diff < 1e-6).sum()
        pct = exact / len(sub) * 100
        mean_diff = diff.mean()
        max_diff = diff.max()
        
        # Check reasons for diff in Llama / Qwen
        provs = sub['Provider Name'].value_counts().to_dict() if 'Provider Name' in sub.columns else {}
        prov_summary = ', '.join([f'{k}({v})' for k, v in provs.items()])
        print(f'{m:26s} | N={len(sub):4d} | ExactMatch: {exact:4d}/{len(sub):4d} ({pct:5.1f}%) | MaxDiff: {max_diff:.6f} | Providers: {prov_summary}')
