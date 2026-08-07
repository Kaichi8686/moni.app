/** bio 列が無い DB でも goal で表示できるようにする */
export function resolveProfileBio(row: {
  bio?: string | null;
  goal?: string | null;
}): string {
  const bio = row.bio?.trim();
  if (bio) return bio;
  return row.goal?.trim() ?? "";
}
