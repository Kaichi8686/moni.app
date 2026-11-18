"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { CoachStep } from "@/components/office/build/CoachStep";
import { CodexScreen } from "@/components/office/build/CodexScreen";
import { DiagnosisStep } from "@/components/office/build/DiagnosisStep";
import { IntroStep } from "@/components/office/build/IntroStep";
import { PlayStep } from "@/components/office/build/PlayStep";
import { RankingScreen } from "@/components/office/build/RankingScreen";
import { ScoreReveal } from "@/components/office/build/ScoreReveal";
import { SettingsScreen } from "@/components/office/build/SettingsScreen";
import { ShopStep } from "@/components/office/build/ShopStep";
import { StepTracker } from "@/components/office/build/StepTracker";
import { TopBar } from "@/components/office/build/TopBar";
import {
  localBuy,
  localDiagnose,
  localGameState,
  localMarkTutorialDone,
  localPlay,
  localPreview,
  localSetOwnerName,
  localSetSfxMuted,
  localStart,
} from "@/lib/office/build/buildClient";
import type { TermDef } from "@/lib/office/build/content/terms";
import type { OfficeMood } from "@/lib/office/build/mood";
import type { TriggerLogEntry } from "@/lib/office/build/score";
import { playOfficeSfx, setOfficeSfxMuted } from "@/lib/office/sfx";

type Props = {
  embedded?: boolean;
  hideChrome?: boolean;
  active?: boolean;
};

type Panel = "home" | "run" | "rank" | "codex" | "settings";
type Phase = "intro" | "diagnose" | "play" | "score" | "coach" | "shop";

type PublicRun = ReturnType<typeof localStart>["run"];

const COL = "mx-auto w-full max-w-[480px] px-4 sm:px-5";

