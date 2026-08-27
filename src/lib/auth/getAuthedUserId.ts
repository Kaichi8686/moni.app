import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function getAuthedUserId(req: NextRequest): Promise<
  | { ok: true; userId: string; token: string }
  | { ok: false; status: number; message: string }
> {
  const header = req.headers.get("authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, message: "ログインが必要です。" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return { ok: false, status: 503, message: "Supabase が未設定です。" };

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, message: "セッションが無効です。" };
  return { ok: true, userId: data.user.id, token };
}
