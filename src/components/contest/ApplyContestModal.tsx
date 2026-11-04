"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, FolderKanban, Check } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  createRoadmap,
  loadProjectPhasesAsSteps,
  submitContestEntry,
} from "@/lib/contest/api";
import type { Contest, ContestRoadmapStep } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadMemberProjects, type MemberProjectLite } from "@/lib/projects/loadMemberProjects";
import { supabase } from "@/lib/supabase";
import { burstCelebration } from "@/lib/ui/confetti";

type Step = "method" | "ai" | "pick" | "confirm" | "done";

type Props = {
  open: boolean;
  contest: Contest;
  userId: string;
  demo?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export function ApplyContestModal({ open, contest, userId, demo, onClose, onSubmitted }: Props) {
  const { tx } = useI18n();
  const [step, setStep] = useState<Step>("method");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<ContestRoadmapStep[]>([]);
  const [comment, setComment] = useState("");
  const [projects, setProjects] = useState<MemberProjectLite[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("method");
    setPrompt(contest.promptHint ?? contest.title);
    setTitle("");
    setSteps([]);
    setComment("");
    setSelectedProjectId(null);
    setError("");
    setBusy(false);
  }, [open, contest]);

  useEffect(() => {
    if (!open || step !== "pick") return;
    let cancelled = false;
    void loadMemberProjects(userId).then((rows) => {
      if (!cancelled) setProjects(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, step, userId]);

  if (!open) return null;

  async function generateAi() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Please sign in"));
      const res = await fetch("/api/contest/generate-roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, contestTitle: contest.title }),
      });
      const json = (await res.json()) as { title?: string; steps?: ContestRoadmapStep[]; error?: string };
      if (!res.ok) throw new Error(json.error || "AI generation failed");
      setTitle(json.title ?? contest.title);
      setSteps(Array.isArray(json.steps) ? json.steps : []);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function pickProject(projectId: string) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setSelectedProjectId(projectId);
    try {
      const packed = await loadProjectPhasesAsSteps(supabase, projectId);
      if (!packed.steps.length) {
        throw new Error(tx("このプロジェクトにロードマップがありません", "No roadmap steps on this project"));
      }
      setTitle(packed.title);
      setSteps(packed.steps);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (demo) {
      setStep("done");
      burstCelebration();
      window.setTimeout(() => {
        onSubmitted();
        onClose();
      }, 900);
      return;
    }
    if (!supabase || !title.trim() || !steps.length) return;
    setBusy(true);
    setError("");
    try {
      const roadmap = await createRoadmap(supabase, userId, {
        title,
        steps,
        sourceProjectId: selectedProjectId,
      });
      await submitContestEntry(supabase, userId, {
        contestId: contest.id,
        roadmapId: roadmap.id,
        comment,
      });
      setStep("done");
      burstCelebration();
      window.setTimeout(() => {
        onSubmitted();
        onClose();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-contest-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {tx("コンテスト応募", "Contest entry")}
            </p>
            <h2 id="apply-contest-title" className="mt-1 text-lg font-semibold text-zinc-950">
              {step === "done"
                ? tx("応募完了！", "You’re in!")
                : step === "confirm"
                  ? tx("確認して送信", "Confirm & submit")
                  : step === "ai"
                    ? tx("AIでロードマップ生成", "Generate with AI")
                    : step === "pick"
                      ? tx("既存ロードマップから選ぶ", "Pick an existing roadmap")
                      : tx("応募方法を選ぶ", "How will you enter?")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            ✕
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {step === "method" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStep("ai")}
              className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/40 active:scale-[0.99]"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {tx("AIで新しくロードマップを自動生成して応募", "Generate a new roadmap with AI")}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  {tx("お題に合わせたステップをすぐ作れます", "Get tailored steps in seconds")}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-left transition hover:border-[#5E6AD2]/40 hover:bg-[#F5F6FF] active:scale-[0.99]"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5E6AD2]">
                <FolderKanban className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {tx("作成済みのロードマップから選んで応募", "Enter with an existing roadmap")}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  {tx("プロジェクトのフェーズをそのまま提出", "Use your project phases as-is")}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {step === "ai" ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-500">{tx("プロンプト", "Prompt")}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-zinc-900 outline-none ring-[#5E6AD2]/30 focus:ring-2"
            />
            <DuoButton type="button" fullWidth disabled={busy || !prompt.trim()} onClick={() => void generateAi()}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tx("生成中…", "Generating…")}
                </span>
              ) : (
                tx("生成して次へ", "Generate & continue")
              )}
            </DuoButton>
            <button type="button" className="w-full text-sm font-medium text-zinc-500" onClick={() => setStep("method")}>
              {tx("戻る", "Back")}
            </button>
          </div>
        ) : null}

        {step === "pick" ? (
          <div className="space-y-3">
            {projects.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">
                {tx("参加中のプロジェクトがありません", "No projects yet")}
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void pickProject(p.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-left transition hover:border-[#5E6AD2]/50 hover:bg-[#F8F9FF] disabled:opacity-60"
                    >
                      <span className="text-lg" aria-hidden>
                        {p.icon || "📁"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="w-full text-sm font-medium text-zinc-500" onClick={() => setStep("method")}>
              {tx("戻る", "Back")}
            </button>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
              <p className="text-sm font-semibold text-zinc-900">{title}</p>
              <ol className="mt-2 space-y-1.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-zinc-600">
                    <span className="font-bold text-orange-500">{i + 1}.</span>
                    <span>
                      {s.title}
                      {s.detail ? <span className="text-zinc-400"> — {s.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                {tx("一言アピール（任意・140字）", "Pitch comment (optional, 140)")}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 140))}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none ring-[#5E6AD2]/30 focus:ring-2"
                placeholder={tx("このロードマップの推しポイント", "What makes this roadmap special?")}
              />
              <p className="mt-1 text-right text-[11px] tabular-nums text-zinc-400">{comment.length}/140</p>
            </div>
            <DuoButton type="button" fullWidth disabled={busy} onClick={() => void submit()}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tx("送信中…", "Submitting…")}
                </span>
              ) : (
                tx("コンテストに応募", "Submit entry")
              )}
            </DuoButton>
            <button
              type="button"
              className="w-full text-sm font-medium text-zinc-500"
              onClick={() => setStep(selectedProjectId ? "pick" : "ai")}
            >
              {tx("戻る", "Back")}
            </button>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Check className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-zinc-600">
              {tx("ギャラリーに載りました。いいねで応援し合おう！", "You’re in the gallery. Cheer others on with likes!")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
