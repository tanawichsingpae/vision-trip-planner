import os
import sys
import json
from collections import defaultdict

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

JSON_PATH = os.path.join(os.path.dirname(__file__), 'gemini_exp4_analysis.json')
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Loaded {len(data)} images analysis.\n")

# 1. Check images where OTHER models had False
print("=" * 80)
print("1. IMAGES WHERE OTHER MODELS FAILED (Is Correct == False):")
print("=" * 80)

images_with_other_failures = []
for item in data:
    failures = [p for p in item['other_preds'] if str(p['Is Correct']).lower() in ['false', '0']]
    if failures:
        images_with_other_failures.append((item, failures))

print(f"Total images with other model failures: {len(images_with_other_failures)} / 40\n")

for item, failures in images_with_other_failures:
    print(f"Image: {item['image_name']} | Tier: {item['tier']}")
    print(f"  Gemini answers:")
    for v, pred in item['gemini_preds'].items():
        print(f"    {v}: {pred}")
    print(f"  Other models failed count: {len(failures)}")
    for f_item in failures:
        print(f"    Model: {f_item['Model']} [{f_item['Prompt Variant ID']}] -> '{f_item['Predicted Place']}' (Failure: {f_item['Failure Mode']})")
    print("-" * 60)

# 2. Check all unique places predicted by Gemini across the 40 images
print("\n" + "=" * 80)
print("2. SUMMARY OF ALL 40 IMAGES: GEMINI vs CONSENSUS OF OTHER MODELS")
print("=" * 80)

for item in data:
    # get consensus of other models on P1
    p1_others = [p['Predicted Place'] for p in item['other_preds'] if p['Prompt Variant ID'] == 'P1']
    gemini_p1 = item['gemini_preds'].get('P1')
    gemini_p4 = item['gemini_preds'].get('P4')
    
    # Are there any differences between Gemini's predictions across P1-P5?
    g_unique = set(item['gemini_preds'].values())
    
    # Print concise summary
    print(f"[{item['tier']}] {item['image_name']}:")
    print(f"   Gemini P1: {gemini_p1} | P4: {gemini_p4}")
    print(f"   Gemini all variants: {list(item['gemini_preds'].items())}")
    print(f"   Others P1: {p1_others}")
    print()
