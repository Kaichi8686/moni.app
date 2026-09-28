import {
  parseWorkflowFromDescription,
  stripWorkflowFromDescription,
  workflowFromJson,
  type IssueWorkflow,
} from "@/lib/workspace/issueWorkflow";
import type { TaskGenre } from "@/lib/workspace/types";

export const TASK_GENRES = ["think", "make", "talk", "spread", "run"] as const;
export type { TaskGenre };

export const WORK_MARKER = "---moni-work-v1---";
const GENRE_PREFIX = "genre:";

export type IssueAttachment = {
  url: string;
};

export type IssueWork = {
  genre: TaskGenre;
  workspaceText: string;
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
  attachment_urls?: string[] | null;
  submitted_at?: string | null;
};

export function isTaskGenre(value: unknown): value is TaskGenre {
  return typeof value === "string" && (TASK_GENRES as readonly string[]).includes(value);
}

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
  const idx = description.indexOf(WORK_MARKER);
  const head = idx < 0 ? description : description.slice(0, idx);
  return stripWorkflowFromDescription(head).trim();
}

function readPackedWork(description?: string | null): Partial<IssueWork> | null {
  if (!description?.includes(WORK_MARKER)) return null;
  const json = description.slice(description.indexOf(WORK_MARKER) + WORK_MARKER.length).trim();
  try {
    const parsed = JSON.parse(json) as Partial<IssueWork>;
    return parsed && typeof parsed === "object" ? parsed : null;
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

export function readIssueWork(row: WorkRow): IssueWork & { legacyWorkflow: boolean } {
  const workflow =
    workflowFromJson(row.workflow_json) ?? parseWorkflowFromDescription(row.description ?? undefined);
  const packed = readPackedWork(row.description);
  const plain = stripWorkMarker(row.description);
  const columnText = typeof row.workspace_text === "string" ? row.workspace_text.trim() : "";
  const workspaceText = columnText || (typeof packed?.workspaceText === "string" ? packed.workspaceText.trim() : "") || composeWorkspaceText(plain, workflow);
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
  const submittedAt =
    (typeof row.submitted_at === "string" && row.submitted_at) ||
    (typeof packed?.submittedAt === "string" && packed.submittedAt) ||
    (row.status === "done" ? row.updated_at ?? null : null);
  return {
    genre,
    workspaceText,
    attachments: columnAttachments.length > 0 ? columnAttachments : packedAttachments,
    submittedAt: submittedAt || null,
    legacyWorkflow: Boolean(workflow),
  };
}

export function packWorkDescription(work: IssueWork): string {
  const payload = {
    genre: work.genre,
    workspaceText: work.workspaceText,
    attachments: work.attachments,
    submittedAt: work.submittedAt,
  };
  const text = work.workspaceText.trim();
  return text ? `${text}\n\n${WORK_MARKER}\n${JSON.stringify(payload)}` : `${WORK_MARKER}\n${JSON.stringify(payload)}`;
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
