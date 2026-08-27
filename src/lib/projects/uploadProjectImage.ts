import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;

function extFromType(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/heic" || type === "image/heif") return "heic";
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  if (lower.endsWith(".gif")) return "gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "heic";
  return "jpg";
}

export function validateProjectImageFile(file: File): string | null {
  const typeOk = !file.type || ALLOWED.test(file.type);
  const extOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!typeOk && !extOk) return "JPEG / PNG / WebP / GIF / HEIC の画像を選んでください。";
  if (file.size > MAX_BYTES) return "画像は5MB以下にしてください。";
  return null;
}

/** post-images バケット（ユーザーID先頭フォルダ）にアップロードし公開URLを返す */
export async function uploadProjectImage(
  client: SupabaseClient,
  userId: string,
  scope: "project-chat" | "project-thumb",
  scopeId: string,
  file: File,
): Promise<{ publicUrl: string; path: string }> {
  const err = validateProjectImageFile(file);
  if (err) throw new Error(err);

  const ext = extFromType(file.type, file.name);
  const path = `${userId}/${scope}/${scopeId}/${Date.now()}.${ext}`;
  const { error: upErr } = await client.storage.from("post-images").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw new Error(`画像のアップロードに失敗: ${upErr.message}`);

  const { data } = client.storage.from("post-images").getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
