/** DB とフロントで共通のワークステータス（Phase 1） */
export type TaskWorkStatus = "not_started" | "in_progress" | "blocked" | "waiting" | "done";

/** レガシー値が残っている環境向け */
export type TaskStatusLegacy = "todo" | "doing";

export function normalizeTaskStatus(raw: string | null | undefined): TaskWorkStatus {
  const s = (raw ?? "").trim();
  if (s === "not_started" || s === "in_progress" || s === "blocked" || s === "waiting" || s === "done") return s;
  if (s === "todo") return "not_started";
  if (s === "doing") return "in_progress";
  return "not_started";
}

/** DB に書き込む値（マイグレーション済み前提。未適用時は todo/doing にフォールバックしない — INSERT でエラーになるのでマイグレーション必須） */
export function toDbTaskStatus(s: TaskWorkStatus): TaskWorkStatus {
  return s;
}

export function taskStatusLabelJa(s: TaskWorkStatus): string {
  switch (s) {
    case "not_started":
      return "未着手";
    case "in_progress":
      return "進行中";
    case "blocked":
      return "中断";
    case "waiting":
      return "保留";
    case "done":
      return "完了";
    default:
      return s;
  }
}

export function isActiveTaskStatus(s: TaskWorkStatus): boolean {
  return s !== "done";
}
