"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectMemberRow, ProjectRow } from "@/lib/projects/types";
import { buildRoadmapTemplateRows, businessTypeLabelJa, ROADMAP_TEMPLATES, roadmapTemplateKey } from "@/lib/projects/roadmapTemplates";

export type RoadmapStepFull = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  position: number;
  description: string | null;
  due_date: string | null;
  owner_id: string | null;
  notes: string | null;
};

type ProjectTaskLite = {
  id: string;
  title: string;
  status: string;
  roadmap_step_id: string | null;
};

type RoadmapFilter = "all" | "todo" | "doing" | "done";

type Props = {
  projectId: string;
  project: ProjectRow;
  uid: string | null;
  steps: RoadmapStepFull[];
  tasks: ProjectTaskLite[];
  members: ProjectMemberRow[];
  memberNames: Record<string, string>;
  onReload: () => void;
  onError: (msg: string) => void;
};

function sortedSteps(steps: RoadmapStepFull[]) {
  return [...steps].sort((a, b) => a.position - b.position);
}

/** 「いまここ」＝ 進行中があればその先頭、なければ未着手の先頭 */
export function pickFocusStep(steps: RoadmapStepFull[]): RoadmapStepFull | null {
  const list = sortedSteps(steps);
  const doing = list.find((s) => s.status === "doing");
  if (doing) return doing;
  return list.find((s) => s.status === "todo") ?? list[list.length - 1] ?? null;
}

