import {
  parseWorkflowFromDescription,
  stripWorkflowFromDescription,
  workflowFromJson,
  type IssueWorkflow,
} from "@/lib/workspace/issueWorkflow";
import {
  BOARD_MARKER,
  applyPlainTextToBoard,
  boardFromPlainText,
  boardImageUrls,
  boardPlainText,
  ensureImagesOnBoard,
  parseWorkspaceBoard,
  readBoardFromText,
  type IssueWorkspaceBoard,
} from "@/lib/workspace/issueWorkspaceBoard";
import { isTaskGenre } from "@/lib/workspace/taskGenres";
import type { TaskGenre } from "@/lib/workspace/types";

export { BUILTIN_TASK_GENRES, isTaskGenre, TASK_GENRES } from "@/lib/workspace/taskGenres";
export type { TaskGenre };
export type { IssueWorkspaceBoard };

export const WORK_MARKER = "---moni-work-v1---";
const GENRE_PREFIX = "genre:";

export type IssueAttachment = {
  url: string;
};

export type IssueWork = {
  genre: TaskGenre;
  workspaceText: string;
  /** フリーキャンバス。無い場合は workspaceText から用紙1枚へ移行 */
  workspaceBoard: IssueWorkspaceBoard | null;
  attachments: string[];
  submittedAt: string | null;
};

type WorkRow = {
  description?: string | null;
  labels?: string[] | null;
  status?: string | null;
  updated_at?: string | null;
  workflow_json?: unknown | null;
  genre?: string | null;
  workspace_text?: string | null;
  workspace_board_json?: unknown | null;
  attachment_urls?: string[] | null;
  submitted_at?: string | null;
};

export function genreFromLabels(labels: string[] | null | undefined): TaskGenre {
  const raw = (labels ?? []).find((label) => label.startsWith(GENRE_PREFIX))?.slice(GENRE_PREFIX.length);
  return isTaskGenre(raw) ? raw : "think";
}

export function withGenreLabel(labels: string[] | null | undefined, genre: TaskGenre): string[] {
  const rest = (labels ?? []).filter((label) => !label.startsWith(GENRE_PREFIX) && !label.startsWith("img:"));
  return [`${GENRE_PREFIX}${genre}`, ...rest];
}

export function stripWorkMarker(description?: string | null): string {
  if (!description) return "";
  let head = description;
  const boardIdx = head.indexOf(BOARD_MARKER);
  if (boardIdx >= 0) head = head.slice(0, boardIdx);
  const idx = head.indexOf(WORK_MARKER);
  if (idx >= 0) head = head.slice(0, idx);
  return stripWorkflowFromDescription(head).trim();
}

function readPackedWork(description?: string | null): Partial<IssueWork> | null {
  if (!description?.includes(WORK_MARKER)) return null;
  const json = description.slice(description.indexOf(WORK_MARKER) + WORK_MARKER.length).trim();
  try {
    const parsed = JSON.parse(json) as Partial<IssueWork> & { workspaceBoard?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    const board = parseWorkspaceBoard(parsed.workspaceBoard) ?? null;
    return { ...parsed, workspaceBoard: board };
  } catch {
    return null;
  }
}

export function composeWorkspaceText(plain: string, workflow: IssueWorkflow | null): string {
  const parts: string[] = [];
  if (plain.trim()) parts.push(plain.trim());
  if (!workflow) return parts.join("\n\n").trim();
  for (const step of workflow.steps) {
    const note = step.note.trim();
    if (!note) continue;
    parts.push(`## ${step.title}\n${note}`);
  }
  const summary = workflow.completionAnswer?.trim();
  if (summary) parts.push(`## まとめ\n${summary}`);
  return parts.join("\n\n").trim();
}

export function resolveWorkspaceBoard(
  row: Pick<WorkRow, "workspace_board_json" | "workspace_text" | "description" | "attachment_urls">,
  packedBoard: IssueWorkspaceBoard | null,
  plainText: string,
  attachments: string[],
): IssueWorkspaceBoard {
  const fromColumn = parseWorkspaceBoard(row.workspace_board_json);
  const fromText =
    readBoardFromText(typeof row.workspace_text === "string" ? row.workspace_text : null) ??
    readBoardFromText(row.description);
  let board = fromColumn ?? packedBoard ?? fromText;
  if (!board) board = boardFromPlainText(plainText);
  return ensureImagesOnBoard(board, attachments);
}

export function readIssueWork(row: WorkRow): IssueWork & { legacyWorkflow: boolean } {
  const workflow =
    workflowFromJson(row.workflow_json) ?? parseWorkflowFromDescription(row.description ?? undefined);
  const packed = readPackedWork(row.description);
  const plain = stripWorkMarker(row.description);
  const columnTextRaw = typeof row.workspace_text === "string" ? row.workspace_text : "";
  const columnText = columnTextRaw.includes(BOARD_MARKER) ? "" : columnTextRaw.trim();
  const workspaceText =
    columnText ||
    (typeof packed?.workspaceText === "string" ? packed.workspaceText.trim() : "") ||
    composeWorkspaceText(plain, workflow);
  const genre = isTaskGenre(row.genre)
    ? row.genre
    : isTaskGenre(packed?.genre)
      ? packed.genre
      : genreFromLabels(row.labels);
  const columnAttachments = Array.isArray(row.attachment_urls)
    ? row.attachment_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];
  const packedAttachments = Array.isArray(packed?.attachments)
    ? packed.attachments.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];
  const attachments = columnAttachments.length > 0 ? columnAttachments : packedAttachments;
  const packedBoard = packed?.workspaceBoard ?? null;
  const workspaceBoard = resolveWorkspaceBoard(row, packedBoard, workspaceText, attachments);
  const submittedAt =
    (typeof row.submitted_at === "string" && row.submitted_at) ||
    (typeof packed?.submittedAt === "string" && packed.submittedAt) ||
    (row.status === "done" ? row.updated_at ?? null : null);
  const textFromBoard = boardPlainText(workspaceBoard);
  return {
    genre,
    workspaceText: textFromBoard || workspaceText,
    workspaceBoard,
    attachments: boardImageUrls(workspaceBoard).length > 0 ? boardImageUrls(workspaceBoard) : attachments,
    submittedAt: submittedAt || null,
    legacyWorkflow: Boolean(workflow),
  };
}

