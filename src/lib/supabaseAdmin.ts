import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/** ビルド時の静的置換を避けるため bracket アクセス */
function readServiceRoleKey(): string {
  const env = process.env as Record<string, string | undefined>;
  return (
    env["SUPABASE_SERVICE_ROLE_KEY"] ??
    env["SUPABASE_SERVICE_KEY"] ??
    ""
  ).trim();
}

function readSupabaseUrl(): string {
  return (process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").trim();
}

/** サーバー専用。RLS をバイパスして集計する */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = readSupabaseUrl();
  const key = readServiceRoleKey();
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** 運営 API のエラーメッセージ用（秘密は返さない） */
export function describeSupabaseAdminConfig(): string {
  const url = readSupabaseUrl();
  const key = readServiceRoleKey();
  if (!url && !key) return "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY の両方が未設定です。";
  if (!url) return "NEXT_PUBLIC_SUPABASE_URL が未設定です。";
  if (!key) {
    return (
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。" +
      " Vercel で追加したあと Production を再デプロイしてください（追加だけでは反映されません）。"
    );
  }
  return "ok";
}
