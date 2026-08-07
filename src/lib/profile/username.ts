export function profileUsername(displayName: string, userId: string): string {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\u3040-\u30ff\u4e00-\u9faf]/gi, "")
    .slice(0, 24);
  if (base.length >= 2) return base;
  return `user_${userId.slice(0, 8)}`;
}
