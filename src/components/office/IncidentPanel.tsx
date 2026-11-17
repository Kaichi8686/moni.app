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
    setStrategyId(incident?.strategies?.length ? null : "custom");
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
      <section className="rounded-3xl border border-dashed border-white/80 bg-white/75 p-8 text-center text-base text-zinc-500 shadow-[0_12px_40px_rgba(28,25,23,0.08)] backdrop-blur-md">
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
      if (!next.strategies.length) {
        setStrategyId("custom");
      } else if (
        strategyId &&
        strategyId !== "custom" &&
        !next.strategies.some((s) => s.id === strategyId)
      ) {
        setStrategyId(null);
      }
    } finally {
      setRerolling(false);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md ${
        playEnter ? "office-incident-enter" : ""
      }`}
    >
      <div className={`border-b border-white/50 bg-gradient-to-r px-5 py-4 sm:px-6 sm:py-5 ${ui.bar}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${ui.chip}`}>
            {ui.label}
          </p>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-zinc-700 ring-1 ring-zinc-200">
            大きさ ×{localIncident.size}
          </span>
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <span aria-hidden>{ind?.icon ?? "🏢"}</span>
          <span className="truncate">{company.name}</span>
        </p>
        <h3 className="mt-1.5 text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">
          {localIncident.title}
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 sm:text-base">
          {localIncident.description}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
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
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-zinc-600">解決アイデア</span>
            <span className="text-xs tabular-nums text-zinc-400">
              {answer.length}/{OFFICE_ANSWER_MAX}
            </span>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, OFFICE_ANSWER_MAX))}
            rows={5}
            className="w-full resize-y rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3.5 text-[15px] leading-relaxed outline-none ring-[#FF9600] focus:ring-2 sm:text-base"
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
