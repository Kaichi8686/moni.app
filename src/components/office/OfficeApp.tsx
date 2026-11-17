"use client";

import { useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { CompanyCard } from "@/components/office/CompanyCard";
import { IncidentPanel } from "@/components/office/IncidentPanel";
import { NameSetup } from "@/components/office/NameSetup";
import { OfficeScene } from "@/components/office/OfficeScene";
import { RankingPanel } from "@/components/office/RankingPanel";
import { ScoreReveal } from "@/components/office/ScoreReveal";
import { SeasonResultModal } from "@/components/office/SeasonResultModal";
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

export function OfficeApp({ embedded, hideChrome, active = true }: Props) {
  const [tab, setTab] = useState<Tab>("play");
  const [boot, setBoot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState<CompanyPayload | null>(null);
  const [incident, setIncident] = useState<OfficeIncident | null>(null);
  const [playEnter, setPlayEnter] = useState(false);
  const [sceneFx, setSceneFx] = useState<string | null>(null);
  const [lastSubmit, setLastSubmit] = useState<OfficeSubmission | null>(null);
  const [rankRows, setRankRows] = useState<RankingRow[]>([]);
  const [rankMeta, setRankMeta] = useState<{
    seasonKey: string;
    leagueId: string;
    myRank: number | null;
    rankingEnabled: boolean;
  } | null>(null);

  const triggerFx = useCallback((type: string) => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
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
      if (opts?.allowFx && created) {
        triggerFx(inc.type);
      } else {
        setPlayEnter(false);
        setSceneFx(null);
      }
    },
    [triggerFx],
  );

  const reload = useCallback(async () => {
    setErr("");
    const data = await fetchCompany();
    setPayload(data);
    if (data.company?.about) {
      try {
        // 既存 open の再表示は演出なし
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

  async function onSubmit(input: OfficeSubmitInput) {
    setBusy(true);
    setErr("");
    try {
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

  const needsSetup = !payload?.company || !payload.company.about;
  const company = payload?.company ?? null;
  const playReady = Boolean(company?.about);

  const body = boot ? (
    <div className="mx-auto max-w-5xl space-y-3 px-4 pt-6 sm:px-6">
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
    <div
      className={`relative ${
        tab === "play" ? "min-h-[calc(100dvh-7.5rem)]" : "min-h-[calc(100dvh-7.5rem)]"
      }`}
    >
      {tab === "play" && playReady ? (
        <>
          <OfficeScene
            level={company!.level}
            industry={company!.industry}
            fx={sceneFx}
            variant="backdrop"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,247,237,0.28)_28%,rgba(255,247,237,0.12)_55%,rgba(255,255,255,0.62)_100%)]"
            aria-hidden
          />
        </>
      ) : null}

      <div className="relative z-10 mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTab("play")}
            className={`rounded-xl py-3 text-sm font-extrabold sm:text-base ${
              tab === "play" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            オフィス
          </button>
          <button
            type="button"
            onClick={() => setTab("rank")}
            className={`rounded-xl py-3 text-sm font-extrabold sm:text-base ${
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] lg:items-start lg:gap-5">
            <div className="lg:sticky lg:top-24">
              <CompanyCard
                company={company!}
                seasonRevenue={payload!.seasonRevenue}
                staminaValue={payload!.stamina.value}
                nextRecoverAt={payload!.stamina.nextRecoverAt}
              />
            </div>
            <div className="min-w-0">
              {lastSubmit ? (
                <ScoreReveal
                  submission={lastSubmit}
                  onNext={() => void onNextIncident()}
                  busy={busy}
                />
              ) : (
                <IncidentPanel
                  key={incident?.id ?? "empty"}
                  incident={incident}
                  company={company!}
                  stamina={payload!.stamina.value}
                  nextRecoverAt={payload!.stamina.nextRecoverAt}
                  busy={busy}
                  playEnter={playEnter}
                  onSubmit={(a) => void onSubmit(a)}
                  onRerollStrategies={async () => {
                    const next = await rerollStrategies();
                    setIncident(next);
                    return next;
                  }}
                />
              )}
            </div>
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
          <div className="mx-auto max-w-5xl px-4 pb-2 pt-1 sm:px-6 lg:px-8">
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
    <div className={embedded ? undefined : "min-h-[100dvh] bg-[#FFF7ED] pb-bottom-nav"}>
      {shell}
    </div>
  );
}
