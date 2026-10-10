/** Deterministic avatar background from a display name (styling only). */

const AVATAR_TONES = [
  "#ff5c35", // brand orange
  "#0D9488", // teal
  "#DB2777", // pink
  "#D97706", // amber
  "#ea580c", // deep orange
  "#059669", // emerald
  "#c2410c", // burnt orange
  "#DC2626", // red
  "#0891B2", // cyan
  "#CA8A04", // yellow-ish
] as const;

export function avatarToneFromName(name: string): string {
  const s = name.trim() || "?";
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

export function avatarInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
