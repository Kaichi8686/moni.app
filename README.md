# moni

子ども・保護者・投資家/起業家を対象にした、本番向け起業支援アプリの土台です。

## 実装済み

- Next.js + TypeScript + Tailwind
- Supabase接続対応
- Googleログイン（Supabase OAuth）
- メールログイン（Magic Link / Email+Password）
- 6機能UI（記事、AIメンター、マッチング、プログラム、ピッチ、チャット/通話デモ）
- 対象別ビュー切替（子ども / 保護者 / 投資家）

## ローカル起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開く。

### ローカル起動（安定版: EMFILE対策）

開発環境によっては `too many open files (EMFILE)` が出ることがあります。その場合は polling を使う起動に切り替えてください。

```bash
npm run dev:local
```

`http://127.0.0.1:3002` を開く。

### 本番相当で起動（build/start）

```bash
npm run build
npm run start:local
```

## Supabase設定

1. `.env.example` を `.env.local` にコピー
2. `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
3. Supabase SQL Editor で `supabase/schema.sql` を実行
4. Supabase Auth > Providers で Google を有効化
5. Google Cloud Console で OAuthクライアントを作成し、SupabaseにClient ID/Secretを設定
6. Redirect URL をSupabase指定URLと `http://localhost:3000` に合わせる

## 公開（Vercel推奨）

- VercelにリポジトリをImportしてデプロイ
- VercelのEnvironment Variablesに以下を設定
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY`（使う場合のみ）
  - `OPENAI_MODEL`（任意。未設定時は `gpt-4.1-mini`）
- Supabase Auth > URL Configuration の Site URL をVercelのURLに設定
- Google Provider の Redirect URL も同様に本番URLに合わせる

## 現在のDB接続状況

- 記事機能: Supabase `articles` へ読み書き対応
- 記事機能: 投資家側で `draft/published` 切替対応
- ピッチ機能: Supabase `pitches` へ読み書き対応（応援数更新含む）
- チャット機能: Supabase `chat_messages` へ送信/取得 + Realtime受信
- 既読/未読: Supabase `chat_reads` で最終既読時刻を保持
- 対象ロール・プロフィール: Supabase `profiles`（表示名/目標）へ保存/読込対応
- マッチング機能: Supabase `profiles.goal` 検索で実データマッチング
- AIメンター: `/api/mentor` 経由でAI応答（`OPENAI_API_KEY` 未設定時は安全フォールバック）
- AIメンター（アイデア相談）: 課題定義→仮説→検証→次アクションの思考フレームを自動適用
- 通話: JitsiルームURLを生成して即参加可能

## 次の実装優先（本番化）

- Presence付きRealtimeチャット（入室中ユーザー表示）
- 通話SDK（Daily or Agora）実装
- 管理者ロールと審査ワークフロー
- 子ども向けAI安全フィルタ（モデレーション + NGワード制御）
