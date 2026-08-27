import type { SupabaseClient } from "@supabase/supabase-js";
import { validateProjectImageFile } from "@/lib/projects/uploadProjectImage";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadMessageImage(
  client: SupabaseClient,
  userId: string,
  conversationId: string,
  file: File,
): Promise<{ url: string; width: number; height: number }> {
  const err = validateProjectImageFile(file);
  if (err) throw new Error(err);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/messages/${conversationId}/${Date.now()}.${ext}`;
  const { error: upErr } = await client.storage.from("post-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw new Error(upErr.message);

  const { data } = client.storage.from("post-images").getPublicUrl(path);
  const dims = await imageDimensions(file);
  return { url: data.publicUrl, width: dims.width, height: dims.height };
}

export async function uploadMessageVoice(
  client: SupabaseClient,
  userId: string,
  conversationId: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/messages/${conversationId}/voice-${Date.now()}.webm`;
  const { error } = await client.storage.from("post-images").upload(path, blob, {
    contentType: "audio/webm",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return client.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}

export async function uploadMessageFile(
  client: SupabaseClient,
  userId: string,
  conversationId: string,
  file: File,
): Promise<{ url: string; filename: string; size_bytes: number; mime_type: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error("ファイルは10MB以下にしてください。");
  const safeName = file.name.replace(/[^\w.\-()]/g, "_").slice(0, 120);
  const path = `${userId}/messages/${conversationId}/files/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from("post-images").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from("post-images").getPublicUrl(path);
  return {
    url: data.publicUrl,
    filename: file.name,
    size_bytes: file.size,
    mime_type: file.type || "application/octet-stream",
  };
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 400 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 400, height: 400 });
    };
    img.src = url;
  });
}
