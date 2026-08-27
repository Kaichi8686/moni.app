#!/usr/bin/env node
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../supabase/apply_conversations_messages.sql");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL または DATABASE_URL を設定してください。");
    console.error("または Supabase SQL Editor で実行:", sqlPath);
    process.exit(1);
  }
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("npm install --save-dev pg を実行するか、SQL Editor で", sqlPath);
    process.exit(1);
  }
  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: apply_conversations_messages.sql");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
