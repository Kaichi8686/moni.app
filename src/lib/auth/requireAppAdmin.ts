import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isAppAdminUser } from "@/lib/auth/appAdmin";
import { describeSupabaseAdminConfig, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AppAdminAuth =
  | { ok: true; userId: string; email: string | null; role: string | null }
  | { ok: false; status: number; message: string };

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireAppAdmin(req: NextRequest): Promise<AppAdminAuth> {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "ログインが必要です。" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return { ok: false, status: 503, message: "Supabase が未設定です。" };
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, message: "セッションが無効です。" };
  }

  const user = userData.user;
  const email = user.email ?? null;

  const admin = getSupabaseAdmin();
  let role: string | null = null;
  if (admin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role as string | undefined) ?? null;
  }

  if (!isAppAdminUser({ email, role })) {
    return { ok: false, status: 403, message: "管理者権限がありません。" };
  }

  if (!getSupabaseAdmin()) {
    const detail = describeSupabaseAdminConfig();
    return {
      ok: false,
      status: 503,
      message:
        detail === "ok"
          ? "SUPABASE_SERVICE_ROLE_KEY が未設定のため集計できません。"
          : detail,
    };
  }

  return { ok: true, userId: user.id, email, role };
}
