"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { castMemberByRole, type CastMember } from "@/lib/office/cast";
import {
  applyNamePlaceholders,
  type IncidentMission,
  type IncidentQuestion,
} from "@/lib/office/script";

const MAX_ASKS = 2;

type Props = {
  questions: IncidentQuestion[];
  mission: IncidentMission | null;
  cast: CastMember[];
  askedIds: string[];
  onAskedIds: (ids: string[]) => void;
  onNext: () => void;
};

export function AskStep({
  questions,
  mission,
  cast,
  askedIds,
  onAskedIds,
  onNext,
}: Props) {
  const [reply, setReply] = useState<{
    id: string;
    text: string;
    speaker: string;
  } | null>(null);
  const remaining = Math.max(0, MAX_ASKS - askedIds.length);
  const clues = useMemo(() => {
    return questions
      .filter((q) => askedIds.includes(q.id))
      .map((q) => applyNamePlaceholders(q.clue, cast));
  }, [questions, askedIds, cast]);

  function ask(q: IncidentQuestion) {
    if (askedIds.includes(q.id)) return;
    if (askedIds.length >= MAX_ASKS) return;
    const member = castMemberByRole(cast, q.actor);
    const text = applyNamePlaceholders(q.answer, cast);
    onAskedIds([...askedIds, q.id]);
    setReply({
      id: q.id,
      text,
      speaker: member?.name ?? "社員",
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md sm:p-5">
      {mission ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
          <p className="text-[10px] font-bold text-amber-700">ミッション</p>
          <p className="mt-0.5 text-sm font-black text-zinc-900">{mission.goal}</p>
          <p className="mt-0.5 text-xs font-medium text-zinc-600">制約: {mission.constraint}</p>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
          聞き込み
        </p>
        <h3 className="mt-1 text-lg font-black text-zinc-900">社員に聞いてみよう</h3>
        <p className="mt-1 text-sm text-zinc-600">
          最大{MAX_ASKS}つまで。残り <span className="font-bold text-[#FF9600]">{remaining}</span>
        </p>
      </div>

      <div className="space-y-2">
        {questions.map((q) => {
          const used = askedIds.includes(q.id);
          const locked = !used && askedIds.length >= MAX_ASKS;
          return (
            <button
              key={q.id}
              type="button"
              disabled={used || locked}
              onClick={() => ask(q)}
              className={`w-full rounded-2xl border px-3.5 py-3 text-left text-sm font-bold transition ${
                used
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : locked
                    ? "border-zinc-100 bg-zinc-50 text-zinc-300"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-amber-200 hover:bg-amber-50/50"
              }`}
            >
              {q.ask}
              {used ? <span className="ml-2 text-[10px] font-semibold">聞いた</span> : null}
            </button>
          );
        })}
      </div>

      {reply ? (
        <div className="rounded-2xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400">{reply.speaker}</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-800">{reply.text}</p>
        </div>
      ) : null}

      {clues.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-400">手がかりメモ</p>
          <ul className="flex flex-wrap gap-1.5">
            {clues.map((c) => (
              <li
                key={c}
                className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-100"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onNext}>
        作戦を考える
      </DuoButton>
      {askedIds.length === 0 ? (
        <button
          type="button"
          onClick={onNext}
          className="w-full text-center text-xs font-bold text-zinc-400 hover:text-zinc-600"
        >
          聞かずに進む
        </button>
      ) : null}
    </section>
  );
}

export { MAX_ASKS as OFFICE_MAX_ASKS };
