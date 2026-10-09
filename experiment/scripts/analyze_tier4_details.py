import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df = pd.read_csv('experiment/exp1_model_benchmark.csv')
df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])
t4 = df[df['Tier'] == 'tier4_ugc']

t4_places = {
    '1.PNG': 'Shibuya Scramble Pedestrian View',
    '2.PNG': 'Pike Place Market Fish Stall Corridor',
    '3.1.PNG': 'Rialto Bridge, Venice',
    '4.PNG': 'Mong Kok Neon & Storefront Strip',
    '5.PNG': 'Hosier Lane Graffiti Alleyway',
    '6.jpg': 'Jemaa el-Fnaa Night Food Market',
    '7.PNG': 'Paris Metro Hector Guimard Entrance',
    '8.1.PNG': 'Kyoto garden - Holland park, London',
    '9.PNG': 'Chatuchak Market Narrow Soi',
    '10.PNG': 'Yaowarat Shophouse Street Food Stall',
    '11.jpg': 'NYC Subway Station Mezzanine',
    '12.PNG': 'Amsterdam Canal Bridge with Bicycles',
    '13.PNG': 'Tsukiji Outer Market Seafood Alley',
    '14.PNG': 'Cafe de Flore Sidewalk Terrace',
    '15.PNG': 'Shinjuku Omoide Yokocho Alley',
    '16.PNG': 'Grand Central Oyster Bar Arched Ramp',
    '17.PNG': 'Marrakech Souk Semmarine Spice Corridor',
    '18.1.PNG': 'Zur Oranienburger Street',
    '19.PNG': 'Shilin Night Market Basement Food Court',
    '20.PNG': 'Havana Malecon Corner with Classic Cars',
    '21.PNG': 'Alfama Tram 28 Tight Curve',
    '22.PNG': 'Powell Street Cable Car Turnaround',
    '23.PNG': 'Myeongdong Cosmetic Shop Facade',
    '24.PNG': 'Degraves Street Outdoor Cafe Strip',
    '25.PNG': 'Dotonbori Canal Lower Boardwalk'
}

stats = []
for img, grp in t4.groupby('Image Name'):
    correct_count = int(grp['is_correct_bool'].sum())
    total_count = len(grp)
    avg_conf = grp['Confidence'].mean()
    failures = grp[grp['Failure Mode'] != 'none']['Failure Mode'].tolist()
    preds = grp[['Model', 'Predicted Place', 'Is Correct']].to_dict('records')
    models_wrong = grp[~grp['is_correct_bool']]['Model'].tolist()
    place_name = t4_places.get(img, img)
    stats.append({
        'img': img,
        'place': place_name,
        'correct': correct_count,
        'total': total_count,
        'acc': round(correct_count / total_count * 100, 1),
        'conf': round(avg_conf, 2),
        'failures': failures,
        'preds': preds,
        'wrong': models_wrong
    })

stats_df = pd.DataFrame(stats).sort_values(by=['correct', 'conf'])

print("=== ALL 25 IMAGES IN TIER 4 (UGC) SORTED BY DIFFICULTY ===")
for _, r in stats_df.iterrows():
    print(f"[{r['img']:8s}] {r['place']:40s} | Score: {r['correct']}/{r['total']} ({r['acc']}%) | Conf: {r['conf']}")
    if r['acc'] < 100:
        print(f"          Wrong Models ({len(r['wrong'])}): {r['wrong']}")
        print(f"          Failures: {r['failures']}")
        for p in r['preds']:
            status = 'CORRECT' if p['Is Correct'] else 'WRONG'
            print(f"            - {p['Model']:25s}: {p['Predicted Place']} [{status}]")
    print("-" * 90)
