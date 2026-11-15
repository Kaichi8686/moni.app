# オフィス機能 — 動作確認手順

## 事前準備

1. Supabase に `supabase/apply_office.sql` を適用（旧 `idea_league_*` は触らない）
2. 続けて `supabase/apply_office_industry.sql`（業種カラム・会社名1〜12字）
3. 環境変数: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-5-5`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
4. `npm run dev:local` → `http://127.0.0.1:3002/idea?spark=office`

未ログイン時はブラウザ localStorage（`moni.office.v1`）で遊べる。

## 基本フロー

1. 会社名（1〜12字）＋業種6種から1つ選んで作成
2. 既存で業種未設定の会社は、次回に業種だけ補完
3. 新事件時のみオフィス演出 → 事件カードが降りてくる（再訪の open は演出なし）
4. 5〜300文字で回答 → 提出 → 採点・コイン・スタミナ
5. 「次の事件へ」で新事件＋演出
6. 「順位」タブで今月ランキング・のんびりモード切替
7. `prefers-reduced-motion` ではループアニメと事件FXを抑制

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
