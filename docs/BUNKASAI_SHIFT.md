# 文化祭シフト（シンプル版）の公開手順

URLを開いて「このシフトに入る」を押すだけの、ログイン不要シフト表です。

- 画面: `/bunkasai`
- 例: `https://あなたのドメイン/bunkasai`

## 1. Supabase でテーブルを作る（必須）

1. [Supabase](https://supabase.com/) にログインし、プロジェクトを開く  
2. 左メニュー **SQL Editor** → **New query**  
3. リポジトリの `supabase/apply_bunkasai_shift.sql` を全部コピーして貼り付け  
4. **Run** を押す  

これで:

- 定員9人を超えないチェック  
- 匿名の「メンバー番号」  
- リアルタイム更新  

が有効になります。

## 2. 環境変数（Vercel / ローカル）

すでに moni 用の Supabase を使っているなら、追加のキーは不要です。

| 名前 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon public key |

ローカル:

```bash
cp .env.example .env.local
# URL と ANON_KEY を入れる
npm install
npm run dev
```

ブラウザで `http://localhost:3000/bunkasai` を開く。

## 3. Vercel に公開する

1. GitHub にこのリポジトリを push する  
2. [Vercel](https://vercel.com/) でプロジェクトを Import（すでに moni があるならそのままでOK）  
3. Environment Variables に上記2つが入っていることを確認  
4. Deploy  
5. 公開URLの末尾に `/bunkasai` を付けてクラスLINEに送る  

例:

```text
https://dream-spark-pro.vercel.app/bunkasai
```

## 4. クラスへの送り方（例）

```text
【文化祭シフト】
このリンクを開いて、入りたい時間のボタンを押してね。
ログイン不要・名前も不要です。
各時間9人まで。満員になったら押せなくなります。

https://あなたのドメイン/bunkasai
```

## 時間帯の変更

`src/lib/bunkasai/slots.ts` の `FESTIVAL_SLOTS` を書き換えて再デプロイしてください（4枠・各9人のまま）。

## データのリセット

文化祭が終わったら、Supabase の Table Editor で `bunkasai_signups` を空にするか、SQL で:

```sql
truncate table public.bunkasai_signups;
```
