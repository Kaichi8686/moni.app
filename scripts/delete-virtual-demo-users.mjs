/**
 * 本番 DB からゆい・みさき等の仮想デモユーザーを削除するワンショット。
 * 使い方: node scripts/delete-virtual-demo-users.mjs
 * 要: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const VIRTUAL_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
  "77777777-7777-4777-8777-777777777777",
  "88888888-8888-4888-8888-888888888888",
];

const VIRTUAL_NAMES = ["ゆい", "たくみ", "みさき", "美咲", "そら", "りく", "あかり", "けん", "もも"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const idSet = new Set(VIRTUAL_IDS);
const { data: profiles } = await admin.from("profiles").select("id,display_name").in("display_name", VIRTUAL_NAMES);
for (const row of profiles ?? []) {
  const name = (row.display_name ?? "").trim();
  if (VIRTUAL_NAMES.includes(name)) idSet.add(row.id);
}

console.log(`削除対象: ${idSet.size} 件`);
let ok = 0;
let fail = 0;
for (const id of idSet) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.warn(`  skip ${id}: ${error.message}`);
    fail += 1;
  } else {
    console.log(`  deleted ${id}`);
    ok += 1;
  }
}
console.log(`完了: 削除 ${ok} / 失敗 ${fail}`);
