# moni

> **ここが現行アプリのコード本体です。**  
> 親フォルダ `moni/` 直下の古い `index.html` 試作は `_archive/legacy-static-mvp/` に移してあります（編集しない）。

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

### 手元で全部チェック（推奨）

```bash
npm run check
# または
./scripts/check.sh
```

`lint` → `typecheck`（`tsc --noEmit`）→ `build` の順です。

### 本番相当で起動（build/start）

```bash
npm run build
npm run start:local
```

## Supabase設定

1. `.env.example` を `.env.local` にコピー
2. `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
3. Supabase SQL Editor で `supabase/schema.sql` を実行（運営管理者は `supabase/apply_app_admin.sql` も実行）
4. Supabase Auth > Providers で Google を有効化
5. Google Cloud Console で OAuthクライアントを作成し、SupabaseにClient ID/Secretを設定
6. Redirect URL をSupabase指定URLと `http://localhost:3000` に合わせる

## 公開（Vercel推奨）

- **Dependabot**: 週次で npm 依存の更新 PR が作られます（`.github/dependabot.yml`）。
- **GitHub Actions（任意）**: 雛形は `docs/github-actions-ci.yml` です。`.github/workflows/ci.yml` に置くと main / PR / 手動（`workflow_dispatch`）で `lint` → `typecheck` → `build` が走ります。  
  **注意:** 多くの Personal Access Token ではワークフロー更新が拒否されます。GitHub Web でファイルを追加するか、トークンに **`workflow` スコープ**（Fine-grained なら **Contents** と **Workflows** 書き込み）を付けてから push してください。不要なら Vercel のビルドと `npm run check` で代替できます。
- VercelにリポジトリをImportしてデプロイ
- VercelのEnvironment Variablesに以下を設定
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY`（使う場合のみ）
  - `OPENAI_MODEL`（任意。未設定時は `gpt-4.1-mini`）
  - `ANTHROPIC_API_KEY`（プロジェクトの AI コーチ。未設定ならサンプル応答）
  - `ANTHROPIC_MODEL`（任意。未設定時はサーバー既定モデル）
  - `DAILY_API_KEY`（Daily REST API key）
  - `DAILY_DOMAIN`（例: `your-team.daily.co`）
  - `SUPABASE_SERVICE_ROLE_KEY`（運営ダッシュボードのユーザー集計。Settings → API）
  - `APP_ADMIN_EMAILS`（任意。運営管理者メール。未設定時は `kigyouman8686@gmail.com`）
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
- 通話: Dailyでアプリ内通話（チャット画面内で参加）
- プロジェクトルーム: ホーム（今日・週ダッシュ・ストリーク）／ロードマップ／タスク・予定／オンボード／`coaching_context` に週目標・メモを保存

## 次の実装優先（本番化）

- Presence付きRealtimeチャット（入室中ユーザー表示）
- 通話SDK（Daily or Agora）実装
- 運営ダッシュボードの拡張（イベントトラッキングのサーバー集計など）
- 子ども向けAI安全フィルタ（モデレーション + NGワード制御）