export function OfficeApp({ embedded, hideChrome, active = true }: Props) {
  const [panel, setPanel] = useState<Panel>("home");
  const [rankMode, setRankMode] = useState<"daily" | "season">("daily");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(() => localGameState());
  const [run, setRun] = useState<PublicRun | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [hypId, setHypId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [adlib, setAdlib] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof localPreview>["preview"] | null>(
    null,
  );
  const [result, setResult] = useState<{
    customers: number;
    price: number;
    mult: number;
    revenue: number;
    ratio: number;
    rank: string;
    coins: number;
    triggerLog: TriggerLogEntry[];
    coachSummary: string;
    correctText: string;
    terms: TermDef[];
    mode: "daily" | "free";
  } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const refresh = useCallback(() => {
    setState(localGameState());
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
    const c = localGameState().company;
    if (c && !c.tutorialDone) setShowTutorial(true);
    setOfficeSfxMuted(c?.sfxMuted !== false);
  }, [active, refresh]);

  const company = state.company;
  const mood = (company?.mood ?? "good") as OfficeMood;

  useEffect(() => {
    if (!run || phase !== "play") return;
    try {
      const p = localPreview(run.id, selected);
      setPreview(p.preview);
      setErr("");
    } catch (e) {
      setPreview(null);
      if (selected.length) setErr(e instanceof Error ? e.message : "プレビュー失敗");
    }
  }, [run, selected, phase]);

  async function begin(mode: "daily" | "free") {
    setBusy(true);
    setErr("");
    try {
      const res = localStart(mode);
      setRun(res.run);
      setHypId(res.run.hypothesisId);
      setSelected([]);
      setAdlib("");
      setPreview(null);
      setResult(null);
      setPhase("intro");
      setPanel("run");
      refresh();
      playOfficeSfx("enter");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "開始失敗");
    } finally {
      setBusy(false);
    }
  }

  function confirmDiagnose() {
    if (!run || !hypId) return;
    setBusy(true);
    setErr("");
    try {
      const res = localDiagnose(run.id, hypId);
      setRun(res.run);
      setPhase("play");
      playOfficeSfx("tap");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "診断失敗");
    } finally {
      setBusy(false);
    }
  }

  function toggleCard(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    playOfficeSfx("tap");
  }

  async function submitPlay() {
    if (!run) return;
    setBusy(true);
    setErr("");
    try {
      const res = await localPlay(run.id, selected, adlib || undefined);
      setResult({
        customers: res.run.customers ?? 0,
        price: res.run.price ?? 0,
        mult: res.run.mult ?? 1,
        revenue: res.run.revenue ?? 0,
        ratio: res.run.ratio ?? 0,
        rank: res.run.rank ?? "C",
        coins: res.run.coins ?? 0,
        triggerLog: res.run.triggerLog ?? [],
        coachSummary: res.coach.summary,
        correctText: res.correctHypothesis.text,
        terms: (res.newlyUnlockedTerms ?? []) as TermDef[],
        mode: run.mode,
      });
      setPhase("score");
      refresh();
      playOfficeSfx(res.run.rank === "S" || res.run.rank === "A" ? "level" : "coin");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提出失敗");
    } finally {
      setBusy(false);
    }
  }

  function onBuy(type: "card" | "employee", id: string) {
    setErr("");
    try {
      localBuy(type, id);
      refresh();
      playOfficeSfx("coin");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "購入失敗");
    }
  }

  const homeBody = useMemo(() => {
    if (!company) return <p className="text-sm">読み込み中…</p>;
    const dailyDone = state.daily && state.daily.status === "finished";
    return (
      <div className="space-y-3">
        <div className="ob-panel p-4">
          <p className="ob-title text-lg text-[var(--ob-gold)]">{company.name}</p>
          <p className="mt-1 text-xs text-[var(--ob-muted)]">
            売上 ＝ 客数 × 客単価。今日も営業しよう。
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="ob-btn w-full"
              disabled={busy || Boolean(dailyDone)}
              onClick={() => void begin("daily")}
            >
              {dailyDone ? "今日のデイリー済" : "デイリー営業（ランキング対象）"}
            </button>
            <button
              type="button"
              className="ob-btn-ghost w-full"
              disabled={busy || company.stamina < 1}
              onClick={() => void begin("free")}
            >
              フリー営業（スタミナ1）
            </button>
          </div>
        </div>
      </div>
    );
  }, [company, state.daily, busy]);

  let body: React.ReactNode = null;
  if (panel === "rank") {
    body = (
      <RankingScreen
        mode={rankMode}
        rows={
          company
            ? [
                {
                  place: 1,
                  name: company.name,
                  revenue: state.daily?.revenue ?? 0,
                  mood,
                },
              ]
            : []
        }
        onMode={setRankMode}
        onClose={() => setPanel("home")}
      />
    );
  } else if (panel === "codex") {
    body = (
      <CodexScreen unlocked={company?.termIds ?? []} onClose={() => setPanel("home")} />
    );
  } else if (panel === "settings") {
    body = (
      <SettingsScreen
        ownerName={company?.ownerName ?? ""}
        sfxMuted={company?.sfxMuted !== false}
        onOwnerName={(v) => {
          localSetOwnerName(v);
          refresh();
        }}
        onToggleSfx={() => {
          const next = !(company?.sfxMuted !== false);
          localSetSfxMuted(next);
          setOfficeSfxMuted(next);
          refresh();
          playOfficeSfx("tap");
        }}
        onClose={() => setPanel("home")}
      />
    );
  } else if (panel === "run" && run) {
    body = (
      <div className="space-y-3">
        <StepTracker step={phase === "shop" ? "result" : phase} />
        {phase === "intro" ? (
          <IntroStep
            title={run.event.title}
            beats={run.event.introBeats}
            onSkip={() => setPhase("diagnose")}
            onDone={() => setPhase("diagnose")}
          />
        ) : null}
        {phase === "diagnose" ? (
          <DiagnosisStep
            chips={run.event.dataChips}
            hypotheses={run.event.hypotheses}
            selected={hypId}
            onSelect={setHypId}
            onConfirm={confirmDiagnose}
            busy={busy}
          />
        ) : null}
        {phase === "play" ? (
          <PlayStep
            hand={run.hand}
            selected={selected}
            onToggle={toggleCard}
            preview={preview}
            norma={run.event.norma}
            adlib={adlib}
            onAdlib={setAdlib}
            onSubmit={() => void submitPlay()}
            busy={busy}
          />
        ) : null}
        {phase === "score" && result ? (
          <ScoreReveal
            {...result}
            onDone={() => setPhase("coach")}
          />
        ) : null}
        {phase === "coach" && result ? (
          <CoachStep
            summary={result.coachSummary}
            terms={result.terms}
            correctText={result.correctText}
            nextLabel={result.mode === "free" ? "仕入れへ" : "オフィスへ"}
            onNext={() => {
              if (result.mode === "free") setPhase("shop");
              else {
                setPanel("home");
                setRun(null);
                refresh();
              }
            }}
          />
        ) : null}
        {phase === "shop" && company ? (
          <ShopStep
            coins={company.coins}
            level={company.level}
            ownedCards={company.deckIds}
            ownedEmployees={company.employeeIds}
            onBuy={onBuy}
            error={err}
            onClose={() => {
              setPanel("home");
              setRun(null);
              refresh();
            }}
          />
        ) : null}
      </div>
    );
  } else {
    body = homeBody;
  }

  return (
    <div className="office-build" data-mood={mood}>
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-[var(--ob-border)] bg-[var(--ob-bg)]/95 backdrop-blur">
          <div className={`${COL} py-2`}>
            <p className="ob-title text-center text-[11px] tracking-[0.16em] text-[var(--ob-muted)]">
              moni オフィス
            </p>
          </div>
        </header>
      ) : null}

      <main className={`${COL} space-y-3 pb-28 pt-3`}>
        {company ? (
          <TopBar
            dateKey={state.dateKey ?? ""}
            coins={company.coins}
            stamina={company.stamina}
            mood={mood}
            onOpenRank={() => setPanel("rank")}
            onOpenCodex={() => setPanel("codex")}
            onOpenSettings={() => setPanel("settings")}
          />
        ) : null}
        {err && panel !== "run" ? (
          <p className="text-sm font-bold text-[#ff8a8a]">{err}</p>
        ) : null}
        {err && panel === "run" && phase !== "shop" ? (
          <p className="text-sm font-bold text-[#ff8a8a]">{err}</p>
        ) : null}
        {body}
      </main>

      {showTutorial ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="ob-panel w-full max-w-[420px] space-y-3 p-4">
            <p className="ob-title text-[var(--ob-gold)]">はじめての営業</p>
            <ol className="list-decimal space-y-1 pl-4 text-sm text-[var(--ob-muted)]">
              <li>現場データから仮説を1つ選ぶ</li>
              <li>予算3でカードを最大3枚出す</li>
              <li>客数×客単価で売上を伸ばす</li>
            </ol>
            <button
              type="button"
              className="ob-btn w-full"
              onClick={() => {
                localMarkTutorialDone();
                setShowTutorial(false);
                refresh();
              }}
            >
              わかった
            </button>
          </div>
        </div>
      ) : null}

      {!hideChrome && !embedded ? <AppBottomNav /> : null}
    </div>
  );
}
