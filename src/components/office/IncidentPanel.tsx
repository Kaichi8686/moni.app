"use client";

import { useEffect, useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { StrategyPicker } from "@/components/office/StrategyPicker";
import { TargetPicker } from "@/components/office/TargetPicker";
import {
  INCIDENT_TYPE_UI,
  OFFICE_ANSWER_MAX,
  OFFICE_ANSWER_MIN,
  OFFICE_TARGET_OTHER_MAX,
} from "@/lib/office/constants";
import { industryMeta } from "@/lib/office/industries";
import { formatRemainMmSs, msUntil } from "@/lib/office/stamina";
import type {
  IncidentTargetPublic,
  OfficeCompany,
  OfficeIncident,
  OfficeSubmitInput,
} from "@/lib/office/types";

type Props = {
  incident: OfficeIncident | null;
  company: OfficeCompany;
  stamina: number;
  nextRecoverAt: string | null;
  busy: boolean;
  playEnter?: boolean;
  onSubmit: (input: OfficeSubmitInput) => void;
  onRerollStrategies: () => Promise<OfficeIncident>;
};

export function IncidentPanel({
  incident,
  company,
  stamina,
  nextRecoverAt,
  busy,
  playEnter = false,
  onSubmit,
  onRerollStrategies,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [rerolling, setRerolling] = useState(false);
  const [localIncident, setLocalIncident] = useState(incident);
  const recovering = stamina <= 0 && Boolean(nextRecoverAt);
  const [now, setNow] = useState(() => Date.now());
  const ind = industryMeta(company.industry);

  useEffect(() => {
    setLocalIncident(incident);
    setAnswer("");
    setStrategyId(null);
    setTargetIds([]);
    setOtherText("");
  }, [incident?.id]);

  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, nextRecoverAt]);

  const remain = recovering && nextRecoverAt ? msUntil(new Date(nextRecoverAt), new Date(now)) : null;

  const targets = useMemo<IncidentTargetPublic[]>(
    () => (localIncident?.targets ?? []).map(({ id, label }) => ({ id, label })),
    [localIncident],
  );

  const placeholder =
    strategyId === "custom"
      ? "自分の作戦をどう実行する？具体的に書いてね。"
      : strategyId
        ? "この作戦をどう実行する？具体的に書いてね。"
        : "ラフでOK。面白くても、真面目でも大丈夫。";

  const otherOk =
    !targetIds.includes("other") ||
    (otherText.trim().length >= 1 && otherText.trim().length <= OFFICE_TARGET_OTHER_MAX);

  const canSubmit =
    stamina > 0 &&
    !busy &&
    Boolean(strategyId) &&
    targetIds.length >= 1 &&
    otherOk &&
    answer.trim().length >= OFFICE_ANSWER_MIN;

  if (!localIncident) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-6 text-center text-sm text-zinc-500">
        事件を用意してるよ…
      </section>
    );
  }

  const ui = INCIDENT_TYPE_UI[localIncident.type];

  function toggleTarget(id: string) {
    setTargetIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function handleReroll() {
    setRerolling(true);
    try {
      const next = await onRerollStrategies();
      setLocalIncident(next);
      if (strategyId && strategyId !== "custom" && !next.strategies.some((s) => s.id === strategyId)) {
        setStrategyId(null);
      }
    } finally {
      setRerolling(false);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white ${
        playEnter ? "office-incident-enter" : ""
      }`}
    >
      <div className={`border-b bg-gradient-to-r px-4 py-3 ${ui.bar}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${ui.chip}`}>
            {ui.label}
          </p>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-zinc-200">
            大きさ ×{localIncident.size}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
          <span aria-hidden>{ind?.icon ?? "🏢"}</span>
          <span className="truncate">{company.name}</span>
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{localIncident.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{localIncident.description}</p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <StrategyPicker
          strategies={localIncident.strategies}
          selectedId={strategyId}
          canReroll={(localIncident.strategyRerolls ?? 0) < 1}
          rerolling={rerolling}
          onSelect={setStrategyId}
          onReroll={() => void handleReroll()}
        />

        <TargetPicker
          targets={targets}
          selectedIds={targetIds}
          otherText={otherText}
          onToggle={toggleTarget}
          onOtherText={setOtherText}
        />

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
            placeholder={placeholder}
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
          onClick={() =>
            onSubmit({
              answer: answer.trim(),
              strategyId: strategyId!,
              targetIds,
              targetOtherText: targetIds.includes("other") ? otherText.trim() : null,
            })
          }
        >
          {busy ? "採点中…" : "提出する"}
        </DuoButton>
      </div>
    </section>
  );
}
