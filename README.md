# moni

ここが **moni アプリ本体**です。

- GitHub: [Kaichi8686/moni.app](https://github.com/Kaichi8686/moni.app)（リポジトリ名が `moni.app` なだけで、フォルダと中身は同じ）
- 公開サイト: Vercel
- ユーザーデータ: Supabase（端末をまたいで共通）

```bash
npm install
npm run dev
```

## 他のPC・スマホから編集する

手順の詳細は [`docs/MULTI_DEVICE.md`](docs/MULTI_DEVICE.md) を見てください。

要点だけ:
- **他のPC**: GitHub の `moni.app` を clone / pull して Cursor で開く
- **スマホ**: Cloud Agents（コードは先に GitHub へ push が必要）
- **データ（プロジェクト等）**: Supabase なので端末をまたいで同じ
- **`.env.local`**: 秘密情報のため Git 外。各PCで用意する

```bash
npm install
npm run dev
```
