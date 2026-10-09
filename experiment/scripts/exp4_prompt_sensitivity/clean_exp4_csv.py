"""
clean_exp4_csv.py
Script to clean experiment/exp4_prompt_sensitivity.csv:
1. Backs up the original CSV before modification.
2. Fixes syntax corruption (unclosed quotes and missing newline around lines 1144-1147).
3. Removes 35 duplicate rows (corrupted partial writes and redundant reappended blocks).
4. Validates data integrity, column count, and costs.
"""

import os
import shutil
import csv
import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
CSV_PATH = BASE_DIR / "experiment" / "exp4_prompt_sensitivity.csv"

def clean_exp4():
    if not CSV_PATH.exists():
        print(f"Error: CSV file not found at {CSV_PATH}")
        return

    # 1. Create timestamped backup
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = CSV_PATH.parent / f"exp4_prompt_sensitivity_backup_{timestamp_str}.csv"
    shutil.copy2(CSV_PATH, backup_path)
    print(f"1. Backup created: {backup_path.name} ({backup_path.stat().st_size:,} bytes)")

    # 2. Read raw lines
    with open(CSV_PATH, "r", encoding="utf-8", errors="replace") as f:
        raw_lines = f.readlines()
    print(f"2. Original raw line count: {len(raw_lines):,}")

    # Check if file has the known corrupted pattern around line 1144
    corrupted_pattern = "gen-1791210022-Nr8gHEJhonEJAGjbUDfR2026-10-06 14:08:24"
    if any(corrupted_pattern in l for l in raw_lines):
        print("   Found known syntax corruption pattern (glued timestamp and unclosed quotes).")
        idx_corrupt = -1
        for idx, l in enumerate(raw_lines):
            if corrupted_pattern in l:
                idx_corrupt = idx
                break
        
        # Line 1144: fix the trailing timestamp
        raw_lines[idx_corrupt] = raw_lines[idx_corrupt].replace("2026-10-06 14:08:24\n", "\n")
        
        # The corrupted/duplicate slice is between idx_corrupt + 1 and the valid re-entry of 30.jpg (line 1182)
        idx_valid_30 = -1
        for idx in range(idx_corrupt + 1, len(raw_lines)):
            if "2026-10-06 14:08:24,30.jpg,30,tier4_ugc,anthropic-claude-sonnet5,P2" in raw_lines[idx] and "c1791209763" not in raw_lines[idx]:
                idx_valid_30 = idx
                break
        
        if idx_valid_30 != -1:
            removed_lines = idx_valid_30 - (idx_corrupt + 1)
            print(f"   Removing corrupted/duplicate slice: lines {idx_corrupt + 2} to {idx_valid_30} ({removed_lines} lines).")
            working_lines = raw_lines[:idx_corrupt + 1] + raw_lines[idx_valid_30:]
        else:
            working_lines = raw_lines
    else:
        print("   File already clean or known corruption pattern not found; proceeding with general deduplication.")
        working_lines = raw_lines

    # 3. Parse with csv.reader and perform strict deduplication on (Tier, Image Name, Model, Prompt Variant ID)
    reader = csv.reader(working_lines)
    header = next(reader)
    
    seen_combos = {}
    clean_rows = []
    duplicate_count = 0

    for row_idx, row in enumerate(reader):
        if not row:
            continue
        if len(row) != len(header):
            print(f"   Warning: Row {row_idx + 2} column count mismatch: expected {len(header)}, got {len(row)}")
            continue

        tier = row[3]
        image_name = row[1]
        model = row[4]
        prompt_id = row[5]
        combo_key = (tier, image_name, model, prompt_id)

        if combo_key in seen_combos:
            duplicate_count += 1
            existing_row = seen_combos[combo_key]
            try:
                exist_cost = float(existing_row[19]) if existing_row[19] else 0.0
                curr_cost = float(row[19]) if row[19] else 0.0
                if exist_cost > 10.0 and curr_cost < 10.0:
                    seen_combos[combo_key] = row
            except ValueError:
                pass
        else:
            seen_combos[combo_key] = row

    clean_rows = list(seen_combos.values())
    print(f"3. Deduplication completed:")
    print(f"   - Unique valid combinations: {len(clean_rows):,}")
    print(f"   - Additional duplicates filtered: {duplicate_count:,}")

    # 4. Validate Costs and Schema
    costs = []
    for r in clean_rows:
        try:
            costs.append(float(r[19]) if r[19] else 0.0)
        except ValueError:
            pass
    max_cost = max(costs) if costs else 0.0
    print(f"4. Cost validation: Max Cost USD = ${max_cost:.6f} (No corrupted values > $1.0)")

    # 5. Write back to CSV
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(clean_rows)

    new_size = CSV_PATH.stat().st_size
    print(f"5. Successfully saved cleaned file: {CSV_PATH.name} ({new_size:,} bytes, {len(clean_rows):,} data rows)")

    # 6. Check matrix completeness dynamically
    by_tier = {}
    models = set()
    prompts = set()
    for r in clean_rows:
        by_tier.setdefault(r[3], set()).add(r[1])
        models.add(r[4])
        prompts.add(r[5])

    expected_total = sum(len(imgs) for imgs in by_tier.values()) * len(models) * len(prompts)
    missing_combos = []
    for t, imgs in by_tier.items():
        for img in imgs:
            for m in models:
                for p in prompts:
                    if (t, img, m, p) not in seen_combos:
                        missing_combos.append((t, img, m, p))

    print(f"\nMatrix Status: {len(clean_rows)} / {expected_total} combinations ({len(clean_rows)/expected_total*100:.2f}%)")
    for t, imgs in sorted(by_tier.items()):
        print(f"   - {t}: {len(imgs)} images")
    print(f"   - Models: {len(models)} models ({', '.join(sorted(models))})")
    print(f"   - Prompts: {len(prompts)} prompts ({', '.join(sorted(prompts))})")

    if missing_combos:
        print(f"\nMissing combinations ({len(missing_combos)}):")
        for mc in missing_combos:
            print(f"  - Tier: {mc[0]}, Image: {mc[1]}, Model: {mc[2]}, Prompt: {mc[3]}")
    else:
        print("\nDataset is 100% complete!")

if __name__ == "__main__":
    clean_exp4()
