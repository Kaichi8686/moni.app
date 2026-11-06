"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { voteInput } from "@/components/projects/idea-voting/voteUi";
import { createIdea, createVoteEvent } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

function localDatetimeToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ToggleRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-zinc-900">{label}</p>
        {detail ? <p className="mt-0.5 text-[11px] text-zinc-500">{detail}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#FF9600]" : "bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-[left] ${
            checked ? "left-[1.35rem]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/** 投票作成専用画面。メッセージの作成カードから遷移する。 */
export default function WorkspaceVoteCreate() {
  const { tx } = useI18n();
  const router = useRouter();
  const { projectId, loading, uid } = useProjectWorkspace();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const messagesHref = `/messages?project=${encodeURIComponent(projectId)}`;
  const filledOptions = options.map((item) => item.trim()).filter(Boolean);
  const canSubmit = Boolean(title.trim()) && filledOptions.length >= 2 && !busy && Boolean(uid);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit || !uid || !supabase) return;
    setBusy(true);
    setError("");
    try {
      const votesPerPerson = allowMultiple ? 3 : 1;
      const maxVotesPerIdea = 1;
      const created = await createVoteEvent(projectId, uid, {
        title: title.trim(),
        description: description.trim(),
        closesAt: localDatetimeToIso(closesAt),
        anonymous,
        votesPerPerson,
        maxVotesPerIdea,
      });
      const author = anonymous ? null : tx("メンバー", "Member");
      for (const text of filledOptions) {
        try {
          await createIdea(projectId, uid, text, author, created.id);
        } catch (err) {
          console.warn("createIdea", err);
        }
      }
      router.replace(`/projects/${projectId}/ideas?event=${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tx("作成に失敗しました", "Couldn’t create"));
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  }

  return (
    <div
      className={`mx-auto max-w-lg transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 pb-[calc(var(--bottom-nav-clearance)+5.5rem)]"
      >
        <div>
          <Link
            href={messagesHref}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tx("メッセージ", "Messages")}
          </Link>
          <h1 className="mt-2 text-[18px] font-extrabold tracking-tight text-zinc-900">
            {tx("投票を作成", "Create a vote")}
          </h1>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-zinc-700">{tx("タイトル", "Title")}</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tx("何を決める？（例: 文化祭の出し物）", "What are you deciding?")}
            className={`${voteInput} !rounded-2xl !px-3 !py-2.5 !text-[15px]`}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-zinc-700">{tx("説明", "Description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={tx("補足や背景（任意）", "Context (optional)")}
            className={`${voteInput} !rounded-2xl !px-3 !py-2.5 !text-[14px] resize-y`}
          />
        </label>

        <section className="space-y-1 rounded-2xl border border-zinc-200 px-3 py-1">
          <ToggleRow
            label={tx("匿名投票", "Anonymous voting")}
            detail={tx("誰が入れたかは見えません", "Voters stay hidden")}
            checked={anonymous}
            onChange={setAnonymous}
          />
          <div className="border-t border-zinc-100" />
          <ToggleRow
            label={tx("複数投票", "Multiple votes")}
            detail={tx("1人あたり3票まで入れられます", "Up to 3 votes per person")}
            checked={allowMultiple}
            onChange={setAllowMultiple}
          />
        </section>

        <section className="space-y-2">
          <div>
            <p className="text-[12px] font-semibold text-zinc-700">{tx("候補", "Options")}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{tx("2つ以上入れてください", "Add at least two")}</p>
          </div>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={tx(`候補 ${index + 1}`, `Option ${index + 1}`)}
                className={`${voteInput} !rounded-2xl !px-3 !py-2.5`}
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={tx("候補を削除", "Remove option")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="inline-flex items-center gap-1 rounded-2xl px-2 py-2 text-[13px] font-semibold text-[#FF9600] hover:bg-orange-50"
          >
            <Plus className="h-4 w-4" />
            {tx("候補を追加", "Add option")}
          </button>
        </section>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-zinc-700">{tx("締切", "Deadline")}</span>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className={`${voteInput} !rounded-2xl !px-3 !py-2.5`}
          />
          <p className="text-[11px] text-zinc-400">{tx("空欄なら締切なし", "Leave blank for no deadline")}</p>
        </label>

        {error ? (
          <p className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</p>
        ) : null}
      </form>

      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-clearance)] z-30 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <DuoButton
            type="button"
            tone="orange"
            size="md"
            fullWidth
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="!shadow-none enabled:active:!translate-y-0"
          >
            {busy ? tx("作成中…", "Creating…") : tx("作成", "Create")}
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
