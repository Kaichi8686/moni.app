"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, type Locale } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { Calendar, Check, Compass, FileText, Layers, Pencil, User, X } from "lucide-react";
import type { Issue, IssueWorkflow, Member } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { IssueResolutionPanel } from "@/components/issues/IssueResolutionPanel";
import {
  getIssueCompletionAnswer,
  issueHasGuideActivity,
  stripWorkflowFromDescription,
} from "@/lib/workspace/issueWorkflow";
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatIso(iso: string | undefined, pattern: string, dateLocale: Locale) {
  if (!iso) return null;
  try {
    return format(parseISO(iso), pattern, { locale: dateLocale });
  } catch {
    return null;
  }
}

type SheetTab = "simple" | "guide";

type Props = {
  issue: Issue | null;
  open: boolean;
  phaseTitle?: string;
  phaseGoal?: string;
  members: Member[];
  canEdit: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onToggleDone?: (issue: Issue) => void | Promise<void>;
  onSaveWorkflow?: (issueId: string, workflow: IssueWorkflow) => Promise<void>;
  onMarkIssueDone?: (issueId: string, completionAnswer: string) => Promise<void>;
  onSaveMemo?: (issueId: string, memo: string) => Promise<void>;
};

export function IssueDetailSheet({
  issue,
  open,
  phaseTitle,
  phaseGoal,
  members,
  canEdit,
  onClose,
  onEdit,
  onToggleDone,
  onSaveWorkflow,
  onMarkIssueDone,
  onSaveMemo,
}: Props) {
  const [tab, setTab] = useState<SheetTab>("simple");
  const [memo, setMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const { tx, locale } = useI18n();
  const dateLocale = locale === "en" ? enUS : ja;
  const priorityLabel: Record<Issue["priority"], string> = {
    no_priority: tx("なし", "None"),
    urgent: tx("急", "Urgent"),
    high: tx("高", "High"),
    medium: tx("中", "Medium"),
    low: tx("低", "Low"),
  };

  useEffect(() => {
    if (!issue) return;
    setMemo(getIssueCompletionAnswer(issue));
    setTab("simple");
  }, [issue?.id]);

  if (!open || !issue || typeof document === "undefined") return null;

  const assignee = issue.assigneeId ? members.find((m) => m.id === issue.assigneeId) : undefined;
  const due = formatIso(issue.dueDate, locale === "en" ? "MMM d, yyyy" : "yyyy年M月d日", dateLocale);
  const created = formatIso(issue.createdAt, locale === "en" ? "MMM d, yyyy HH:mm" : "yyyy/M/d HH:mm", dateLocale);
  const updated = formatIso(issue.updatedAt, locale === "en" ? "MMM d, yyyy HH:mm" : "yyyy/M/d HH:mm", dateLocale);
  const description = stripWorkflowFromDescription(issue.description);
  const done = issue.status === "done";
  const guided = issueHasGuideActivity(issue);

  async function commitMemo() {
    if (!canEdit || !onSaveMemo || !issue) return;
    const next = memo.trim();
    if (next === getIssueCompletionAnswer(issue)) return;
    setSavingMemo(true);
    try {
      await onSaveMemo(issue.id, next);
    } finally {
      setSavingMemo(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/30" role="presentation" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityIcon priority={issue.priority} />
              <IssueStatusBadge status={issue.status} />
              <span className="text-[11px] text-gray-500">{priorityLabel[issue.priority]}</span>
              {guided ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                  {tx("ガイドあり", "Has guide")}
                </span>
              ) : null}
            </div>
            <h2
              id="issue-detail-title"
              className={`mt-2 text-lg font-semibold leading-snug ${done ? "text-gray-400 line-through" : "text-gray-900"}`}
            >
              {issue.title}
            </h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-gray-100 px-5">
          <button
            type="button"
            onClick={() => setTab("simple")}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === "simple"
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tx("詳細", "Details")}
          </button>
          <button
            type="button"
            onClick={() => setTab("guide")}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === "guide"
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tx("ガイド", "Guide")}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "simple" ? (
            <div className="space-y-4">
              {canEdit && onToggleDone ? (
                <button
                  type="button"
                  onClick={() => void onToggleDone(issue)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 bg-white"
                    }`}
                  >
                    <Check className={`h-4 w-4 ${done ? "opacity-100" : "opacity-0"}`} strokeWidth={3} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">
                      {done ? tx("完了済み", "Completed") : tx("完了にする", "Mark done")}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {done
                        ? tx("タップで未完了に戻す", "Tap to mark incomplete")
                        : tx("答えやガイドなしでそのまま完了できます", "Complete without an answer or guide")}
                    </span>
                  </span>
                </button>
              ) : null}

              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="h-3.5 w-3.5" />
                  {tx("説明", "Description")}
                </p>
                {description ? (
                  <p className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700">
                    {description}
                  </p>
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-400">
                    {tx("説明はまだありません", "No description yet")}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="block text-sm font-semibold text-gray-900">{tx("メモ", "Notes")}</label>
                <p className="mt-0.5 text-xs text-gray-500">{tx("任意。結果や気づきを1か所に残せます。", "Optional. Keep results and notes in one place.")}</p>
                {canEdit ? (
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    onBlur={() => void commitMemo()}
                    rows={5}
                    placeholder={tx("やったこと・メモ（任意）", "What you did / notes (optional)")}
                    className="mt-3 min-h-[7.5rem] w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] leading-relaxed outline-none ring-violet-500 focus:ring-2"
                  />
                ) : memo.trim() ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{memo}</p>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">{tx("メモはまだありません", "No notes yet")}</p>
                )}
                {savingMemo ? <p className="mt-1 text-[11px] text-gray-400">{tx("保存中…", "Saving…")}</p> : null}
              </section>

              <section className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">{tx("基本情報", "Basics")}</p>
                <dl className="mt-2 space-y-2 text-sm">
                  {phaseTitle ? (
                    <div className="flex gap-2">
                      <dt className="flex shrink-0 items-center gap-1 text-gray-500">
                        <Layers className="h-3.5 w-3.5" />
                        {tx("フェーズ", "Phase")}
                      </dt>
                      <dd className="font-medium text-gray-800">{phaseTitle}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="flex shrink-0 items-center gap-1 text-gray-500">
                      <User className="h-3.5 w-3.5" />
                      {tx("担当", "Assignee")}
                    </dt>
                    <dd className="font-medium text-gray-800">{assignee?.name ?? tx("未割り当て", "Unassigned")}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="flex shrink-0 items-center gap-1 text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {tx("期限", "Due")}
                    </dt>
                    <dd className="font-medium text-gray-800">{due ?? tx("未設定", "Not set")}</dd>
                  </div>
                </dl>
              </section>

              <button
                type="button"
                onClick={() => setTab("guide")}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-violet-300 bg-white px-4 py-3 text-left transition hover:border-violet-400 hover:bg-violet-50/50"
              >
                <span className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-violet-600" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-violet-900">{tx("ガイド付きで進める", "Use the guide")}</span>
                    <span className="block text-xs text-violet-800/80">{tx("わかる→しらべる→やってみる…（任意）", "Understand → research → try… (optional)")}</span>
                  </span>
                </span>
                <span className="text-xs font-semibold text-violet-700">{tx("開く", "Open")}</span>
              </button>

              {issue.labels.length > 0 ? (
                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{tx("ラベル", "Labels")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.labels.map((label) => (
                      <span key={label} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                        {label}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-[11px] text-gray-500">
                <p>{tx("作成", "Created")}: {created ?? "—"}</p>
                <p className="mt-0.5">{tx("更新", "Updated")}: {updated ?? "—"}</p>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-[12px] leading-relaxed text-violet-900">
                {tx("ガイドは任意です。途中まで使って止めても、詳細タブからそのまま完了にできます。", "The guide is optional. You can stop anytime and still complete the issue from Details.")}
              </p>
              <IssueResolutionPanel
                issue={issue}
                phaseTitle={phaseTitle}
                phaseGoal={phaseGoal}
                canEdit={canEdit}
                onSaveWorkflow={async (workflow) => {
                  if (onSaveWorkflow) await onSaveWorkflow(issue.id, workflow);
                }}
                onMarkDone={
                  onMarkIssueDone
                    ? async (answer) => {
                        await onMarkIssueDone(issue.id, answer);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tx("閉じる", "Close")}
          </button>
          {canEdit && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Pencil className="h-4 w-4" />
              {tx("編集", "Edit")}
            </button>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
