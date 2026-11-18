# オフィス売上ビルド — 動作確認手順

## 事前
1. Supabase SQL Editor で順に実行:
   - `supabase/apply_office_build.sql`
   - `supabase/seed_office_build.sql`
2. `npm run test:office`
3. `npm run typecheck`
4. （任意）`SIM_TRIALS=1000 npm run sim:office` — バランス警告の確認

## ローカル UI（ゲスト）
1. `npm run dev:local` → `/office`
2. チュートリアル「わかった」
3. **デイリー営業**: intro → 診断 → 施策（予算3・最大3枚）→ 得点 → コーチ → ホーム
4. 同じ日にもう一度デイリー → 「もうクリア済み」系エラー
5. **フリー営業**: スタミナ −1 → 最後に仕入れ（ショップ）
6. 図鑑・設定（社長名・ミュート）

## デイリー日付切替の疑似
- `dateKeyFor` / `pickDailyDeal` は JST `YYYY-MM-DD`。
- 単体: `dateKeyFor(new Date("2026-11-17T16:00:00Z"))` → `2026-11-18`
- 別日シード: `pickDailyDeal("2026-11-18")` と `pickDailyDeal("2026-11-19")` で事件・手札が変わること

## スタミナ
- フリー開始で1消費。0のとき開始不可。
- 回復は既存どおり 30分に1（`computeStamina`）

## シーズン締めの疑似
- cron: `GET /api/cron/season-close`（既存、Vercel `0 15 * * *`）
- 元データは **デイリー売上合計**（フリー除外）に変更する方針。ローカルは `company.seasonRevenue` を確認。
- 月始め JST 以外は no-op。疑似するには `seasonKeyFor` / `previousSeasonKey` の単体テストを参照。

## reduced-motion
- OS で「視覚効果を減らす」をオン → 得点演出が即最終値、揺れなし。

## 調子テーマ
- `data-mood` が great/good/low/crisis で背景・パネルが変わること（文字色は維持）。
