import sys
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

df1 = pd.read_csv('experiment/exp1_model_benchmark.csv')
for img in ['images05.jpg', 'images19.jpg', 'images08.jpg', 'images10.jpg', 'images01.jpg', 'images23.1.jpg', 'images17.jpg', 'images25.jpg', 'images13.jpg']:
    sub = df1[(df1['Image Name'] == img) & (df1['Tier'] == 'tier3_nature')]
    preds = sub[['Model', 'Predicted Place', 'Confidence', 'Is Correct']].to_dict('records')
    print(f"\nImage: {img}")
    for p in preds:
        m = p['Model'].replace('google-', '').replace('openai-', '').replace('anthropic-', '')
        print(f"  {m:18s} | Pred: {p['Predicted Place']:40s} | Conf: {p['Confidence']:.2f} | Corr: {p['Is Correct']}")
