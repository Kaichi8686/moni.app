"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { voteBtnGhost, voteBtnPrimary, voteCard, voteInput } from "@/components/projects/idea-voting/voteUi";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type VoteEventCreateInput = {
  title: string;
  description: string;
  closesAt: string;
  anonymous: boolean;
  votesPerPerson: number;
  maxVotesPerIdea: number;
  options: string[];
};

function clampVoteLimit(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, Math.round(n)));
}

export function VoteEventCreateForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: VoteEventCreateInput) => void;
}) {
  const { tx } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [votesPerPerson, setVotesPerPerson] = useState("1");
  const [maxVotesPerIdea, setMaxVotesPerIdea] = useState("1");
  const [options, setOptions] = useState(["", ""]);

  const filledOptions = options.map((item) => item.trim()).filter(Boolean);
  const canSubmit = Boolean(title.trim()) && filledOptions.length >= 2 && !busy;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const perPerson = clampVoteLimit(Number(votesPerPerson));
    const perIdea = Math.min(perPerson, clampVoteLimit(Number(maxVotesPerIdea)));
    onSubmit({
      title,
      description,
      closesAt,
      anonymous,
      votesPerPerson: perPerson,
      maxVotesPerIdea: perIdea,
      options: filledOptions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${voteCard} space-y-3 rounded-2xl p-3`}>
      <p className="text-[13px] font-semibold tracking-tight text-zinc-900">{tx("新しい投票", "New vote")}</p>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={tx("何を決める？（例: 文化祭の出し物）", "What are you deciding? (e.g. festival booth)")}
        className={voteInput}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder={tx("説明（任意）", "Description (optional)")}
        className={`${voteInput} resize-y`}
      />
      <label className="block">
        <span className="text-[11px] text-zinc-500">{tx("締切", "Deadline")}</span>
        <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${voteInput} mt-0.5`} />
      </label>

      <fieldset className="space-y-2 border-t border-zinc-200 pt-3">
        <legend className="text-[12px] font-medium text-zinc-900">{tx("ルール", "Rules")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-zinc-500">{tx("1人あたりの票", "Votes per person")}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={votesPerPerson}
              onChange={(e) => setVotesPerPerson(e.target.value)}
              className={`${voteInput} mt-0.5`}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-zinc-500">{tx("1つの選択肢の上限", "Max per option")}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxVotesPerIdea}
              onChange={(e) => setMaxVotesPerIdea(e.target.value)}
              className={`${voteInput} mt-0.5`}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-700">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded-[2px] border-zinc-400" />
          {tx("匿名投票", "Anonymous voting")}
        </label>
      </fieldset>

      <fieldset className="space-y-2 border-t border-zinc-200 pt-3">
        <legend className="text-[12px] font-medium text-zinc-900">{tx("選択肢", "Options")}</legend>
        <p className="text-[11px] text-zinc-500">{tx("2つ以上入れてください", "Add at least two")}</p>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder={tx(`選択肢 ${index + 1}`, `Option ${index + 1}`)}
              className={voteInput}
            />
            {options.length > 2 ? (
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label={tx("選択肢を削除", "Remove option")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={() => setOptions((prev) => [...prev, ""])} className={voteBtnGhost}>
          <Plus className="h-3.5 w-3.5" />
          {tx("選択肢を追加", "Add option")}
        </button>
      </fieldset>

      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={voteBtnGhost}>
          {tx("キャンセル", "Cancel")}
        </button>
        <button type="submit" disabled={!canSubmit} className={voteBtnPrimary}>
          {busy ? tx("作成中…", "Creating…") : tx("作成", "Create")}
        </button>
      </div>
    </form>
  );
}
