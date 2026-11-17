"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { CompanyCard } from "@/components/office/CompanyCard";
import { NameSetup } from "@/components/office/NameSetup";
import { OfficeScene } from "@/components/office/OfficeScene";
import { RankingPanel } from "@/components/office/RankingPanel";
import { SeasonResultModal } from "@/components/office/SeasonResultModal";
import { IncidentStep } from "@/components/office/play/IncidentStep";
import {
  PlayStepper,
  previousPlayStep,
  type PlayStep,
} from "@/components/office/play/PlayStepper";
import { ResultStep } from "@/components/office/play/ResultStep";
import { StrategyStep } from "@/components/office/play/StrategyStep";
import { TargetStep } from "@/components/office/play/TargetStep";
import { WriteStep } from "@/components/office/play/WriteStep";
import {
  createCompany,
  fetchCompany,
  fetchIncident,
  fetchRanking,
  markResultSeen,
  rerollStrategies,
  setAbout,
  submitAnswer,
  toggleRanking,
  type CompanyPayload,
} from "@/lib/office/clientApi";
import {
  OFFICE_ANSWER_MIN,
  OFFICE_TARGET_OTHER_MAX,
} from "@/lib/office/constants";
import { pickIncidentSpeech } from "@/lib/office/incidentSpeech";
import { formatRemainMmSs, msUntil } from "@/lib/office/stamina";
import type {
  OfficeIncident,
  OfficeSubmission,
  OfficeSubmitInput,
  RankingRow,
} from "@/lib/office/types";

type Props = {
  embedded?: boolean;
  hideChrome?: boolean;
  active?: boolean;
};

type Tab = "play" | "rank";

function preferReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function OfficeApp({ embedded, hideChrome, active = true }: Props) {
  const [tab, setTab] = useState<Tab>("play");
  const [boot, setBoot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<CompanyPayload | null>(null);
  const [incident, setIncident] = useState<OfficeIncident | null>(null);
  const [step, setStep] = useState<PlayStep>("strategy");
  const [playEnter, setPlayEnter] = useState(false);
  const [sceneFx, setSceneFx] = useState<string | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [answer, setAnswer] = useState("");
  const [rerolling, setRerolling] = useState(false);
  const [lastSubmit, setLastSubmit] = useState<OfficeSubmission | null>(null);
  const [rankRows, setRankRows] = useState<RankingRow[]>([]);
  const [rankMeta, setRankMeta] = useState<{
    seasonKey: string;
    leagueId: string;
    myRank: number | null;
    rankingEnabled: boolean;
  } | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const clearAdvance = useCallback(() => {
    if (advanceTimer.current != null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const scheduleAdvance = useCallback(
    (next: PlayStep) => {
      clearAdvance();
      const delay = preferReducedMotion() ? 0 : 400;
      advanceTimer.current = window.setTimeout(() => {
        setStep(next);
        advanceTimer.current = null;
      }, delay);
    },
    [clearAdvance],
  );

  useEffect(() => () => clearAdvance(), [clearAdvance]);

  const resetChoices = useCallback(() => {
    clearAdvance();
    setStrategyId(null);
    setTargetIds([]);
    setOtherText("");
    setAnswer("");
  }, [clearAdvance]);

  const triggerFx = useCallback((type: string) => {
    if (preferReducedMotion()) {
      setSceneFx(null);
      setPlayEnter(true);
      return;
    }
    setSceneFx(type);
    window.setTimeout(() => setSceneFx(null), 1600);
    setPlayEnter(true);
  }, []);

  const loadIncident = useCallback(
    async (opts?: { allowFx?: boolean }) => {
      const { incident: inc, created } = await fetchIncident();
      setIncident(inc);
      resetChoices();
      setLastSubmit(null);
      if (opts?.allowFx && created) {
        setStep("incident");
        triggerFx(inc.type);
      } else {
        setStep("strategy");
        setPlayEnter(false);
        setSceneFx(null);
      }
    },
    [resetChoices, triggerFx],
  );

  const reload = useCallback(async () => {
    setErr("");
    const data = await fetchCompany();
    setPayload(data);
    if (data.company?.about) {
      try {
        await loadIncident({ allowFx: false });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "事件の取得に失敗");
      }
    } else {
      setIncident(null);
    }
  }, [loadIncident]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "読み込み失敗");
      } finally {
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, reload]);

  useEffect(() => {
    if (!active || tab !== "rank") return;
    void (async () => {
      try {
        const r = await fetchRanking();
        setRankRows(r.rows);
        setRankMeta({
          seasonKey: r.seasonKey,
          leagueId: r.leagueId,
          myRank: r.myRank,
          rankingEnabled: r.rankingEnabled,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "ランキング取得失敗");
      }
    })();
  }, [active, tab, payload?.company?.id, payload?.seasonRevenue]);

  async function onSetup(input: { name: string; about: string }) {
    setBusy(true);
    setErr("");
    try {
      if (payload?.company && !payload.company.about) {
        await setAbout(input.about);
      } else {
        await createCompany(input.name, input.about);
      }
      const data = await fetchCompany();
      setPayload(data);
      await loadIncident({ allowFx: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "作成失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!strategyId) return;
    setBusy(true);
    setErr("");
    try {
      const input: OfficeSubmitInput = {
        answer: answer.trim(),
        strategyId,
        targetIds,
        targetOtherText: targetIds.includes("other") ? otherText.trim() : null,
      };
      const res = await submitAnswer(input);
      setLastSubmit(res.submission);
      setPayload({
        company: res.company,
        stamina: res.stamina,
        seasonRevenue: res.seasonRevenue,
        pendingResult: payload?.pendingResult ?? null,
      });
      setIncident(null);
      setPlayEnter(false);
      setStep("result");
      const tone = res.submission.storyTone;
      triggerFx(tone === "great" ? "chance" : tone === "bitter" ? "people" : "rival");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提出失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onNextIncident() {
    setLastSubmit(null);
    setBusy(true);
    try {
      await loadIncident({ allowFx: true });
      const data = await fetchCompany();
      setPayload(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "次の事件の取得に失敗");
    } finally {
      setBusy(false);
    }
  }

  function onSelectStrategy(id: string) {
    setStrategyId(id);
    scheduleAdvance("target");
  }

  function toggleTarget(id: string) {
    setTargetIds((prev) => {
      let next: string[];
      if (prev.includes(id)) next = prev.filter((x) => x !== id);
      else if (prev.length >= 2) next = prev;
      else next = [...prev, id];

      clearAdvance();
      if (next.length === 2) {
        const otherOk =
          !next.includes("other") ||
          (otherText.trim().length >= 1 && otherText.trim().length <= OFFICE_TARGET_OTHER_MAX);
        if (otherOk) scheduleAdvance("write");
      }
      return next;
    });
  }

  const speech = useMemo(() => {
    if (!incident || step !== "incident") return null;
    return pickIncidentSpeech(incident.type, incident.id);
  }, [incident, step]);

  const strategyTitle = useMemo(() => {
    if (!strategyId) return "きみの";
    if (strategyId === "custom") return "自分の作戦";
    return incident?.strategies.find((s) => s.id === strategyId)?.title ?? "きみの";
  }, [incident, strategyId]);

  const targetLabels = useMemo(() => {
    if (!incident) return [];
    return targetIds.map((id) => {
      if (id === "other") return otherText.trim() || "その他";
      return incident.targets.find((t) => t.id === id)?.label ?? id;
    });
  }, [incident, targetIds, otherText]);

  const writePlaceholder =
    strategyId === "custom"
      ? "自分の作戦をどう実行する？具体的に書いてね。"
      : strategyId
        ? "この作戦をどう実行する？具体的に書いてね。"
        : "ラフでOK。面白くても、真面目でも大丈夫。";

  const stamina = payload?.stamina.value ?? 0;
  const recovering = stamina <= 0 && Boolean(payload?.stamina.nextRecoverAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, payload?.stamina.nextRecoverAt]);
  const remain =
    recovering && payload?.stamina.nextRecoverAt
      ? msUntil(new Date(payload.stamina.nextRecoverAt), new Date(now))
      : null;

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

  const needsSetup = !payload?.company || !payload.company.about;
  const company = payload?.company ?? null;
  const backStep = previousPlayStep(step);

  const glass = "rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md sm:p-5";

  const stepPanel =
    lastSubmit && step === "result" ? (
      <ResultStep
        submission={lastSubmit}
        busy={busy}
        onNext={() => void onNextIncident()}
      />
    ) : !incident ? (
      <section className={`${glass} text-center text-sm text-zinc-500`}>
        事件を用意してるよ…
      </section>
    ) : step === "incident" ? (
      <IncidentStep
        incident={incident}
        company={company!}
        playEnter={playEnter}
        onNext={() => setStep("strategy")}
      />
    ) : step === "strategy" ? (
      <div className={glass}>
        <StrategyStep
          strategies={incident.strategies}
          selectedId={strategyId}
          canReroll={(incident.strategyRerolls ?? 0) < 1}
          rerolling={rerolling}
          onSelect={onSelectStrategy}
          onReroll={() => {
            void (async () => {
              setRerolling(true);
              try {
                const next = await rerollStrategies();
                setIncident(next);
                if (
                  strategyId &&
                  strategyId !== "custom" &&
                  !next.strategies.some((s) => s.id === strategyId)
                ) {
                  setStrategyId(null);
                }
              } catch (e) {
                setErr(e instanceof Error ? e.message : "引き直し失敗");
              } finally {
                setRerolling(false);
              }
            })();
          }}
        />
      </div>
    ) : step === "target" ? (
      <div className={glass}>
        <TargetStep
          targets={incident.targets}
          selectedIds={targetIds}
          otherText={otherText}
          onToggle={toggleTarget}
          onOtherText={(t) => {
            setOtherText(t);
            if (
              targetIds.length === 2 &&
              targetIds.includes("other") &&
              t.trim().length >= 1
            ) {
              scheduleAdvance("write");
            }
          }}
          onConfirm={() => {
            clearAdvance();
            setStep("write");
          }}
        />
      </div>
    ) : (
      <div className={glass}>
        <WriteStep
          strategyTitle={strategyTitle}
          targetLabels={targetLabels}
          answer={answer}
          onAnswer={setAnswer}
          placeholder={writePlaceholder}
          canSubmit={canSubmit}
          busy={busy}
          stamina={stamina}
          staminaHint={
            stamina <= 0
              ? `スタミナ切れ… 回復まで ${remain != null ? formatRemainMmSs(remain) : "しばらく"}`
              : null
          }
          onSubmit={() => void onSubmit()}
        />
      </div>
    );

  const body = boot ? (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-6 sm:px-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/70" />
      ))}
    </div>
  ) : needsSetup ? (
    <div className="relative mx-auto max-w-xl px-4 pb-28 pt-6 sm:px-6">
      <NameSetup
        busy={busy}
        error={err}
        existingName={
          payload?.company && !payload.company.about ? payload.company.name : null
        }
        onSubmit={onSetup}
      />
    </div>
  ) : (
    <div className="relative min-h-[calc(100dvh-7.5rem)] overflow-x-hidden">
      {tab === "play" && company ? (
        <>
          <OfficeScene
            level={company.level}
            industry={company.industry}
            fx={sceneFx}
            variant="backdrop"
            speech={speech}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(255,247,237,0.22)_30%,rgba(255,247,237,0.1)_55%,rgba(255,255,255,0.55)_100%)]"
            aria-hidden
          />
        </>
      ) : null}

      <div className="relative z-10 mx-auto max-w-xl space-y-4 px-4 pb-28 pt-3 sm:px-6">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTab("play")}
            className={`rounded-xl py-2.5 text-sm font-extrabold ${
              tab === "play" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            オフィス
          </button>
          <button
            type="button"
            onClick={() => setTab("rank")}
            className={`rounded-xl py-2.5 text-sm font-extrabold ${
              tab === "rank" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            順位
          </button>
        </div>

        {err ? (
          <p className="rounded-2xl bg-rose-50/90 px-3 py-2 text-sm font-semibold text-rose-600 backdrop-blur">
            {err}
          </p>
        ) : null}

        {tab === "play" ? (
          <div className="space-y-4">
            <CompanyCard
              company={company!}
              seasonRevenue={payload!.seasonRevenue}
              staminaValue={payload!.stamina.value}
              nextRecoverAt={payload!.stamina.nextRecoverAt}
            />

            {step !== "result" ? (
              <div className="rounded-2xl border border-white/70 bg-white/75 px-2 py-1 backdrop-blur-md">
                <PlayStepper
                  step={step}
                  canBack={Boolean(backStep)}
                  onBack={() => {
                    if (!backStep) return;
                    clearAdvance();
                    setStep(backStep);
                  }}
                />
              </div>
            ) : null}

            {stepPanel}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/80 bg-white/90 p-1 shadow-[0_12px_40px_rgba(28,25,23,0.06)] backdrop-blur-md">
            <RankingPanel
              rows={rankRows}
              meta={rankMeta}
              onToggle={async (enabled) => {
                const c = await toggleRanking(enabled);
                setPayload((p) => (p ? { ...p, company: c } : p));
                setRankMeta((m) => (m ? { ...m, rankingEnabled: enabled } : m));
              }}
            />
          </div>
        )}
      </div>
    </div>
  );

  const shell = (
    <>
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-xl px-4 pb-2 pt-1 sm:px-6">
            <AppBrandHeader bare />
            <p className="mt-1 text-center text-[11px] font-semibold tracking-[0.14em] text-zinc-500">
              オフィス
            </p>
          </div>
        </header>
      ) : null}
      {body}
      {payload?.pendingResult ? (
        <SeasonResultModal
          result={payload.pendingResult}
          onClose={async () => {
            await markResultSeen(payload.pendingResult!.seasonKey);
            setPayload((p) => (p ? { ...p, pendingResult: null } : p));
          }}
        />
      ) : null}
      {!hideChrome && !embedded ? <AppBottomNav /> : null}
    </>
  );

  return (
    <div className={embedded ? undefined : "min-h-[100dvh] overflow-x-hidden bg-[#FFF7ED] pb-bottom-nav"}>
      {shell}
    </div>
  );
}
