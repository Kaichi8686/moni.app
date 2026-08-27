"use client";

import { FormEvent, useEffect, useState } from "react";
import type { IdeaVotingSettings } from "@/lib/projects/ideaVoting/types";
import { voteBtnPrimary, voteCard, voteInput } from "@/components/projects/idea-voting/voteUi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  settings: IdeaVotingSettings;
  onSave: (settings: IdeaVotingSettings) => void;
};

export function IdeaVotingSettingsPanel({ settings, onSave }: Props) {
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  const [votesPerPerson, setVotesPerPerson] = useState(String(settings.votesPerPerson));
  const [maxVotesPerIdea, setMaxVotesPerIdea] = useState(String(settings.maxVotesPerIdea));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVotesPerPerson(String(settings.votesPerPerson));
    setMaxVotesPerIdea(String(settings.maxVotesPerIdea));
  }, [settings]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: IdeaVotingSettings = {
      votesPerPerson: clamp(Number(votesPerPerson), 1, 10),
      maxVotesPerIdea: clamp(Number(maxVotesPerIdea), 1, 10),
    };
    onSave(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className={`${voteCard} px-3 py-2`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className="text-[12px] text-zinc-600">
          <span className="font-medium text-zinc-900">{tx("ルール", "Rules")}</span>
          <span className="ml-2 text-zinc-500">
            {tx(
              `1人${settings.votesPerPerson}票 · 1案最大${settings.maxVotesPerIdea}票`,
              `${settings.votesPerPerson} votes each · max ${settings.maxVotesPerIdea} per option`,
            )}
          </span>
        </p>
        <span className="text-[11px] font-medium text-zinc-900">{open ? tx("閉じる", "Close") : tx("編集", "Edit")}</span>
      </button>

      {open ? (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2 border-t border-zinc-200 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-zinc-500">{tx("1人あたり", "Per person")}</span>
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
              <span className="text-[11px] text-zinc-500">{tx("1案の上限", "Per option")}</span>
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
          <div className="flex items-center justify-end gap-2">
            {saved ? <p className="text-[11px] text-zinc-500">{tx("保存済み", "Saved")}</p> : null}
            <button type="submit" className={voteBtnPrimary}>
              {tx("保存", "Save")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}
