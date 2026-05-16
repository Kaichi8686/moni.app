/** 同一ブラウザで保存されたプロフィール画像（data URL 等） */
export function readStoredAvatarUrl(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`moni-profile-avatar-${userId}`);
  } catch {
    return null;
  }
}

export function resolveMemberAvatarUrl(userId: string | undefined, dbAvatarUrl?: string | null): string | null {
  const fromDb = dbAvatarUrl?.trim();
  if (fromDb) return fromDb;
  if (userId) return readStoredAvatarUrl(userId);
  return null;
}