export function packWorkDescription(work: IssueWork): string {
  const board = work.workspaceBoard;
  const text = (board ? boardPlainText(board) : work.workspaceText).trim();
  const payload = {
    genre: work.genre,
    workspaceText: text,
    workspaceBoard: board,
    attachments: board ? boardImageUrls(board) : work.attachments,
    submittedAt: work.submittedAt,
  };
  return text ? `${text}\n\n${WORK_MARKER}\n${JSON.stringify(payload)}` : `${WORK_MARKER}\n${JSON.stringify(payload)}`;
}

/** 保存用: 本文要約と添付をボードから揃える */
export function syncWorkFromBoard(work: IssueWork): IssueWork {
  if (!work.workspaceBoard) return work;
  const images = boardImageUrls(work.workspaceBoard);
  return {
    ...work,
    workspaceText: boardPlainText(work.workspaceBoard),
    attachments: images.length > 0 ? images : work.attachments,
  };
}

/** workspaceText だけ更新されたときにボードへも反映する */
export function mergeWorkPatch(
  current: IssueWork,
  patch: Partial<IssueWork>,
): IssueWork {
  let workspaceBoard =
    patch.workspaceBoard === undefined ? current.workspaceBoard : patch.workspaceBoard;
  const workspaceText = patch.workspaceText ?? current.workspaceText;
  if (patch.workspaceText !== undefined && patch.workspaceBoard === undefined) {
    workspaceBoard = applyPlainTextToBoard(workspaceBoard, patch.workspaceText);
  }
  return syncWorkFromBoard({
    genre: patch.genre ?? current.genre,
    workspaceText,
    workspaceBoard,
    attachments: patch.attachments ?? current.attachments,
    submittedAt: patch.submittedAt === undefined ? current.submittedAt : patch.submittedAt,
  });
}

export function isIssueSubmitted(issue: { status: string; submittedAt?: string | null }): boolean {
  return Boolean(issue.submittedAt) || issue.status === "done";
}

const BEGIN_PREFIX = "begin:";

export function dateInputToIso(value: string): string | null {
  const day = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day}T00:00:00+09:00`;
}

export function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const prefixed = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefixed && iso.includes("+09:00")) return prefixed[1];
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return prefixed?.[1] ?? "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function beginAtFromLabels(labels: string[] | null | undefined): string | undefined {
  const raw = (labels ?? []).find((label) => label.startsWith(BEGIN_PREFIX))?.slice(BEGIN_PREFIX.length);
  return raw ? dateInputToIso(raw) ?? undefined : undefined;
}

export function withBeginLabel(labels: string[] | null | undefined, beginAt: string | null): string[] {
  const rest = (labels ?? []).filter((label) => !label.startsWith(BEGIN_PREFIX));
  const day = beginAt ? isoToDateInput(beginAt) : "";
  return day ? [...rest, `${BEGIN_PREFIX}${day}`] : rest;
}

export function daysUntilDue(dueDate?: string | null, now = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}
