# オフィス機能 — 動作確認手順

## 事前準備

1. Supabase に `supabase/apply_office.sql` を適用する（旧 `idea_league_*` は触らない）
2. 環境変数: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-5-5`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
3. `npm run dev:local` → `http://127.0.0.1:3002/idea?spark=office`

未ログイン時はブラウザ localStorage（`moni.office.v1`）で遊べる。

## 基本フロー

1. 会社名を入力して作成（必須・自動命名なし）
2. 事件が表示される → 5〜300文字で回答 → 提出
3. 採点（solve/fun/feasible）・コイン加算・スタミナ -1 を確認
4. 「次の事件へ」で新しい事件（未解決が1件のまま）
5. 「順位」タブで今月ランキング・のんびりモード切替

## スタミナの疑似回復

保存は `stamina` と `stamina_updated_at` のみ。

ローカルの場合、DevTools で:

```js
const s = JSON.parse(localStorage.getItem('moni.office.v1'))
s.company.stamina = 0
s.company.stamina_updated_at = new Date(Date.now() - 31*60*1000).toISOString()
localStorage.setItem('moni.office.v1', JSON.stringify(s))
location.reload()
```

→ 約1回復した状態になる（30分で1）。

## シーズン締めの疑似実行

本番 cron: 毎日 `15:00 UTC`（JST 0:00）。JST が1日のときだけ前月を締める。

手動（service role 必須）:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3002/api/cron/season-close?forceSeasonKey=2026-10"
```

`forceSeasonKey` で任意シーズンを冪等に締められる。二重実行は `office_season_closures` でスキップ。

## 単体テスト

```bash
npm run test:office
```

## 旧リーグ

- コード: `src/components/idea-league/*`, `src/lib/idea-league/*` は残置
- DB: `idea_league_*` / `profiles.idea_league_*` は削除しない
- URL: `/league`, `?spark=league` はオフィスへリダイレクト／寄せる
