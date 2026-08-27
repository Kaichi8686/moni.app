#!/usr/bin/env node
/**
 * Supabase に apply_roadmap_template_gallery.sql を実行する。
 * 必要: SUPABASE_DB_URL または DATABASE_URL（postgres 接続文字列）
 * 例: postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../supabase/apply_roadmap_template_gallery.sql");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL または DATABASE_URL を設定してください。");
    console.error("Supabase ダッシュボード → Project Settings → Database → Connection string");
    console.error("\nまたは SQL Editor で次のファイルを貼り付けて実行:");
    console.error(sqlPath);
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("pg パッケージがありません。次でインストールしてください:");
    console.error("  npm install --save-dev pg");
    console.error("\n代替: Supabase SQL Editor で apply_roadmap_template_gallery.sql を実行");
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: apply_roadmap_template_gallery.sql を適用しました");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
