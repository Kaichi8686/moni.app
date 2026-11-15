"use client";

import { useEffect, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { OFFICE_ANSWER_MAX, OFFICE_ANSWER_MIN } from "@/lib/office/constants";
import { formatRemainMmSs, msUntil } from "@/lib/office/stamina";
import type { OfficeIncident } from "@/lib/office/types";

const TYPE_LABEL: Record<OfficeIncident["type"], string> = {
  pinch: "ピンチ",
  chance: "チャンス",
  people: "ひと",
  rival: "ライバル",
};

type Props = {
  incident: OfficeIncident | null;
  stamina: number;
  nextRecoverAt: string | null;
  busy: boolean;
  onSubmit: (answer: string) => void;
};

export function IncidentPanel({ incident, stamina, nextRecoverAt, busy, onSubmit }: Props) {
  const [answer, setAnswer] = useState("");
  const recovering = stamina <= 0 && Boolean(nextRecoverAt);
  const [now, setNow] = useState(() => Date.now());
  const canSubmit = stamina > 0 && answer.trim().length >= OFFICE_ANSWER_MIN && !busy;

  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, nextRecoverAt]);

  const remain = recovering && nextRecoverAt ? msUntil(new Date(nextRecoverAt), new Date(now)) : null;

  if (!incident) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-6 text-center text-sm text-zinc-500">
        事件を用意してるよ…
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-amber-100 bg-gradient-to-r from-[#FFF7E8] to-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9600]">
            事件 · {TYPE_LABEL[incident.type]}
          </p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
            規模 ×{incident.size}
          </span>
        </div>
        <h3 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{incident.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{incident.description}</p>
      </div>

      <div className="space-y-3 px-4 py-4">
        <label className="block">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-zinc-600">解決アイデア</span>
            <span className="text-[11px] tabular-nums text-zinc-400">
              {answer.length}/{OFFICE_ANSWER_MAX}
            </span>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, OFFICE_ANSWER_MAX))}
            rows={4}
            className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none ring-[#FF9600] focus:ring-2"
            placeholder="ラフでOK。面白くても、真面目でも大丈夫。"
          />
        </label>

        {stamina <= 0 ? (
          <p className="text-center text-sm font-semibold text-zinc-500">
            スタミナ切れ… 回復まで {remain != null ? formatRemainMmSs(remain) : "しばらく"}
          </p>
        ) : null}

        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={() => onSubmit(answer.trim())}
        >
          {busy ? "採点中…" : "提出する"}
        </DuoButton>
      </div>
    </section>
  );
}
