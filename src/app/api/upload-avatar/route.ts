import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function extFromFile(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  if (lower.endsWith(".gif")) return "gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "heic";
  return "jpg";
}

function isAllowedImage(file: File): boolean {
  if (file.type && ALLOWED.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase が未設定です。" }, { status: 503 });
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "セッションが無効です。" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルがありません。" }, { status: 400 });
  }
  if (!isAllowedImage(file)) {
    return NextResponse.json({ error: "JPEG / PNG / WebP / GIF / HEIC の画像を選んでください。" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 以下の画像にしてください。" }, { status: 400 });
  }

  const ext = extFromFile(file);
  const path = `${userData.user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg");

  const buckets = ["avatars", "post-images"] as const;
  let publicUrl: string | null = null;
  let lastError = "アップロードに失敗しました。";

  for (const bucket of buckets) {
    const { error: upErr } = await userClient.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (upErr) {
      lastError = upErr.message;
      continue;
    }
    const { data } = userClient.storage.from(bucket).getPublicUrl(path);
    publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    break;
  }

  if (!publicUrl) {
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  const updatePayload: Record<string, string> = { avatar_url: publicUrl };
  const { error: profileErr } = await userClient.from("profiles").update(updatePayload).eq("id", userData.user.id);
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl: publicUrl });
}
