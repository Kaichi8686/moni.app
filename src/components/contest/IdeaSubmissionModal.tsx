"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ImagePlus, Loader2, Map, Link2 } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  createRoadmapFromProject,
  submitContestIdea,
  uploadContestImage,
} from "@/lib/contest/api";
import type { Contest } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadMemberProjects, type MemberProjectLite } from "@/lib/projects/loadMemberProjects";
import { supabase } from "@/lib/supabase";
import { burstCelebration } from "@/lib/ui/confetti";

type Props = {
  open: boolean;
  contest: Contest;
  userId: string;
  demo?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

type StepId = 0 | 1 | 2;

const APPROACH_SUGGESTIONS_JA = [
  "1〜2週間で実行",
  "習慣化",
  "効率化",
  "小さく始める",
  "計測して改善",
  "チームで分担",
] as const;

const APPROACH_SUGGESTIONS_EN = [
  "Ship in 1–2 weeks",
  "Habit-forming",
  "Efficiency",
  "Start small",
  "Measure & improve",
  "Share the load",
] as const;

function requiredProgress(title: string, content: string): number {
  const titleScore = title.trim() ? 1 : Math.min(title.length / 12, 0.45);
  const contentScore = content.trim() ? 1 : Math.min(content.length / 80, 0.45);
  return Math.round(((titleScore + contentScore) / 2) * 100);
}

function fieldShellClass(focused: boolean, tick: boolean): string {
  return [
    "rounded-xl border bg-white px-3 py-2.5 text-sm outline-none",
    "transition-[border-color,box-shadow,background-color] duration-300 ease-out",
    focused
      ? "border-[#5E6AD2]/55 shadow-[0_0_0_3px_rgba(94,106,210,0.14),0_0_18px_rgba(94,106,210,0.18)]"
      : "border-zinc-200 shadow-none",
    tick ? "bg-[#F7F8FF]" : "bg-white",
  ].join(" ");
}

function CharCount({
  current,
  max,
  tick,
}: {
  current: number;
  max: number;
  tick: boolean;
}) {
  return (
    <p
      className={[
        "mt-1 text-right text-[11px] tabular-nums transition-all duration-300 ease-out",
        tick ? "scale-105 text-[#5E6AD2]" : "scale-100 text-zinc-400",
      ].join(" ")}
    >
      {current}/{max}
    </p>
  );
}

export function IdeaSubmissionModal({ open, contest, userId, demo, onClose, onSubmitted }: Props) {
  const { tx, locale } = useI18n();
  const [step, setStep] = useState<StepId>(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [appeal, setAppeal] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [roadmapLabel, setRoadmapLabel] = useState("");
  const [projects, setProjects] = useState<MemberProjectLite[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [focusedField, setFocusedField] = useState<"title" | "content" | "appeal" | "url" | null>(null);
  const [titleTick, setTitleTick] = useState(false);
  const [contentTick, setContentTick] = useState(false);
  const [appealTick, setAppealTick] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleTickTimer = useRef<number | null>(null);
  const contentTickTimer = useRef<number | null>(null);
  const appealTickTimer = useRef<number | null>(null);

  const suggestions = locale === "en" ? APPROACH_SUGGESTIONS_EN : APPROACH_SUGGESTIONS_JA;

  const steps = useMemo(
    () =>
      [
        { id: 0 as const, label: tx("アイデア名", "Idea name") },
        { id: 1 as const, label: tx("解決アプローチ", "Approach") },
        { id: 2 as const, label: tx("詳細・添付", "Details") },
      ] as const,
    [tx],
  );

  const progress = requiredProgress(title, content);
  const titleOk = Boolean(title.trim());
  const contentOk = Boolean(content.trim());
  const canGoNext =
    step === 0 ? titleOk : step === 1 ? contentOk : titleOk && contentOk;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTitle("");
    setContent(contest.promptHint ? `${contest.promptHint}\n\n` : "");
    setAppeal("");
    setExternalUrl("");
    setImageUrl(null);
    setRoadmapId(null);
    setRoadmapLabel("");
    setShowProjects(false);
    setError("");
    setBusy(false);
    setDone(false);
    setFocusedField(null);
  }, [open, contest]);

  useEffect(() => {
    if (!open || !showProjects) return;
    let cancelled = false;
    void loadMemberProjects(userId).then((rows) => {
      if (!cancelled) setProjects(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, showProjects, userId]);

  useEffect(() => {
    const titleTimer = titleTickTimer;
    const contentTimer = contentTickTimer;
    const appealTimer = appealTickTimer;
    return () => {
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
      if (contentTimer.current) window.clearTimeout(contentTimer.current);
      if (appealTimer.current) window.clearTimeout(appealTimer.current);
    };
  }, []);

  if (!open) return null;

  function pulseCount(kind: "title" | "content" | "appeal") {
    const setTick = kind === "title" ? setTitleTick : kind === "content" ? setContentTick : setAppealTick;
    const timerRef = kind === "title" ? titleTickTimer : kind === "content" ? contentTickTimer : appealTickTimer;
    setTick(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setTick(false), 280);
  }

  function insertSuggestion(tag: string) {
    const el = contentRef.current;
    const insert = tag.startsWith("・") || tag.startsWith("-") ? tag : `・${tag}`;
    const base = content;
    let next: string;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? base.length;
      const end = el.selectionEnd ?? base.length;
      const before = base.slice(0, start);
      const after = base.slice(end);
      const needsBreak = before.length > 0 && !before.endsWith("\n") && !before.endsWith(" ");
      const piece = `${needsBreak ? "\n" : ""}${insert}`;
      next = `${before}${piece}${after}`.slice(0, 4000);
      setContent(next);
      pulseCount("content");
      requestAnimationFrame(() => {
        const pos = before.length + piece.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    const needsBreak = base.length > 0 && !base.endsWith("\n");
    next = `${base}${needsBreak ? "\n" : ""}${insert}`.slice(0, 4000);
    setContent(next);
    pulseCount("content");
    contentRef.current?.focus();
  }

  async function onPickImage(file: File | null) {
    if (!file || !supabase) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadContestImage(supabase, userId, file);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onPickProject(projectId: string) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const rm = await createRoadmapFromProject(supabase, userId, projectId);
      setRoadmapId(rm.id);
      setRoadmapLabel(rm.title);
      setShowProjects(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setError(tx("タイトルと内容は必須です", "Title and content are required"));
      if (!title.trim()) setStep(0);
      else setStep(1);
      return;
    }
    if (demo) {
      setDone(true);
      burstCelebration();
      window.setTimeout(() => {
        onSubmitted();
        onClose();
      }, 900);
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      await submitContestIdea(supabase, userId, {
        contestId: contest.id,
        title,
        content,
        appeal,
        roadmapId,
        imageUrl,
        externalUrl,
      });
      setDone(true);
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

  function goNext() {
    setError("");
    if (step === 0 && !titleOk) {
      setError(tx("アイデア名を入力してください", "Please enter an idea name"));
      return;
    }
    if (step === 1 && !contentOk) {
      setError(tx("解決アプローチを入力してください", "Please enter your approach"));
      return;
    }
    if (step < 2) setStep((s) => (s + 1) as StepId);
  }

  function goPrev() {
    setError("");
    if (step > 0) setStep((s) => (s - 1) as StepId);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idea-submit-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={tx("戻る", "Back")}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {tx("アイデア応募", "Submit idea")}
            </p>
            <h2 id="idea-submit-title" className="mt-1 text-lg font-semibold text-zinc-950">
              {done ? tx("投稿完了！", "Posted!") : tx("自由形式で発表しよう", "Share in any format")}
            </h2>
          </div>
        </div>

        {!done ? (
          <div className="mb-4 space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-zinc-500">{tx("入力の進み具合", "Progress")}</p>
                <p
                  className={[
                    "text-[11px] font-semibold tabular-nums transition-colors duration-300",
                    progress >= 100 ? "text-emerald-600" : "text-zinc-500",
                  ].join(" ")}
                >
                  {progress}%
                </p>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label={tx("必須項目の進捗", "Required fields progress")}
              >
                <div
                  className={[
                    "h-full rounded-full transition-[width,background-color,box-shadow] duration-500 ease-out",
                    progress >= 100
                      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                      : "bg-zinc-800",
                  ].join(" ")}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ol className="flex items-center gap-1.5" aria-label={tx("入力ステップ", "Input steps")}>
              {steps.map((s, index) => {
                const active = step === s.id;
                const complete =
                  (s.id === 0 && titleOk) || (s.id === 1 && contentOk) || (s.id === 2 && step === 2);
                const reachable = s.id === 0 || (s.id === 1 && titleOk) || (s.id === 2 && titleOk && contentOk);
                return (
                  <li key={s.id} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!reachable && !active}
                      onClick={() => {
                        if (reachable || active) {
                          setError("");
                          setStep(s.id);
                        }
                      }}
                      className={[
                        "flex w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-all duration-300",
                        active ? "bg-zinc-50" : "bg-transparent",
                        !reachable && !active ? "opacity-45" : "opacity-100",
                      ].join(" ")}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className={[
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300",
                          active
                            ? "bg-zinc-900 text-white shadow-[0_0_0_3px_rgba(24,24,27,0.08)]"
                            : complete
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-zinc-100 text-zinc-500",
                        ].join(" ")}
                      >
                        {complete && !active ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
                      </span>
                      <span
                        className={[
                          "w-full truncate text-center text-[10px] font-semibold transition-colors duration-300",
                          active ? "text-zinc-900" : "text-zinc-400",
                        ].join(" ")}
                      >
                        {s.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Check className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm text-zinc-600">{tx("ギャラリーに載りました", "It’s in the gallery")}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {step === 0 ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">
                  {tx("アイデア名（必須・40字）", "Title (required, 40)")}
                </label>
                <p className="mb-2 text-[12px] leading-relaxed text-zinc-500">
                  {tx(
                    "ひと目で伝わる短い名前にしましょう。あとから変えられます。",
                    "Keep it short and clear. You can edit later.",
                  )}
                </p>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value.slice(0, 40));
                    pulseCount("title");
                  }}
                  onFocus={() => setFocusedField("title")}
                  onBlur={() => setFocusedField((f) => (f === "title" ? null : f))}
                  className={`w-full ${fieldShellClass(focusedField === "title", titleTick)}`}
                  placeholder={tx("例: 机の外に充電ステーション", "e.g. Charge station outside the desk")}
                  autoFocus
                />
                <CharCount current={title.length} max={40} tick={titleTick} />
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500">
                  {tx("解決アプローチ / 内容（必須）", "Approach / content (required)")}
                </label>
                <p className="mb-2 text-[12px] leading-relaxed text-zinc-500">
                  {tx(
                    "手順・理由・工夫など、自由に書いてください。下のタグを押すと挿入できます。",
                    "Steps, why, tips — free form. Tap a tag below to insert it.",
                  )}
                </p>
                <textarea
                  ref={contentRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value.slice(0, 4000));
                    pulseCount("content");
                  }}
                  onFocus={() => setFocusedField("content")}
                  onBlur={() => setFocusedField((f) => (f === "content" ? null : f))}
                  rows={8}
                  className={`w-full resize-y leading-relaxed ${fieldShellClass(focusedField === "content", contentTick)}`}
                  placeholder={tx("Markdown可。手順・理由・工夫など自由に", "Markdown OK. Steps, why, tips…")}
                  autoFocus
                />
                <CharCount current={content.length} max={4000} tick={contentTick} />

                <div className="mt-2">
                  <p className="mb-1.5 text-[11px] font-semibold text-zinc-500">
                    {tx("キーワードを挿入", "Insert a keyword")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertSuggestion(tag)}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition-all duration-200 hover:border-zinc-300 hover:bg-white hover:shadow-sm active:scale-95"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">
                    {tx("アピールポイント（任意）", "Pitch (optional)")}
                  </label>
                  <input
                    value={appeal}
                    onChange={(e) => {
                      setAppeal(e.target.value.slice(0, 140));
                      pulseCount("appeal");
                    }}
                    onFocus={() => setFocusedField("appeal")}
                    onBlur={() => setFocusedField((f) => (f === "appeal" ? null : f))}
                    className={`w-full ${fieldShellClass(focusedField === "appeal", appealTick)}`}
                    placeholder={tx("推しポイントを一言で", "One-line highlight")}
                    autoFocus
                  />
                  <CharCount current={appeal.length} max={140} tick={appealTick} />
                </div>

                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-zinc-500">{tx("添付（任意）", "Attachments (optional)")}</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50">
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                      {uploading ? tx("アップロード中…", "Uploading…") : tx("画像", "Image")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading || demo}
                        onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowProjects((v) => !v)}
                      disabled={demo}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#5E6AD2] ring-1 ring-[#D8DCFF] transition hover:bg-[#F7F8FF] disabled:opacity-50"
                    >
                      <Map className="h-3.5 w-3.5" aria-hidden />
                      {tx("ロードマップ", "Roadmap")}
                    </button>
                  </div>

                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
                  ) : null}
                  {roadmapLabel ? (
                    <p className="mt-2 text-xs font-medium text-[#5E6AD2]">
                      {tx("連携中:", "Linked:")} {roadmapLabel}
                    </p>
                  ) : null}

                  {showProjects ? (
                    <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                      {projects.length === 0 ? (
                        <li className="px-2 py-3 text-center text-xs text-zinc-400">
                          {tx("プロジェクトがありません", "No projects")}
                        </li>
                      ) : (
                        projects.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onPickProject(p.id)}
                              className="flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-left text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200 transition hover:ring-[#5E6AD2]/50"
                            >
                              <span aria-hidden>{p.icon || "📁"}</span>
                              <span className="truncate">{p.name}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}

                  <div className="mt-2">
                    <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                      <Link2 className="h-3 w-3" aria-hidden />
                      {tx("外部URL（Figma / GitHub / Web）", "External URL")}
                    </label>
                    <input
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value.slice(0, 500))}
                      onFocus={() => setFocusedField("url")}
                      onBlur={() => setFocusedField((f) => (f === "url" ? null : f))}
                      className={`w-full rounded-lg ${fieldShellClass(focusedField === "url", false)}`}
                      placeholder="https://"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-1 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  {tx("前へ", "Back")}
                </button>
              ) : null}

              {step < 2 ? (
                <DuoButton type="button" fullWidth disabled={!canGoNext} onClick={goNext}>
                  <span className="inline-flex items-center gap-1.5">
                    {tx("次へ", "Next")}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                </DuoButton>
              ) : (
                <DuoButton
                  type="button"
                  fullWidth
                  disabled={busy || uploading || !titleOk || !contentOk}
                  onClick={() => void submit()}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tx("投稿中…", "Posting…")}
                    </span>
                  ) : (
                    tx("コンテストに応募", "Submit entry")
                  )}
                </DuoButton>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
