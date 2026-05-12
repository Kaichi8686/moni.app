/** Supabase Auth の OAuth / メール確認の戻り先（Redirect URLs に登録すること） */
export function getAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}
