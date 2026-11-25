# -*- coding: utf-8 -*-
"""Recalculate Exp. 6 Cost USD using backend/clip_server.py fallback rates."""
import ast
import csv
import os
import re

EXP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ROOT_DIR = os.path.dirname(EXP_DIR)
BACKEND_PRICING = os.path.join(ROOT_DIR, 'backend', 'clip_server.py')
TARGET = os.path.join(EXP_DIR, 'exp6_plan_evaluation.csv')
RATE_OUT = os.path.join(EXP_DIR, 'exp6_cost_estimation_rates.csv')

# Exp. 6 CSV model IDs mapped to the matching backend pricing key.
PRICING_KEY_BY_MODEL = {
    'anthropic-claude-sonnet5': 'anthropic/claude-sonnet-5',
    'google-gemini-38-flash': 'gemini-3.8-flash',
    'meta-llama4': 'llama-4-maverick',
    'openai-gpt-54': 'openai/gpt-5.4',
    'openai-gpt-54-mini': 'openai/gpt-5.4-mini',
    'qwen-38-flash': 'qwen3.8-flash',
}

def parse_backend_pricing(path):
    source = open(path, encoding='utf-8').read()
    match = re.search(r'BENCHMARK_MODEL_PRICING\s*=\s*(\{.*?\})\s*\n\s*\n', source, re.S)
    if not match:
        raise RuntimeError('Could not find BENCHMARK_MODEL_PRICING in backend/clip_server.py')
    return ast.literal_eval(match.group(1))

def as_int(value, field, row):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        raise ValueError(f'Missing/invalid {field} for Request ID {row.get("Request ID", "")}')

pricing = parse_backend_pricing(BACKEND_PRICING)
with open(TARGET, encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
    original_fields = list(rows[0].keys())

if not rows:
    raise RuntimeError('Exp. 6 CSV is empty')
for field in ['Cost USD', 'Cost Estimate Basis']:
    if field not in original_fields:
        original_fields.append(field)

by_model = {}
for row in rows:
    model = row['Model']
    key = PRICING_KEY_BY_MODEL.get(model)
    if not key or key not in pricing:
        raise ValueError(f'No backend pricing key for Exp. 6 model {model!r}')
    input_rate, output_rate = pricing[key]
    p_tokens = as_int(row.get('Prompt Tokens'), 'Prompt Tokens', row)
    c_tokens = as_int(row.get('Completion Tokens'), 'Completion Tokens', row)
    # Match calculate_fallback_cost: USD per 1M input/output tokens, rounded to 7 decimals.
    cost = round((p_tokens * input_rate + c_tokens * output_rate) / 1_000_000.0, 7)
    row['Cost USD'] = f'{cost:.7f}'
    row['Cost Estimate Basis'] = 'Fallback estimate: backend/clip_server.py calculate_fallback_cost; usage.cost not recorded in Exp. 6'
    by_model.setdefault(model, {'key': key, 'input_rate': input_rate, 'output_rate': output_rate, 'costs': []})['costs'].append(cost)

with open(TARGET, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=original_fields, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)

with open(RATE_OUT, 'w', encoding='utf-8-sig', newline='') as f:
    fields = ['Exp6 Model', 'Backend Pricing Key', 'Input USD per 1M Tokens', 'Output USD per 1M Tokens',
              'Exp6 Requests', 'Exp6 Estimated Cost USD', 'Mean USD per Request',
              'Cost per 1000 Queries USD', 'Pricing Source', 'Note']
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for model in sorted(by_model):
        item = by_model[model]
        costs = item['costs']
        n = len(costs)
        total = sum(costs)
        writer.writerow({
            'Exp6 Model': model,
            'Backend Pricing Key': item['key'],
            'Input USD per 1M Tokens': f'{item["input_rate"]:.2f}',
            'Output USD per 1M Tokens': f'{item["output_rate"]:.2f}',
            'Exp6 Requests': n,
            'Exp6 Estimated Cost USD': f'{total:.7f}',
            'Mean USD per Request': f'{total / n:.7f}',
            'Cost per 1000 Queries USD': f'{(total / n) * 1000:.4f}',
            'Pricing Source': 'backend/clip_server.py: BENCHMARK_MODEL_PRICING / calculate_fallback_cost',
            'Note': 'Estimated fallback amount; Exp. 6 CSV did not contain OpenRouter usage.cost.',
        })

print('Recalculated', len(rows), 'Exp. 6 requests')
print('Total estimated USD:', f'{sum(float(r["Cost USD"]) for r in rows):.7f}')
for model in sorted(by_model):
    costs = by_model[model]['costs']
    print(model, 'rate=', by_model[model]['input_rate'], '/', by_model[model]['output_rate'],
          'sum=', f'{sum(costs):.7f}', 'mean=', f'{sum(costs)/len(costs):.7f}',
          'per_1000=', f'{sum(costs)/len(costs)*1000:.4f}')
