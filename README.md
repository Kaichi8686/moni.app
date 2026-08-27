# moni

ここが **moni アプリ本体**です。

- GitHub: [Kaichi8686/moni.app](https://github.com/Kaichi8686/moni.app)（リポジトリ名が `moni.app` なだけで、フォルダと中身は同じ）
- 公開サイト: Vercel
- ユーザーデータ: Supabase（端末をまたいで共通）

```bash
npm install
npm run dev
```

## 他のPCで編集する

1. 同じ GitHub アカウントでリポジトリを clone（または pull）
2. Cursor で **このリポジトリのフォルダ**を開く
3. `.env.local` は秘密情報なので Git に入っていません。Vercel の Production 環境変数からコピーするか、手元のPCから安全に共有する

```bash
git clone https://github.com/Kaichi8686/moni.app.git moni
cd moni
npm install
# .env.local を用意してから
npm run dev
```

最新の作業ブランチが `main` 以外のときは:

```bash
git fetch
git checkout <ブランチ名>
git pull
```

## スマホの Cursor で編集する

ローカルだけのチャットはスマホに出ません。**Cloud Agents** を使います。

1. PCでコードを **GitHub に push 済み**にする（未コミット変更はクラウドに乗らない）
2. Cursor Desktop → `Cmd+Shift+P` → **Open Agents Window**
3. 入力欄のモードで **Cloud** を選ぶか、会話を **Move to Cloud**
4. スマホで同じ Cursor アカウント → [cursor.com/agents](https://cursor.com/agents) または iOS アプリの inbox から続き

Cloud Agents の条件（目安）: 有料プラン、Privacy Mode（Legacy 以外）、GitHub 連携済み。
