"use client";

import { useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { CompanyCard } from "@/components/office/CompanyCard";
import { IncidentPanel } from "@/components/office/IncidentPanel";
import { NameSetup } from "@/components/office/NameSetup";
import { RankingPanel } from "@/components/office/RankingPanel";
import { ScoreReveal } from "@/components/office/ScoreReveal";
import { SeasonResultModal } from "@/components/office/SeasonResultModal";
import {
  createCompany,
  fetchCompany,
  fetchIncident,
  fetchRanking,
  markResultSeen,
  setAbout,
  submitAnswer,
  toggleRanking,
  type CompanyPayload,
} from "@/lib/office/clientApi";
import type { OfficeIncident, OfficeSubmission, RankingRow } from "@/lib/office/types";

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

  async function onSubmit(answer: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await submitAnswer(answer);
      setLastSubmit(res.submission);
      setPayload({
        company: res.company,
        stamina: res.stamina,
        seasonRevenue: res.seasonRevenue,
        pendingResult: payload?.pendingResult ?? null,
      });
      setIncident(null);
      setPlayEnter(false);
      setSceneFx(null);
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

  const body = boot ? (
    <div className="mx-auto max-w-lg space-y-3 px-4 pt-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
      ))}
    </div>
  ) : needsSetup ? (
    <NameSetup
      busy={busy}
      error={err}
      existingName={
        payload?.company && !payload.company.about ? payload.company.name : null
      }
      onSubmit={onSetup}
    />
  ) : (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">
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

      {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

      {tab === "play" ? (
        <>
          <CompanyCard
            company={payload.company!}
            seasonRevenue={payload.seasonRevenue}
            staminaValue={payload.stamina.value}
            nextRecoverAt={payload.stamina.nextRecoverAt}
            sceneFx={sceneFx}
          />
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
              company={payload.company!}
              stamina={payload.stamina.value}
              nextRecoverAt={payload.stamina.nextRecoverAt}
              busy={busy}
              playEnter={playEnter}
              onSubmit={(a) => void onSubmit(a)}
            />
          )}
        </>
      ) : (
        <RankingPanel
          rows={rankRows}
          meta={rankMeta}
          onToggle={async (enabled) => {
            const c = await toggleRanking(enabled);
            setPayload((p) => (p ? { ...p, company: c } : p));
            setRankMeta((m) => (m ? { ...m, rankingEnabled: enabled } : m));
          }}
        />
      )}
    </div>
  );

  const shell = (
    <>
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
          <div className="mx-auto max-w-lg px-4 pb-2 pt-1">
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
    <div className={embedded ? undefined : "min-h-[100dvh] bg-white pb-bottom-nav"}>{shell}</div>
  );
}
