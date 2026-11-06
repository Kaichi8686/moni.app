"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ImagePlus, Loader2, Map, Link2 } from "lucide-react";
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

export function IdeaSubmissionModal({ open, contest, userId, demo, onClose, onSubmitted }: Props) {
  const { tx } = useI18n();
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

  useEffect(() => {
    if (!open) return;
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

  if (!open) return null;

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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idea-submit-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={tx("戻る", "Back")}
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
              {tx("応募", "Submit")}
            </p>
            <h2 id="idea-submit-title" className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
              {done ? tx("投稿完了", "Posted") : tx("アイデアを発表", "Share an idea")}
            </h2>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm text-zinc-600">{tx("ギャラリーに載りました", "It’s in the gallery")}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {tx("タイトル", "Title")}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                placeholder={tx("例: 机の外に充電ステーション", "e.g. Charge station outside the desk")}
              />
              <p className="mt-1 text-right text-[11px] tabular-nums text-zinc-400">{title.length}/40</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {tx("内容", "Content")}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 4000))}
                rows={7}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-zinc-400"
                placeholder={tx("Markdown可。手順・理由・工夫など自由に", "Markdown OK. Steps, why, tips…")}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                {tx("アピール（任意）", "Pitch (optional)")}
              </label>
              <input
                value={appeal}
                onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                placeholder={tx("推しポイントを一言で", "One-line highlight")}
              />
            </div>

            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-500">{tx("添付（任意）", "Attachments")}</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Map className="h-3.5 w-3.5" aria-hidden />
                  {tx("ロードマップ", "Roadmap")}
                </button>
              </div>

              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="mt-2 h-24 w-full rounded-xl border border-zinc-200 object-cover" />
              ) : null}
              {roadmapLabel ? (
                <p className="mt-2 text-xs font-medium text-zinc-600">
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
                          className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-left text-xs font-medium text-zinc-800 transition hover:border-zinc-300"
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
                <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                  <Link2 className="h-3 w-3" aria-hidden />
                  {tx("外部URL", "External URL")}
                </label>
                <input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value.slice(0, 500))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                  placeholder="https://"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy || uploading || !title.trim() || !content.trim()}
              onClick={() => void submit()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[13px] font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tx("投稿中…", "Posting…")}
                </span>
              ) : (
                tx("応募する", "Submit")
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