function progressPercent(steps: RoadmapStepFull[]) {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.status === "done").length;
  return Math.round((done / steps.length) * 100);
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function ProjectRoadmapPanel({
  projectId,
  project,
  uid,
  steps,
  tasks,
  members,
  memberNames,
  onReload,
  onError,
}: Props) {
  const [filter, setFilter] = useState<RoadmapFilter>("all");
  const [seeding, setSeeding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<{
    title: string;
    description: string;
    status: RoadmapStepFull["status"];
    due_date: string;
    owner_id: string;
    notes: string;
  } | null>(null);
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const focusStep = useMemo(() => pickFocusStep(steps), [steps]);
  const doneRate = useMemo(() => progressPercent(steps), [steps]);

  const filtered = useMemo(() => {
    const list = sortedSteps(steps);
    if (filter === "all") return list;
    return list.filter((s) => s.status === filter);
  }, [steps, filter]);

  const taskCountByStep = useCallback(
    (stepId: string) => tasks.filter((t) => t.roadmap_step_id === stepId).length,
    [tasks],
  );

  const detailStep = useMemo(() => steps.find((s) => s.id === detailId) ?? null, [steps, detailId]);

  useEffect(() => {
    if (!detailStep) {
      setDetailDraft(null);
      return;
    }
    setDetailDraft({
      title: detailStep.title,
      description: detailStep.description ?? "",
      status: detailStep.status,
      due_date: detailStep.due_date ?? "",
      owner_id: detailStep.owner_id ?? "",
      notes: detailStep.notes ?? "",
    });
  }, [detailStep]);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "操作に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const seedFromTemplate = async () => {
    if (steps.length > 0) {
      onError("すでにステップがあります。空にしてからテンプレートを使うか、行を削除してください。");
      return;
    }
    if (!supabase) {
      onError("接続設定が見つかりません。");
      return;
    }
    setSeeding(true);
    const rows = buildRoadmapTemplateRows(projectId, project.business_type);
    const { error } = await supabase.from("project_roadmap_steps").insert(rows);
    setSeeding(false);
    if (error) {
      onError(error.message);
      return;
    }
    await onReload();
  };

  const addBlankStep = () =>
    run(async () => {
      if (!supabase || !uid) throw new Error("ログインが必要です。");
      const max = steps.reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await supabase.from("project_roadmap_steps").insert({
        project_id: projectId,
        title: "新しいステップ",
        status: "todo",
        position: max + 1,
        description: "",
        notes: "",
      });
      if (error) throw new Error(error.message);
    });

  const deleteStep = (id: string) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const { error } = await supabase.from("project_roadmap_steps").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (detailId === id) setDetailId(null);
    });

  const moveStep = (stepId: string, dir: -1 | 1) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const list = sortedSteps(steps);
      const i = list.findIndex((s) => s.id === stepId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      const a = list[i];
      const b = list[j];
      const { error: e1 } = await supabase.from("project_roadmap_steps").update({ position: b.position }).eq("id", a.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from("project_roadmap_steps").update({ position: a.position }).eq("id", b.id);
      if (e2) throw new Error(e2.message);
    });

  const patchStep = (id: string, patch: Partial<Pick<RoadmapStepFull, "title" | "description" | "status" | "due_date" | "owner_id" | "notes">>) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const { error } = await supabase.from("project_roadmap_steps").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    });

  const saveDetailDraft = () =>
    run(async () => {
      if (!supabase || !detailId || !detailDraft) return;
      const { error } = await supabase
        .from("project_roadmap_steps")
        .update({
          title: detailDraft.title.trim() || "無題",
          description: detailDraft.description,
          status: detailDraft.status,
          due_date: detailDraft.due_date || null,
          owner_id: detailDraft.owner_id || null,
          notes: detailDraft.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", detailId);
      if (error) throw new Error(error.message);
    });

  const addChildTask = (stepId: string) =>
    run(async () => {
      if (!supabase || !uid) throw new Error("ログインが必要です。");
      const title = (taskDraft[stepId] ?? "").trim();
      if (!title) return;
      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        title,
        description: "",
        status: "todo",
        priority: "medium",
        created_by: uid,
        roadmap_step_id: stepId,
        ai_generated: false,
      });
      if (error) throw new Error(error.message);
      setTaskDraft((prev) => ({ ...prev, [stepId]: "" }));
    });

  function onAddStepSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !supabase || !uid) return;
    void run(async () => {
      const max = steps.reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await supabase!.from("project_roadmap_steps").insert({
        project_id: projectId,
        title: newTitle.trim(),
        status: "todo",
        position: max + 1,
        description: "",
        notes: "",
      });
      if (error) throw new Error(error.message);
      setNewTitle("");
    });
  }

  const chips: Array<{ key: RoadmapFilter; label: string }> = [
    { key: "all", label: "すべて" },
    { key: "todo", label: "未着手" },
    { key: "doing", label: "進行中" },
    { key: "done", label: "完了" },
  ];

  const templateTitles = ROADMAP_TEMPLATES[roadmapTemplateKey(project.business_type)];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">プロジェクトの進め方</p>
            <p className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-100">
              {businessTypeLabelJa(project.business_type ?? null)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-zinc-900">{doneRate}%</p>
            <p className="text-[11px] text-zinc-500">完了までの進み</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
            style={{ width: `${doneRate}%` }}
          />
        </div>
        {focusStep ? (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-indigo-800">次はここ</p>
            <p className="mt-0.5 text-sm font-semibold text-indigo-950">{focusStep.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-indigo-900/80">
              {focusStep.status === "done"
                ? "このステップは完了です。次の未着手か、新しいステップを進めよう。"
                : "チームでこの段階のゴールを確認して、下の具体タスクから一つ進めよう。"}
            </p>
          </div>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-zinc-900">完成までの道筋を作ろう</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">
            ロードマップは「大きな流れ」のマップです。{businessTypeLabelJa(project.business_type ?? null)}
            向けの例から始めるか、自分たちだけのステップからでもOKです。
          </p>
          <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seedFromTemplate()}
              className="min-h-[44px] w-full max-w-xs rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:opacity-50 sm:w-auto"
            >
              {seeding ? "作成中…" : "テンプレートから始める"}
            </button>
            <button
              type="button"
              onClick={() => void addBlankStep()}
              className="min-h-[44px] w-full max-w-xs rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 sm:w-auto"
            >
              ゼロから1ステップ追加
            </button>
          </div>
          <p className="mt-4 text-left text-[11px] leading-relaxed text-zinc-500">
            テンプレート例（{templateTitles.length}段階）: {templateTitles.join(" → ")}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === c.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <ul className="relative space-y-0 pl-1">
            {filtered.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-500">この条件に該当するステップはありません。</li>
            ) : null}
            {filtered.map((step, idx) => {
              const isFocus = focusStep?.id === step.id;
              const n = sortedSteps(steps).findIndex((s) => s.id === step.id) + 1;
              const tc = taskCountByStep(step.id);
              const statusStyle =
                step.status === "done"
                  ? "border-zinc-200 bg-zinc-50/90 opacity-[0.92]"
                  : step.status === "doing"
                    ? "border-indigo-400 bg-indigo-50/40 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]"
                    : "border-zinc-200 bg-white";
              const ringFocus = isFocus && step.status !== "done" ? "ring-2 ring-indigo-400/40" : "";

              return (
                <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        step.status === "done"
                          ? "bg-emerald-500 text-white"
                          : step.status === "doing"
                            ? "bg-indigo-600 text-white"
                            : "border-2 border-zinc-300 bg-white text-zinc-600"
                      }`}
                    >
                      {step.status === "done" ? "✓" : n}
                    </div>
                    {idx < filtered.length - 1 ? <div className="mt-1 w-px flex-1 bg-zinc-200" aria-hidden /> : null}
                  </div>
                  <div className={`min-w-0 flex-1 rounded-2xl border p-3 transition ${statusStyle} ${ringFocus}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button type="button" className="text-left" onClick={() => setDetailId(step.id)}>
                          <span className="text-base font-semibold text-zinc-900">{step.title}</span>
                          {step.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">{step.description}</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-zinc-400">説明を追加（タップ）</p>
                          )}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-600">
                          {step.due_date ? (
                            <span className="rounded-md bg-white/80 px-1.5 py-0.5 ring-1 ring-zinc-200">期限 {step.due_date}</span>
                          ) : null}
                          {step.owner_id ? (
                            <span className="rounded-md bg-white/80 px-1.5 py-0.5 ring-1 ring-zinc-200">
                              担当 {memberNames[step.owner_id] ?? "メンバー"}
                            </span>
                          ) : null}
                          <span className="rounded-md bg-white/80 px-1.5 py-0.5 ring-1 ring-zinc-200">具体タスク {tc}件</span>
                        </div>
                      </div>
                      <select
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800"
                        value={step.status}
                        onChange={(e) => void patchStep(step.id, { status: e.target.value as RoadmapStepFull["status"] })}
                        disabled={saving}
                      >
                        <option value="todo">未着手</option>
                        <option value="doing">進行中</option>
                        <option value="done">完了</option>
                      </select>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100/80 pt-2">
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-indigo-700 hover:underline"
                        onClick={() => setDetailId(step.id)}
                      >
                        詳細・具体タスク
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        disabled={saving}
                        className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                        onClick={() => void moveStep(step.id, -1)}
                      >
                        ↑上へ
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                        onClick={() => void moveStep(step.id, 1)}
                      >
                        ↓下へ
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="ml-auto text-[11px] font-medium text-rose-600 hover:underline disabled:opacity-50"
                        onClick={() => {
                          if (typeof window !== "undefined" && !window.confirm("このステップを削除しますか？")) return;
                          void deleteStep(step.id);
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={onAddStepSubmit} className="flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3">
            <input
              className={inputClass}
              placeholder="新しい段階を追加（例: ユーザー取材）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit" className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={!newTitle.trim()}>
              追加
            </button>
          </form>
        </>
      )}

      {detailStep && detailDraft ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roadmap-detail-title"
        >
          <div className="max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h2 id="roadmap-detail-title" className="text-sm font-bold text-zinc-900">
                ステップを編集
              </h2>
              <button type="button" className="rounded-full p-2 text-lg text-zinc-500 hover:bg-zinc-100" onClick={() => setDetailId(null)} aria-label="閉じる">
                ×
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">タイトル</span>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={detailDraft.title}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">この段階でやること（説明）</span>
                <textarea
                  className={`mt-1 min-h-[5rem] ${inputClass}`}
                  value={detailDraft.description}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                  disabled={saving}
                  placeholder="チームで共有するゴールや成果物を書く"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">状態</span>
                  <select
                    className={`mt-1 ${inputClass}`}
                    value={detailDraft.status}
                    onChange={(e) =>
                      setDetailDraft((d) =>
                        d ? { ...d, status: e.target.value as RoadmapStepFull["status"] } : d,
                      )
                    }
                    disabled={saving}
                  >
                    <option value="todo">未着手</option>
                    <option value="doing">進行中</option>
                    <option value="done">完了</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">期限</span>
                  <input
                    type="date"
                    className={`mt-1 ${inputClass}`}
                    value={detailDraft.due_date}
                    onChange={(e) => setDetailDraft((d) => (d ? { ...d, due_date: e.target.value } : d))}
                    disabled={saving}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">担当（1人）</span>
                <select
                  className={`mt-1 ${inputClass}`}
                  value={detailDraft.owner_id}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, owner_id: e.target.value } : d))}
                  disabled={saving}
                >
                  <option value="">未設定</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {memberNames[m.user_id] ?? m.user_id.slice(0, 8)}（{m.role}）
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">メモ（次にやること・リンクなど）</span>
                <textarea
                  className={`mt-1 min-h-[4rem] ${inputClass}`}
                  value={detailDraft.notes}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                  disabled={saving}
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDetailDraft()}
                className="w-full rounded-xl bg-indigo-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>

              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <p className="text-xs font-semibold text-zinc-800">この段階の具体タスク</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">大きな流れの下で、日々の行動に分解したタスクを置けます。</p>
                <ul className="mt-2 space-y-1.5">
                  {tasks
                    .filter((t) => t.roadmap_step_id === detailStep.id)
                    .map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs">
                        <span className="min-w-0 truncate font-medium text-zinc-800">{t.title}</span>
                        <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{t.status}</span>
                      </li>
                    ))}
                  {tasks.filter((t) => t.roadmap_step_id === detailStep.id).length === 0 ? (
                    <li className="text-[11px] text-zinc-500">まだありません。下から追加してください。</li>
                  ) : null}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="例: ワイヤーフレーム作成"
                    value={taskDraft[detailStep.id] ?? ""}
                    onChange={(e) => setTaskDraft((prev) => ({ ...prev, [detailStep.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    disabled={saving || !(taskDraft[detailStep.id] ?? "").trim()}
                    onClick={() => void addChildTask(detailStep.id)}
                  >
                    追加
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                onClick={() => setDetailId(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
