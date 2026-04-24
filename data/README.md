Place the downloaded Kaggle dataset file in this folder.

Supported formats for the training script:

- `.csv`
- `.xlsx`
- `.xls`
- `.json`

Example:

```powershell
python backend\scripts\train_bert.py --data data\mental_health_sentiment.csv
```

If your columns are not auto-detected:

```powershell
python backend\scripts\train_bert.py --data data\mental_health_sentiment.csv --text-column "statement" --label-column "sentiment"
```
