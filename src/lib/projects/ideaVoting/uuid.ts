/** ブラウザ内で使う簡易ID（サーバー不要） */
export function createIdeaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idea-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
