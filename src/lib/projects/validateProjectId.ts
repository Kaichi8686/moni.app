/** プロジェクトの id 列用（PostgreSQL gen_random_uuid() 形式） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeProjectIdParam(raw: string | undefined | null): string {
  if (raw == null) return "";
  const s = raw.trim();
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function isValidProjectUuid(s: string): boolean {
  return s.length > 0 && UUID_RE.test(s);
}
