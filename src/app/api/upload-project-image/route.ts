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
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルがありません。" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "プロジェクトIDがありません。" }, { status: 400 });
  }

  const typeOk = !file.type || ALLOWED.has(file.type);
  const extOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!typeOk && !extOk) {
    return NextResponse.json({ error: "JPEG / PNG / WebP / GIF / HEIC の画像を選んでください。" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 以下の画像にしてください。" }, { status: 400 });
  }

  const { data: project, error: projectErr } = await userClient
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }
  if (project.owner_id !== userData.user.id) {
    const { data: member } = await userClient
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "写真を変更する権限がありません。" }, { status: 403 });
    }
  }

  const ext = extFromFile(file);
  const path = `${userData.user.id}/project-thumb/${projectId}/cover.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";

  const { error: upErr } = await userClient.storage.from("post-images").upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) {
    return NextResponse.json({ error: `画像のアップロードに失敗: ${upErr.message}` }, { status: 500 });
  }

  const { data: urlData } = userClient.storage.from("post-images").getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await userClient
    .from("projects")
    .update({ thumbnail_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ publicUrl });
}
