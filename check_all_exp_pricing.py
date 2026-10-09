import pandas as pd
import numpy as np

expected_rates = {
    'anthropic-claude-sonnet5': (2.00, 10.00),
    'google-gemini-38-flash': (1.50, 7.50), # promo is (0.75, 3.75)
    'openai-gpt-54': (2.50, 15.00),
    'openai-gpt-54-mini': (0.75, 4.50),
    'qwen-25-vl-72b': (0.80, 1.00),
    'meta-llama4': (0.1875, 0.6525)
}

files = [
    ('EXP 1: Model Benchmark', 'experiment/exp1_model_benchmark.csv'),
    ('EXP 2: Pipeline Comparison', 'experiment/exp2_pipeline_comparison.csv'),
    ('EXP 3: Robustness', 'experiment/exp3_robustness.csv'),
    ('EXP 4: Prompt Sensitivity', 'experiment/exp4_prompt_sensitivity.csv'),
    ('EXP 5: Consistency', 'experiment/exp5_consistency.csv')
]

for label, fpath in files:
    print('=' * 95)
    print(f'AUDIT: {label} ({fpath})')
    print('=' * 95)
    df = pd.read_csv(fpath)
    
    # Check cost columns
    has_cost = 'Cost USD' in df.columns
    has_p_tokens = 'Prompt Tokens' in df.columns
    has_c_tokens = 'Completion Tokens' in df.columns
    
    if not (has_cost and has_p_tokens and has_c_tokens):
        print('  [!] Missing required cost/token columns!')
        continue
        
    for m in sorted(df['Model'].unique()):
        sub = df[df['Model'] == m].dropna(subset=['Cost USD', 'Prompt Tokens', 'Completion Tokens'])
        sub = sub[(sub['Prompt Tokens'] > 0) & (sub['Cost USD'] > 0)]
        if len(sub) == 0:
            print(f'  Model: {m:26s} | No valid rows')
            continue
            
        A = sub[['Prompt Tokens', 'Completion Tokens']].values
        b = sub['Cost USD'].values
        
        res = np.linalg.lstsq(A, b, rcond=None)[0]
        r_in = res[0] * 1e6
        r_out = res[1] * 1e6
        
        exp_in, exp_out = expected_rates.get(m, (None, None))
        
        status = 'UNKNOWN'
        if m == 'google-gemini-38-flash':
            if abs(r_in - 0.75) < 0.08 and abs(r_out - 3.75) < 0.08:
                status = 'PROMO 50% ($0.75 / $3.75)'
            elif abs(r_in - 1.50) < 0.08 and abs(r_out - 7.50) < 0.08:
                status = 'FULL PRICE ($1.50 / $7.50)'
            else:
                status = f'Custom ({r_in:.4f} / {r_out:.4f})'
        elif exp_in is not None:
            if abs(r_in - exp_in) < 0.08 and abs(r_out - exp_out) < 0.08:
                status = 'MATCH'
            else:
                status = f'VARIATION (Actual In:{r_in:.4f}, Out:{r_out:.4f} vs Exp In:{exp_in:.4f}, Out:{exp_out:.4f})'
                
        providers = sub['Provider Name'].value_counts().to_dict() if 'Provider Name' in sub.columns else {}
        prov_str = ', '.join([f'{k}:{v}' for k, v in providers.items()])
        print(f'  {m:26s} | N={len(sub):4d} | In: ${r_in:7.4f} | Out: ${r_out:7.4f} | Status: {status:15s} | Prov: {prov_str}')
