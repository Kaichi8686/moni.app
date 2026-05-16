import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/i;

function extFromType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function validateProjectImageFile(file: File): string | null {
  if (!ALLOWED.test(file.type)) return "JPEG / PNG / WebP / GIF の画像を選んでください。";
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

  const ext = extFromType(file.type);
  const path = `${userId}/${scope}/${scopeId}/${Date.now()}.${ext}`;
  const { error: upErr } = await client.storage.from("post-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw new Error(`画像のアップロードに失敗: ${upErr.message}`);

  const { data } = client.storage.from("post-images").getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
