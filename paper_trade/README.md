# 日本株ペーパートレード実験アプリ

売買ルールで日本株を**仮想売買**し、TOPIX連動ETF（`1306.T`）に勝てるかを検証するローカル専用アプリです。

- 実際の証券会社APIやお金には接続しません
- シグナルは当日終値で判定し、約定は翌営業日の始値とします（未来データ不使用）
- データ保存は SQLite（`trades.db`）

## 必要環境

- Python 3.11 以上
- 外部ライブラリ: `yfinance`, `pandas`, `matplotlib` のみ

## セットアップ

```bash
cd paper_trade

# （推奨）仮想環境
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

設定値（銘柄・初期資金・手数料など）はすべて `config.py` にあります。

## フォルダ構成

| ファイル | 役割 |
|---|---|
| `config.py` | 銘柄リスト、初期資金100万円、上限比率、手数料、スリッページ |
| `data.py` | yfinance で日次株価取得 + `cache/` へ保存 |
| `strategy.py` | 売買シグナル（初期: 25日/75日移動平均クロス） |
| `risk.py` | 1銘柄上限・全体-15%停止（戦略と独立） |
| `backtest.py` | 過去3年バックテスト + 比較グラフ |
| `db.py` | SQLite の初期化・読み書き |
| `paper_trade.py` | 毎日の仮想売買 |
| `report.py` | 資産推移・成績サマリー |
| `logging_utils.py` | エラー時も止まらずログへ記録 |

実行で増えるもの（Git管理外）:

- `cache/` … 株価CSVキャッシュ
- `logs/app.log` … 実行ログ
- `output/` … グラフPNG
- `trades.db` … 仮想売買DB

## ステップごとの動作確認

順番に実行すると、各部品が単体で動くことを確認できます。

```bash
# 1. 株価取得とキャッシュ
python3 data.py

# 2. 売買シグナル
python3 strategy.py

# 3. リスク管理の単体確認
python3 risk.py

# 4. 過去3年バックテスト（指標表示 + output/backtest_vs_1306.png）
python3 backtest.py

# 5. 仮想売買を1回実行（trades.db に記録）
python3 paper_trade.py

# 6. 成績サマリーとグラフ（output/paper_vs_1306.png）
python3 report.py
```

## 毎日の実行方法

相場が終わったあと（または翌営業日の朝）に:

```bash
cd paper_trade
source .venv/bin/activate   # 使っている場合
python3 paper_trade.py      # シグナル判定・予約約定・DB記録
python3 report.py           # 成績確認
```

cron 例（平日 18:30）:

```cron
30 18 * * 1-5 cd /path/to/paper_trade && /path/to/paper_trade/.venv/bin/python paper_trade.py >> logs/cron.log 2>&1
```

## ルールの要点

1. **終値で判定 → 翌営業日始値で約定**  
   `paper_trade.py` は予約注文（`pending_orders`）をDBに残し、翌日以降の始値で埋めます。
2. **1銘柄上限 20%**  
   超える買いは `risk.py` が拒否または数量縮小します。
3. **全体損失 -15% で停止**  
   初期資金比で資産が 85% 以下になったら全決済予約し、新規シグナルを止めます。
4. **エラーはログへ**  
   例外が出ても可能なら処理を続け、`logs/app.log` に残します。

## 戦略の差し替え方

1. `strategy.py` に「DataFrame → シグナル Series（1/-1/0）」の関数を追加
2. `get_strategy()` 内の辞書に登録
3. デフォルト名を新しい戦略に変更

`backtest.py` / `paper_trade.py` 側は原則いじりません。

## 注意

- Yahoo Finance（yfinance）の取得制限や欠損で、たまにデータが空になることがあります。その場合は時間をおいて `python3 data.py` を再実行してください。
- これは学習・検証用の仮想売買です。投資助言ではありません。
