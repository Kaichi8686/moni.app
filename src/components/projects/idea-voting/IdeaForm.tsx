"use client";

import { FormEvent, useState } from "react";
import { voteBtnPrimary, voteCard, voteInput } from "@/components/projects/idea-voting/voteUi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  disabled?: boolean;
  anonymousMode: boolean;
  posterName?: string;
  heading?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
};

export function IdeaForm({
  disabled = false,
  anonymousMode,
  posterName,
  heading,
  placeholder,
  submitLabel,
  onSubmit,
}: Props) {
  const { tx } = useI18n();
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className={`${voteCard} p-3`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">
          {heading ?? tx(`アイデアを投稿${anonymousMode ? "（匿名）" : ""}`, anonymousMode ? "Post an idea (anonymous)" : "Post an idea")}
        </h2>
        <span className="text-[11px] tabular-nums text-zinc-400">{text.length}/500</span>
      </div>
      {!anonymousMode && posterName ? (
        <p className="mb-2 text-[11px] text-zinc-500">
          {tx("投稿者", "Posted by")} <span className="font-medium text-zinc-800">{posterName}</span>
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={500}
        placeholder={placeholder ?? tx("例: 週末に試作する / 役割分担を決める…", "e.g. Prototype this weekend / assign roles…")}
        className={`${voteInput} min-h-[4.5rem] resize-y leading-relaxed disabled:opacity-50`}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-400">
          {anonymousMode ? tx("名前は出ません", "Name stays hidden") : tx("名前付きで追加", "Added with your name")}
        </p>
        <button type="submit" disabled={disabled || !text.trim()} className={voteBtnPrimary}>
          {submitLabel ?? tx("投稿する", "Post")}
        </button>
      </div>
    </form>
  );
}
