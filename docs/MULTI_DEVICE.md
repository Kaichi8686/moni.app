# 他のPC・スマホから moni を編集する

コードの共有先は **GitHub: Kaichi8686/moni.app** です。  
ユーザーの投稿データは **Supabase**（端末共通）。  
`.env.local` の秘密鍵だけは Git に入れないので、各PCで用意します。

## 他のPC（Cursor Desktop）

1. GitHub で `Kaichi8686/moni.app` を clone
2. Cursor でそのフォルダを開く（名前は `moni` でも `moni.app` でも中身は同じ）
3. `.env.local` を用意（このPCからコピー、または Vercel → Project → Settings → Environment Variables）
4. `npm install` → `npm run dev`

最新コードを取る:

```bash
git pull
```

作業ブランチがある場合は `git checkout <ブランチ>` してから pull。

## スマホ（Cursor）

1. **先にPCで GitHub へ push 済み**にする
2. Cursor Desktop → `Cmd+Shift+P` → **Open Agents Window**
3. 入力欄で **Cloud** を選ぶ（または Move to Cloud）
4. スマホで同じアカウント → [cursor.com/agents](https://cursor.com/agents) または iOS アプリ

Cloud は GitHub 上のコードを見るので、**push してない変更はスマホから見えません。**

## いまやること（このMac）

GitHub への push 認証が切れている場合:

1. ターミナルで GitHub にログインし直す（GitHub Desktop / `gh auth login` / SSH 鍵）
2. 次を実行:

```bash
cd ~/moni
git push -u origin HEAD
```

成功すると、他PC・Cloud Agents から同じコードにアクセスできます。
