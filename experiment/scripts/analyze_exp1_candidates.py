import pandas as pd

df = pd.read_csv('experiment/exp1_model_benchmark.csv')
df['is_correct_bool'] = df['Is Correct'].astype(str).str.lower().isin(['true', '1'])

TIER_NAMES = {
    'tier1_iconic': [
        "1. Eiffel Tower (images01.1.jpg)", "2. Colosseum (images02.jpg)", "3. Taj Mahal (images03.1.jpg)",
        "4. Statue of Liberty (images04.1.jpg)", "5. Sydney Opera House (images05.1.jpg)", "6. Big Ben (images06.1.jpg)",
        "7. Great Pyramid of Giza (images07.1.jpg)", "8. Sagrada Familia (images08.1.jpg)", "9. Christ the Redeemer (images09.1.jpg)",
        "10. Burj Khalifa (images10.1.jpg)", "11. Saint Basil's Cathedral (images11.1.jpg)", "12. Wat Phra Kaew (images12.1.jpg)",
        "13. Leaning Tower of Pisa (images13.1.jpg)", "14. Parthenon (images14.1.jpg)", "15. Forbidden City (images15.1.jpg)",
        "16. Empire State Building (images16.1.jpg)", "17. Golden Gate Bridge (images17.1.jpg)", "18. Hagia Sophia (images18.1.jpg)",
        "19. Petronas Twin Towers (images19.1.jpg)", "20. Marina Bay Sands (images20.1.jpg)", "21. Tower Bridge (images21.1.jpg)",
        "22. Brandenburger Tor (images22.1.jpg)", "23. Great Wall of China (images23.1.jpg)", "24. St. Peter's Basilica (images24.1.jpg)",
        "25. Gyeongbokgung (images25.1.jpg)"
    ],
    'tier2_longtail': [
        "1. Mont-Saint-Michel (images01.1.jpg)", "2. Neuschwanstein Castle (images02.1.jpg)", "3. Fushimi Inari (images03.1.jpg)",
        "4. Pena Palace (images04.1.jpg)", "5. Hallstatt (images05.1.jpg)", "6. Bran Castle (images06.1.jpg)",
        "7. Batu Caves (images07.1.jpg)", "8. Wat Phra That Doi Suthep (images08.1.jpg)", "9. Sanctuary of Truth (images09.1.jpg)",
        "10. Borobudur (images10.1.jpg)", "11. Potala Palace (images11.1.jpg)", "12. Alhambra (images12.1.jpg)",
        "13. St. Vitus Cathedral (images13.1.jpg)", "14. Shwedagon Pagoda (images14.1.jpg)", "15. Himeji Castle (images15.1.jpg)",
        "16. Charles Bridge Tower (images16.1.jpg)", "17. Mezquita de Cordoba (images17.1.jpg)", "18. Amber Fort (images18.1.jpg)",
        "19. Fisherman's Bastion (images19.1.jpg)", "20. Blue Mosque (images20.1.jpg)", "21. Great Mosque of Djenne (images21.1.jpg)",
        "22. Dubrovnik City Walls (images22.1.jpg)", "23. Registan Square (images23.1.jpg)", "24. Lotus Temple (images24.1.jpg)",
        "25. Wat Rong Khun (images25.1.jpg)"
    ],
    'tier3_nature': [
        "1. Ang Ka Nature Trail (images01.jpg)", "2. Teapot Mountain (images02.jpg)", "3. Yakushima (images03.jpg)",
        "4. Jiuzhaigou (images04.jpg)", "5. Phu Kradueng (images05.jpg)", "6. Tsingy de Bemaraha (images06.jpg)",
        "7. Monteverde (images07.jpg)", "8. Hup Pa Tat (images08.jpg)", "9. Doi Mon Jong (images09.jpg)",
        "10. Doi Phu Wae (images10.jpg)", "11. Dixam Plateau (images11.jpg)", "12. Vinicunca (images12.jpg)",
        "13. Haew Narok (images13.jpg)", "14. Torres del Paine (images14.jpg)", "15. Trolltunga (images15.jpg)",
        "16. Mokoju Peak (images16.png)", "17. Phu Chi Dao (images17.jpg)", "18. Fairy Stream (images18.jpg)",
        "19. Koh Hong (images19.jpg)", "20. El Nido (images20.jpg)", "21. Similan Islands (images21.jpg)",
        "22. Twelve Apostles (images22.jpg)", "23. Emerald Cave (images23.1.jpg)", "24. Koh Khai (images24.jpg)",
        "25. Railay Beach (images25.jpg)"
    ],
    'tier4_ugc': [
        "1. Shibuya Scramble (1.PNG)", "2. Pike Place Market (2.PNG)", "3. Rialto Bridge (3.1.PNG)",
        "4. Mong Kok (4.PNG)", "5. Hosier Lane (5.PNG)", "6. Jemaa el-Fnaa (6.jpg)",
        "7. Paris Metro (7.PNG)", "8. Kyoto Garden London (8.1.PNG)", "9. Chatuchak Market (9.PNG)",
        "10. Yaowarat Shophouse (10.PNG)", "11. NYC Subway (11.jpg)", "12. Amsterdam Canal (12.PNG)",
        "13. Tsukiji Market (13.PNG)", "14. Cafe de Flore (14.PNG)", "15. Shinjuku Omoide (15.PNG)",
        "16. Grand Central Oyster (16.PNG)", "17. Marrakech Souk (17.PNG)", "18. Zur Oranienburger (18.1.PNG)",
        "19. Shilin Night Market (19.PNG)", "20. Havana Malecon (20.PNG)", "21. Alfama Tram 28 (21.PNG)",
        "22. Powell Street Cable Car (22.PNG)", "23. Myeongdong Cosmetic (23.PNG)", "24. Degraves Street (24.PNG)",
        "25. Dotonbori (25.PNG)"
    ]
}

print("=== EXP1 DETAILED IMAGE BREAKDOWN PER TIER ===")
for tier in ['tier1_iconic', 'tier2_longtail', 'tier3_nature', 'tier4_ugc']:
    print(f"\n" + "="*80)
    print(f"TIER: {tier.upper()}")
    print("="*80)
    sub = df[df['Tier'] == tier]
    img_stats = sub.groupby('Image Name').agg(
        total=('Model', 'count'),
        correct=('is_correct_bool', 'sum'),
        acc=('is_correct_bool', lambda x: round(x.mean() * 100, 1)),
        avg_conf=('Confidence', lambda x: round(x.mean(), 2)),
        avg_latency=('Time MS', lambda x: round(x.mean(), 0)),
        failures=('Failure Mode', lambda x: list(x[x != 'none']))
    ).reset_index()
    img_stats = img_stats.sort_values(by=['correct', 'avg_conf'], ascending=[True, True])
    
    for _, r in img_stats.iterrows():
        img = r['Image Name']
        fail_summary = f", Failures: {r['failures']}" if r['failures'] else ""
        print(f"  {img:16s} | Score: {r['correct']}/{r['total']} ({r['acc']}%) | AvgConf: {r['avg_conf']} | Lat: {r['avg_latency']}ms {fail_summary}")
