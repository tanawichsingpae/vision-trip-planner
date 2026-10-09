import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')

# Let's inspect specific images in Tier 3 and Tier 4 to see what models predicted:
test_imgs = [
    # Tier 3 Nature
    'images05.jpg',   # Phu Kradueng
    'images19.jpg',   # Koh Hong
    'images08.jpg',   # Hup Pa Tat
    'images10.jpg',   # Doi Phu Wae
    'images01.jpg',   # Ang Ka Nature Trail
    'images23.1.jpg', # Emerald Cave
    'images17.jpg',   # Phu Chi Dao
    'images25.jpg',   # Railay Beach
    'images13.jpg',   # Haew Narok / Waterfall
    'images02.jpg',   # Teapot Mountain
    # Tier 4 UGC
    '15.PNG',         # Shinjuku Omoide Yokocho
    '16.PNG',         # Grand Central Oyster Bar
    '12.PNG',         # Amsterdam Canal Bridge
    '4.PNG',          # Mong Kok Neon Strip
    '18.1.PNG',       # Zur Oranienburger Street
    '11.jpg',         # NYC Subway Mezzanine
    '20.PNG',         # Havana Malecon Corner
    '28.jpg',         # Mt Fuji UGC / Lake Kawaguchi
    '30.jpg',         # Koh Sichang Unseen Cave
    '29.jpg'          # Khao Chan Kan
]

print("=== DETAILED PREDICTIONS IN EXP1 FOR CANDIDATE IMAGES ===")
for img in test_imgs:
    sub = df1[df1['Image Name'] == img]
    if len(sub) == 0:
        continue
    tier = sub['Tier'].iloc[0]
    preds = sub[['Model', 'Predicted Place', 'Confidence', 'Is Correct']].to_dict('records')
    print(f"\n[{tier}] Image: {img}")
    for p in preds:
        m_short = p['Model'].replace('google-', '').replace('openai-', '').replace('anthropic-', '')
        print(f"  {m_short:22s} | Pred: {p['Predicted Place']:45s} | Conf: {p['Confidence']:.2f} | Corr: {p['Is Correct']}")
