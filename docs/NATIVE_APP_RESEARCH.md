# moni アプリ化リサーチ（2026-09-13）

目的: **今の Supabase データはそのまま**で、ストアに出せる「アプリとして押し出せる」体験を作る。Swift 必須ではない。

## 結論（推奨）

**Expo（React Native）+ 既存 Supabase / Vercel API を維持**が、moni にとって最も「最高のアプリ」に近づきやすい。

| 候補 | 判定 | 理由 |
|------|------|------|
| **Expo / React Native** | **本命** | TypeScript・React 資産を活かせる。iOS+Android。Supabase / Daily / Push の公式・準公式パスがある。OTA 更新も可能 |
| Capacitor（WebView包み） | 早さ優先の次点 | 見た目はすぐアプリ化できるが、Next App Router + API ルートとの相性が悪く、静的 export 化が必要。操作感は Web 寄りになりやすい |
| SwiftUI 単独 | iOS 特化ならあり | 品質上限は高いが Android が別途。UI ほぼ全部作り直し。1人開発だと遅い |
| Flutter | 非推奨（この案件） | Dart 新規学習。既存 React/TS と共有しづらい |
| PWA のみ | 「押し出し」不足 | 既に軽くあるが、App Store での存在感・通知・カメラ/通話のネイティブ感で不利 |

「最高」= ネイティブ操作感 + 両ストア + 今のデータ継続 + 開発速度のバランス、と置くと **Expo が最適**。

---

## 何を残すか / 何を作り直すか

### 残す（データ・バックエンド）
- Supabase: Auth / Postgres / RLS / Realtime / Storage（現行プロジェクトそのまま）
- Vercel 上の `/api/*`（AI、招待、Daily ルーム発行、メール、cron など）
- ドメインモデル・テーブル設計

### アプリ側で新しく作る
- 画面（Expo Router + NativeWind など）
- 認証の端末保存（`expo-secure-store`）。Web の cookie 方式とは別経路
- API 呼び出しは **Bearer トークン**（モバイル）／必要なら Web も揃える
- Push: Web Push → **Expo Notifications（APNs / FCM）**
- 通話: Daily の **React Native SDK**（Expo は development build 必須、Expo Go だけでは不可）

### そのまま移植しにくい（段階的に）
1. WebGL プロジェクト立方体 → 最初は 2D カルーセル / カード。後で SceneKit 相当 or 簡略 3D
2. ホワイトボード・DnD かんばん → v2 以降。初期は一覧・詳細中心
3. 巨大な `page.tsx` ホーム → 機能を分割してアプリ用に再設計（コピー禁止）

---

## 推奨アーキテクチャ

```
[ iOS / Android Expo app ]     [ 既存 Web moni (Vercel) ]
            \                       /
             \                     /
              v                   v
         同じ Supabase project + 同じ Vercel API
```

- モノレポ想定: `apps/web`（現行）+ `apps/mobile`（Expo）+ 将来 `packages/shared`（型・API クライアント・バリデーション）
- 初期は monorepo 化せず、`mobile/` をリポジトリ内に追加でも可
- Web は残す（発見・SEO・デスクトップ）。アプリはコア体験（ホーム / プロジェクト / 通知 / DM）から

---

## フェーズ案（明日の議論用）

### Phase 0 — 決定事項（30分）
- iOS のみか、Android も同時か（推奨: **両ストア、Expo 一本**）
- Apple Developer / Google Play アカウントの有無
- 最初の公開範囲（MVP 画面リスト）

### Phase 1 — 骨組み（数日）
- Expo プロジェクト作成（EAS Build）
- Supabase Auth（メール or Google / Apple Sign In）
- 本番 API への Bearer 付き呼び出し確認
- ログイン → プロフィール表示 → プロジェクト一覧

### Phase 2 — コア体験
- ホームフィード（投稿・通知ベル）
- プロジェクト詳細（概要・メンバー・招待応答）
- Push 通知（招待・メッセージ）

### Phase 3 — 差別化
- チャット / Daily 通話
- かんばん・ロードマップのモバイル UI
- 立方体相当の「推しビジュアル」（ネイティブ向けに再設計）

### Phase 4 — ストア提出
- アイコン・スプラッシュ・プライバシーポリシー
- TestFlight → App Store / Play 内部テスト

---

## Capacitor を選ばない主因（moni 固有）

現行は Next.js App Router + 多数の API Route / サーバ寄りの機能。Capacitor は原則 **静的フロント**を包む前提で、

- `output: 'export'` 化や API フォルダの切り離しが必要
- 相対 `/api` が使えず本番 URL 必須
- できても「Web を箱に入れたアプリ」になり、押し出し品質で Expo に負けやすい

プロトタイプだけなら Capacitor / 本番 URL の WKWebView 殻もあり。**本命の製品アプリには不向き**。

---

## Swift を選ぶ場合の条件

次がすべて当てはまるなら SwiftUI もあり:

- iOS のみでよい
- Android は当面不要
- ネイティブ UI / アニメに極端にこだわる
- 数ヶ月かけて UI を全書き直しできる

その場合も **データは Supabase Swift SDK** で同じ DB。バックエンド捨てない。

---

## リスク・前提チェックリスト

- [ ] Apple Developer Program（年額）
- [ ] Google Play Console（一度きり登録料）
- [ ] Supabase の Redirect / OAuth にモバイル用スキーム追加
- [ ] API が Cookie 前提なら Bearer 対応を追加
- [ ] 通話・カメラは Expo development build（EAS）
- [ ] ストア審査用のアカウント削除導線・プライバシー表記

---

## 明日やること（提案）

1. このドキュメントの結論を採択 or 修正（Expo / Capacitor / Swift）
2. MVP 画面を 5 個以内に絞る
3. Expo スケルトン作成 + Supabase ログインまで通す

参考リンク:
- [Expo](https://docs.expo.dev/)
- [Supabase + Expo Auth パターン](https://storyie.com/blog/supabase-auth-nextjs-expo)
- [Daily React Native](https://docs.daily.co/docs/react-native)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
