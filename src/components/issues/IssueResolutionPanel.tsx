"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, PenLine } from "lucide-react";
import type { Issue, IssueWorkflow } from "@/lib/workspace/types";
import {
  defaultWorkflowIfMissing,
  getIssueCompletionAnswer,
  workflowProgressPercent,
  type IssueWorkflowStep,
} from "@/lib/workspace/issueWorkflow";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";

type Props = {
  issue: Issue;
  phaseTitle?: string;
  phaseGoal?: string;
  canEdit: boolean;
  onSaveWorkflow: (workflow: IssueWorkflow) => Promise<void>;
  onMarkDone?: (completionAnswer: string) => Promise<void>;
};

export function IssueResolutionPanel({
  issue,
  phaseTitle,
  phaseGoal,
  canEdit,
  onSaveWorkflow,
  onMarkDone,
}: Props) {
  const initial = useMemo(
    () => defaultWorkflowIfMissing(issue, phaseTitle, phaseGoal),
    // Only recompute baseline when issue identity or phase labels change — not every parent tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid reset while typing
    [issue.id, phaseTitle, phaseGoal],
  );
  const [workflow, setWorkflow] = useState<IssueWorkflow>(initial);
  const [completionAnswer, setCompletionAnswer] = useState(() => getIssueCompletionAnswer(issue));
  const [saving, setSaving] = useState(false);
  const [answerErr, setAnswerErr] = useState("");
  const editingNoteRef = useRef(false);
  const editingAnswerRef = useRef(false);
  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;

  useEffect(() => {
    // Don't clobber local edits when parent saves bounce back.
    if (editingNoteRef.current || editingAnswerRef.current) return;
    const w = defaultWorkflowIfMissing(issue, phaseTitle, phaseGoal);
    setWorkflow(w);
    setCompletionAnswer(w.completionAnswer?.trim() ?? getIssueCompletionAnswer(issue));
    setAnswerErr("");
  }, [issue.id, issue.updatedAt, phaseTitle, phaseGoal, issue]);

  const activeStep = workflow.steps.find((s) => s.id === workflow.currentStepId) ?? workflow.steps[0];
  const pct = workflowProgressPercent(workflow);
  const activeIndex = workflow.steps.findIndex((s) => s.id === activeStep.id);
  const isCompleteStep = activeStep.id === "complete";
  const isDone = issue.status === "done";
  const savedAnswer = getIssueCompletionAnswer(issue);

  const persist = useCallback(
    async (next: IssueWorkflow, opts?: { quiet?: boolean }) => {
      setWorkflow(next);
      workflowRef.current = next;
      if (!canEdit) return;
      if (!opts?.quiet) setSaving(true);
      try {
        await onSaveWorkflow(next);
      } finally {
        if (!opts?.quiet) setSaving(false);
      }
    },
    [canEdit, onSaveWorkflow],
  );

  async function saveAnswerOnly() {
    const trimmed = completionAnswer.trim();
    await persist({ ...workflowRef.current, completionAnswer: trimmed }, { quiet: true });
  }

  async function handleMarkDone() {
    const trimmed = completionAnswer.trim();
    setAnswerErr("");
    if (!onMarkDone) return;
    setSaving(true);
    try {
      await onMarkDone(trimmed);
    } finally {
      setSaving(false);
    }
  }

  function setStep(id: string) {
    editingNoteRef.current = false;
    void persist({ ...workflowRef.current, currentStepId: id });
  }

  /** Local-only while typing — saves on blur. */
  function patchStepLocal(stepId: string, patch: Partial<IssueWorkflowStep>) {
    setWorkflow((prev) => {
      const next = {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      };
      workflowRef.current = next;
      return next;
    });
  }

  function commitStep(stepId: string, patch: Partial<IssueWorkflowStep>, quiet = false) {
    const prev = workflowRef.current;
    const next = {
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    };
    void persist(next, { quiet });
  }

  function goNext() {
    if (activeIndex < workflow.steps.length - 1) {
      setStep(workflow.steps[activeIndex + 1].id);
    }
  }

  return (
    <div className="space-y-4">
      {isDone ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            <Check className="h-3.5 w-3.5" />
            完了した課題の答え
          </p>
          {canEdit ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={completionAnswer}
                onChange={(e) => {
                  editingAnswerRef.current = true;
                  setCompletionAnswer(e.target.value);
                }}
                onBlur={() => {
                  editingAnswerRef.current = false;
                  void saveAnswerOnly();
                }}
                rows={5}
                placeholder="やったこと・わかったこと・次につながることを書く"
                className="min-h-[7.5rem] w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAnswerOnly()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "保存中…" : "答えを保存"}
              </button>
            </div>
          ) : savedAnswer ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-emerald-950">{savedAnswer}</p>
          ) : (
            <p className="mt-2 text-sm text-emerald-800/80">答えはまだ書かれていません。</p>
          )}
        </section>
      ) : null}

      <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">進め方（5ステップ）</p>
            <p className="mt-0.5 text-xs text-gray-600">ステップごとに答えを書き、最後にまとめて完了</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-violet-700">{pct}%</p>
            <p className="text-[10px] text-gray-500">ステップ完了</p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
          <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="解決ステップ">
        {workflow.steps.map((step, i) => {
          const active = step.id === activeStep.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setStep(step.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                active
                  ? "border-violet-400 bg-violet-600 text-white shadow-sm"
                  : step.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-600 hover:border-violet-200"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? "bg-white/20" : step.done ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {step.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="font-semibold">{step.title}</span>
            </button>
          );
        })}
      </nav>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">{activeStep.title}</h3>
          <p className="text-sm text-gray-500">{activeStep.subtitle}</p>
        </div>

        <ul className="space-y-2">
          {activeStep.prompts.map((prompt) => (
            <li key={prompt} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              {prompt}
            </li>
          ))}
        </ul>

        {canEdit && !isDone ? (
          <div className="mt-4 space-y-3">
            {!isCompleteStep ? (
              <>
                <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-violet-950">
                    <PenLine className="h-4 w-4" />
                    このステップの答え
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-violet-900/80">
                    「{activeStep.title}」で書いたこと・わかったことを、このステップ専用の欄に残します。
                  </p>
                  <textarea
                    value={activeStep.note}
                    onFocus={() => {
                      editingNoteRef.current = true;
                    }}
                    onChange={(e) => {
                      editingNoteRef.current = true;
                      patchStepLocal(activeStep.id, { note: e.target.value });
                    }}
                    onBlur={async (e) => {
                      const note = e.target.value;
                      try {
                        await persist(
                          {
                            ...workflowRef.current,
                            steps: workflowRef.current.steps.map((s) =>
                              s.id === activeStep.id ? { ...s, note } : s,
                            ),
                          },
                          { quiet: true },
                        );
                      } finally {
                        editingNoteRef.current = false;
                      }
                    }}
                    rows={6}
                    placeholder="このステップで書いたこと・答えを記入"
                    className="mt-3 min-h-[9rem] w-full resize-y rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-[15px] leading-relaxed outline-none ring-violet-500 focus:ring-2"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={activeStep.done}
                    onChange={(e) => commitStep(activeStep.id, { done: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600"
                  />
                  このステップを完了した
                </label>
              </>
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                  <PenLine className="h-4 w-4" />
                  この課題の最終の答え
                </label>
                <p className="mt-1 text-xs text-emerald-800/90">
                  各ステップの内容をふまえてまとめを書けます。空のままでも完了にできます。
                </p>
                <textarea
                  value={completionAnswer}
                  onFocus={() => {
                    editingAnswerRef.current = true;
                  }}
                  onChange={(e) => {
                    editingAnswerRef.current = true;
                    setCompletionAnswer(e.target.value);
                    if (answerErr) setAnswerErr("");
                  }}
                  onBlur={() => {
                    editingAnswerRef.current = false;
                    if (completionAnswer.trim() !== (workflowRef.current.completionAnswer ?? "").trim()) {
                      void saveAnswerOnly();
                    }
                  }}
                  rows={7}
                  placeholder="例: 5人に話を聞いて、いちばん困っているのは「朝の準備で忘れ物が多い」ことがわかった。次はチェックリストを作って試す。"
                  className="mt-3 min-h-[10.5rem] w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-[15px] leading-relaxed outline-none ring-emerald-500 focus:ring-2"
                />
                {answerErr ? <p className="mt-2 text-xs text-red-600">{answerErr}</p> : null}
              </div>
            )}
          </div>
        ) : !isDone && activeStep.note ? (
          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">このステップの答え</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{activeStep.note}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {activeIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStep(workflow.steps[activeIndex - 1].id)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              前のステップ
            </button>
          ) : null}
          {activeIndex < workflow.steps.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
            >
              次のステップ
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : canEdit && onMarkDone && !isDone ? (
            <button
              type="button"
              onClick={() => void handleMarkDone()}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {completionAnswer.trim() ? "答えを書いて完了にする" : "このまま完了にする"}
            </button>
          ) : null}
          {saving ? <span className="self-center text-[11px] text-gray-400">保存中…</span> : null}
        </div>
      </section>

      {issue.status !== "done" && pct === 100 && !isCompleteStep ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <IssueStatusBadge status="in_progress" />
          すべてのステップが完了しました。答えは任意です。下のボタンで完了にできます。
        </p>
      ) : null}
    </div>
  );
}
