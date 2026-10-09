import json
import sys
import os

OUT_PATH = os.path.join(os.path.dirname(__file__), 'report_output.txt')
out_f = open(OUT_PATH, 'w', encoding='utf-8')

def p(*args):
    print(*args, file=out_f)

with open(r'd:\Pixinerary_model_test\experiment\scripts\detailed_comparison.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Categories of differences:
# 1. Images where Gemini answered correctly but other models failed (disagreement due to failure of other models)
# 2. Images where Gemini gave more granular/specific names (e.g. specific gate, specific street, specific mountain peak) compared to other models
# 3. Images where Gemini differed across prompt variants (e.g. P1 vs P2 vs P3 vs P4 vs P5)
# 4. Any questionable/incorrect answers by Gemini

p("================================================================================")
p("1. GEMINI CORRECT WHILE OTHER MODELS FAILED (DISAGREEMENTS)")
p("================================================================================")
for item in data:
    if item['other_failures']:
        p(f"\n[Image: {item['image']}] Tier: {item['tier']}")
        p(f"  Gemini Answer (P1): {item['gemini_preds'].get('P1')}")
        p(f"  Gemini Answer (P4 - Thai): {item['gemini_preds'].get('P4')}")
        p(f"  Gemini All Prompts: {item['gemini_preds']}")
        p(f"  Other Models Failures ({len(item['other_failures'])} failures):")
        for f in item['other_failures']:
            p(f"    - {f['model']} [{f['variant']}]: '{f['predicted']}' ({f['failure_mode']})")

p("\n================================================================================")
p("2. GRANULARITY & SPECIFICITY DIFFERENCES (Gemini more specific than others)")
p("================================================================================")
for item in data:
    g_p1 = item['gemini_preds'].get('P1', '')
    o_p1 = item['other_p1']
    if not item['other_failures']:
        p(f"\n[Image: {item['image']}] Tier: {item['tier']}")
        p(f"  Gemini (P1): {g_p1}")
        p(f"  Gemini (P4): {item['gemini_preds'].get('P4')}")
        p(f"  Others (P1): {o_p1}")

out_f.close()
print("Report generated successfully.")
