"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { InterruptControl } from "@/components/idea-garden/InterruptMenu";
import { QuestionPanel } from "@/components/idea-garden/QuestionPanel";
import { SeedBagCarousel } from "@/components/idea-garden/SeedBagCarousel";
import { ShelfView } from "@/components/idea-garden/ShelfView";
import { EmptyPotArt } from "@/components/idea-garden/illustrations/EmptyPotArt";
import { FlowerArt } from "@/components/idea-garden/illustrations/FlowerArt";
import { SeedArt } from "@/components/idea-garden/illustrations/SeedArt";
import { SeedBagArt } from "@/components/idea-garden/illustrations/SeedBagArt";
import {
  isGrowDay,
  isSunday,
  tokyoDateKey,
  tokyoWeekday,
  weekdayLabel,
  weekKeyFor,
} from "@/lib/idea-garden/calendar";
import { dailyPromptFor } from "@/lib/idea-garden/prompts";
import { SEED_BAGS } from "@/lib/idea-garden/seedBags";
import {
  goldDoneThisWeek,
  loadGarden,
  plantForDate,
  plantsForWeek,
  saveGarden,
  upsertPlant,
  usableDraft,
  weekKeysDesc,
} from "@/lib/idea-garden/storage";
import type {
  FlowerKind,
  GardenDraft,
  GardenScreen,
  GrowPhase,
  PlantedIdea,
  SundayPhase,
} from "@/lib/idea-garden/types";
import { createMyIdea } from "@/lib/idea-hub/myIdeas";
import { burstCelebration } from "@/lib/ui/confetti";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

type Props = {
  onImmersiveChange?: (immersive: boolean) => void;
};

function reduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
  );
}

function SeedRevealPhase({ kind, onDone }: { kind: FlowerKind; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDone(), reduceMotion() ? 350 : 1200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#FFF7D6] to-[#E8F8FF] px-6">
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.4 }}
        animate={{ y: -40, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="z-10 w-36"
      >
        <SeedArt glowing className="h-36 w-full" />
      </motion.div>
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.35, y: 30 }}
        transition={{ duration: 0.8 }}
      >
        <SeedBagArt kind={kind} className="h-48 w-40" />
      </motion.div>
    </div>
  );
}

function initialScreen(plants: PlantedIdea[]): GardenScreen {
  const today = tokyoDateKey();
  const existing = plantForDate(plants, today);
  if (isSunday()) {
    if (goldDoneThisWeek(plants, weekKeyFor()) || existing?.gold) {
      return { kind: "shelf" };
    }
    return { kind: "sunday", phase: "start" };
  }
  if (isGrowDay()) {
    if (existing) return { kind: "shelf" };
    return { kind: "grow", phase: "pick-bag" };
  }
  return { kind: "shelf" };
}

export function IdeaGardenApp({ onImmersiveChange }: Props) {
  const { tx, locale } = useI18n();
  const [hydrated, setHydrated] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [plants, setPlants] = useState<PlantedIdea[]>([]);
  const [screen, setScreen] = useState<GardenScreen>({ kind: "shelf" });

  // grow flow local state
  const [bagIndex, setBagIndex] = useState(0);
  const [selectedKind, setSelectedKind] = useState<FlowerKind | null>(null);
  const [answer, setAnswer] = useState("");
  const [title, setTitle] = useState("");
  const [growStage, setGrowStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [showCelebrateText, setShowCelebrateText] = useState(false);
  const [showContinueBtn, setShowContinueBtn] = useState(false);

  // sunday flow
  const [sundayIndex, setSundayIndex] = useState(0);
  const [sundayPickId, setSundayPickId] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [situation, setSituation] = useState("");
  const [gildProgress, setGildProgress] = useState(0);
  /** 育てる押下時のうっすら画面切替 */
  const [sceneVeil, setSceneVeil] = useState<"idle" | "in" | "out">("idle");
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resumeScreen, setResumeScreen] = useState<GardenScreen | null>(null);

  // shelf
  const [weekIndex, setWeekIndex] = useState(0);

  const persist = useCallback(
    (next: PlantedIdea[], draft: GardenDraft | null = null) => {
      setPlants(next);
      // 個人専用ストレージ（アカウントごと / ゲストごと）。共有しない。
      saveGarden({ version: 1, plants: next, draft }, ownerId);
    },
    [ownerId],
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateFor = (uid: string | null) => {
      const state = loadGarden(uid);
      if (cancelled) return;
      const draft = usableDraft(state.plants, state.draft);
      setOwnerId(uid);
      setPlants(state.plants);
      setWeekIndex(0);
      if (draft) {
        setScreen(draft.screen);
        setPaused(Boolean(draft.paused));
        setResumeScreen(draft.resumeScreen ?? null);
        setBagIndex(draft.bagIndex);
        setSelectedKind(draft.selectedKind);
        setAnswer(draft.answer);
        setTitle(draft.title);
        setSundayIndex(draft.sundayIndex);
        setSundayPickId(draft.sundayPickId);
        setTarget(draft.target);
        setSituation(draft.situation);
        if (draft.screen.kind === "grow" && draft.screen.phase === "celebrate") {
          setGrowStage(4);
          setShowCelebrateText(true);
          setShowContinueBtn(true);
        }
        if (draft.screen.kind === "sunday" && draft.screen.phase === "celebrate") {
          setGildProgress(2);
          setShowCelebrateText(true);
          setShowContinueBtn(true);
        }
      } else {
        setPaused(false);
        setResumeScreen(null);
        setScreen(initialScreen(state.plants));
      }
      setHydrated(true);
    };

    if (!supabase || !supabaseEnabled) {
      hydrateFor(null);
      return () => {
        cancelled = true;
      };
    }

    void supabase.auth.getSession().then(({ data }) => {
      hydrateFor(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      hydrateFor(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 途中離脱からの再開用：進行中フローを個人ストレージへ都度保存
  useEffect(() => {
    if (!hydrated) return;
    if (screen.kind !== "grow" && screen.kind !== "sunday") return;
    // 入口画面だけは下書きにしない（中止後にまた下書きが復活しないように）
    if (screen.kind === "grow" && screen.phase === "pick-bag") return;
    if (screen.kind === "sunday" && screen.phase === "start") return;
    saveGarden(
      {
        version: 1,
        plants,
        draft: {
          dateKey: tokyoDateKey(),
          screen,
          paused,
          resumeScreen,
          bagIndex,
          selectedKind,
          answer,
          title,
          sundayIndex,
          sundayPickId,
          target,
          situation,
        },
      },
      ownerId,
    );
  }, [
    hydrated,
    screen,
    paused,
    resumeScreen,
    bagIndex,
    selectedKind,
    answer,
    title,
    sundayIndex,
    sundayPickId,
    target,
    situation,
    plants,
    ownerId,
  ]);

  const immersive =
    screen.kind === "detail"
      ? true
      : screen.kind === "grow"
        ? screen.phase !== "pick-bag" && screen.phase !== "paused"
        : screen.kind === "sunday"
          ? screen.phase !== "start"
          : false;

  const showInterrupt =
    immersive &&
    ((screen.kind === "grow" &&
      screen.phase !== "celebrate" &&
      screen.phase !== "growing") ||
      (screen.kind === "sunday" &&
        screen.phase !== "celebrate" &&
        screen.phase !== "gilding"));

  const saveAndPause = () => {
    const resume: GardenScreen =
      screen.kind === "grow" || screen.kind === "sunday"
        ? screen
        : { kind: "grow", phase: "plant" };
    setResumeScreen(resume);
    setPaused(true);
    setInterruptOpen(false);
    setSceneVeil("idle");
    setScreen({ kind: "grow", phase: "paused" });
  };

  const abortSession = () => {
    setInterruptOpen(false);
    setPaused(false);
    setResumeScreen(null);
    setAnswer("");
    setTitle("");
    setSelectedKind(null);
    setBagIndex(0);
    setSundayIndex(0);
    setSundayPickId(null);
    setTarget("");
    setSituation("");
    setGrowStage(0);
    setShowCelebrateText(false);
    setShowContinueBtn(false);
    setGildProgress(0);
    setSceneVeil("idle");
    persist(plants, null);
    setScreen(initialScreen(plants));
  };

  const continuePaused = () => {
    const next = resumeScreen ?? { kind: "grow" as const, phase: "plant" as const };
    setPaused(false);
    setResumeScreen(null);
    setScreen(next);
  };

  const interruptUi = showInterrupt ? (
    <InterruptControl
      open={interruptOpen}
      onOpen={() => setInterruptOpen(true)}
      onClose={() => setInterruptOpen(false)}
      onSaveAndPause={saveAndPause}
      onAbort={abortSession}
    />
  ) : null;

  useEffect(() => {
    onImmersiveChange?.(immersive);
  }, [immersive, onImmersiveChange]);

  const currentWeekKey = weekKeyFor();
  const weeks = weekKeysDesc(plants, currentWeekKey);
  const weekPlants = plantsForWeek(plants, weeks[weekIndex] ?? currentWeekKey);
  const sundayCandidates = plantsForWeek(plants, currentWeekKey).filter((p) => p.weekday !== 0);
  const prompt = dailyPromptFor();

  const setGrow = (phase: GrowPhase) => setScreen({ kind: "grow", phase });
  const setSunday = (phase: SundayPhase) => setScreen({ kind: "sunday", phase });

  const goQuestionWithVeil = () => {
    if (reduceMotion()) {
      setGrow("question");
      return;
    }
    setSceneVeil("in");
    window.setTimeout(() => {
      setGrow("question");
      setSceneVeil("out");
      window.setTimeout(() => setSceneVeil("idle"), 420);
    }, 340);
  };

  const growPhase = screen.kind === "grow" ? screen.phase : null;
  const sundayPhase = screen.kind === "sunday" ? screen.phase : null;

  // Growth animation sequencer (all updates via timers — avoids sync setState-in-effect)
  useEffect(() => {
    if (growPhase !== "growing") return;
    let cancelled = false;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) fn();
        }, ms),
      );
    };
    const delays = reduceMotion() ? [0, 80, 160, 240] : [0, 450, 900, 1400];
    later(0, () => {
      setGrowStage(1);
      setShowCelebrateText(false);
      setShowContinueBtn(false);
    });
    later(delays[1]!, () => setGrowStage(2));
    later(delays[2]!, () => setGrowStage(3));
    later(delays[3]!, () => setGrowStage(4));
    const textAt = reduceMotion() ? 400 : 2100;
    later(textAt, () => {
      setShowCelebrateText(true);
      if (!reduceMotion()) burstCelebration();
      later(400, () => setShowContinueBtn(true));
    });
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [growPhase]);

  // Gold animation sequencer
  useEffect(() => {
    if (sundayPhase !== "gilding") return;
    let cancelled = false;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) fn();
        }, ms),
      );
    };
    later(0, () => {
      setGildProgress(0);
      setShowCelebrateText(false);
      setShowContinueBtn(false);
    });
    const steps = reduceMotion() ? [80, 200] : [500, 1100];
    later(steps[0]!, () => setGildProgress(1));
    later(steps[1]!, () => setGildProgress(2));
    const textAt = reduceMotion() ? 400 : 1600;
    later(textAt, () => {
      setShowCelebrateText(true);
      if (!reduceMotion()) burstCelebration();
      later(400, () => setShowContinueBtn(true));
    });
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [sundayPhase]);

  const finishGrow = () => {
    if (!selectedKind) return;
    const plant: PlantedIdea = {
      id: crypto.randomUUID(),
      weekKey: currentWeekKey,
      dateKey: tokyoDateKey(),
      weekday: tokyoWeekday(),
      flowerKind: selectedKind,
      title: title.trim(),
      answer: answer.trim(),
      promptId: prompt.id,
      gold: false,
      createdAt: new Date().toISOString(),
    };
    persist(upsertPlant(plants, plant), null);
    void createMyIdea({
      title: plant.title,
      memo: plant.answer,
      source: "manual",
      seed_id: plant.flowerKind,
      theme: prompt.id,
    }).catch(() => {
      /* offline / guest ok — local garden is source of truth */
    });
    setWeekIndex(0);
    setPaused(false);
    setResumeScreen(null);
    setScreen({ kind: "shelf" });
    setAnswer("");
    setTitle("");
    setSelectedKind(null);
    setGrowStage(0);
  };

  const finishSunday = () => {
    const id = sundayPickId;
    if (!id) return;
    const now = new Date().toISOString();
    const next = plants.map((p) =>
      p.id === id
        ? {
            ...p,
            gold: true,
            target: target.trim(),
            situation: situation.trim(),
            goldAt: now,
          }
        : p,
    );
    persist(next, null);
    setWeekIndex(0);
    setPaused(false);
    setResumeScreen(null);
    setScreen({ kind: "shelf" });
    setTarget("");
    setSituation("");
    setSundayPickId(null);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-zinc-500">
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }

  /* ——— DETAIL (private flower — title + description) ——— */
  if (screen.kind === "detail") {
    const plant = plants.find((p) => p.id === screen.plantId);
    if (!plant) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EAF8FF] px-6">
          <DuoButton tone="orange" onClick={() => setScreen({ kind: "shelf" })}>
            {tx("棚に戻る", "Back to shelf")}
          </DuoButton>
        </div>
      );
    }
    const descriptionParts = [plant.answer];
    if (plant.gold && plant.target) {
      descriptionParts.push(tx(`ターゲット: ${plant.target}`, `Target: ${plant.target}`));
    }
    if (plant.gold && plant.situation) {
      descriptionParts.push(
        tx(`役立つとき: ${plant.situation}`, `Useful when: ${plant.situation}`),
      );
    }

    return (
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#E8F8FF] via-[#F7FFF0] to-[#FFF8E7] px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setScreen({ kind: "shelf" })}
          className="mb-2 inline-flex items-center gap-1 self-start text-[14px] font-extrabold text-[#3C3C3C]"
        >
          <ChevronLeft className="h-5 w-5" />
          {tx("棚に戻る", "Back to shelf")}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col items-center"
        >
          <FlowerArt
            kind={plant.flowerKind}
            gold={plant.gold}
            stage={4}
            className="mt-2 h-56 w-48 drop-shadow-lg"
          />
          <p className="mt-2 text-[12px] font-bold text-zinc-500">
            {weekdayLabel(plant.weekday, locale === "en" ? "en" : "ja")}
            {plant.gold ? ` · ${tx("ゴールド", "Gold")}` : ""}
          </p>
          <h1 className="mt-4 text-center text-[24px] font-extrabold leading-snug tracking-tight text-[#3C3C3C]">
            {plant.title}
          </h1>
          <div className="mt-5 w-full rounded-3xl border-[3px] border-[#E5E5E5] bg-white px-5 py-4">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-zinc-400">
              {tx("説明", "Description")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-[#3C3C3C]">
              {descriptionParts.join("\n\n")}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ——— SHELF (個人専用・1日1花) ——— */
  if (screen.kind === "shelf") {
    const canStartGrow = isGrowDay() && !plantForDate(plants, tokyoDateKey());
    const canStartSunday =
      isSunday() && !goldDoneThisWeek(plants, currentWeekKey) && sundayCandidates.length > 0;

    return (
      <div className="min-h-[calc(100dvh-7rem)] bg-gradient-to-b from-[#EAF8FF] to-[#F4F4F5]">
        <ShelfView
          weekKeys={weeks}
          weekIndex={weekIndex}
          onWeekIndex={setWeekIndex}
          plants={weekPlants}
          onPlantClick={(plant) => setScreen({ kind: "detail", plantId: plant.id })}
          headerSlot={
            <div className="pt-1 text-center">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#3C3C3C]">
                {tx("あなたのアイデアの棚", "Your idea shelf")}
              </h1>
              <p className="mt-1 text-[13px] font-semibold text-zinc-500">
                {isSunday()
                  ? tx("日曜は自分のお気に入りを深掘りしよう", "Deepen your own favorite on Sundays")
                  : tx("自分だけの毎日ひとつ。他人とは共有されません", "One private seed a day — yours only")}
              </p>
              {canStartGrow ? (
                <div className="mt-4">
                  <DuoButton tone="orange" onClick={() => setGrow("pick-bag")}>
                    {tx("今日の種を選ぶ", "Pick today’s seed")}
                  </DuoButton>
                </div>
              ) : null}
              {canStartSunday ? (
                <div className="mt-4">
                  <DuoButton tone="orange" onClick={() => setSunday("start")}>
                    {tx("花を見つける", "Find a flower")}
                  </DuoButton>
                </div>
              ) : null}
              {isSunday() && sundayCandidates.length === 0 ? (
                <p className="mt-4 text-[13px] font-semibold text-zinc-500">
                  {tx(
                    "今週の花がまだないよ。月曜から育ててみよう！",
                    "No flowers this week yet — grow some Mon–Sat!",
                  )}
                </p>
              ) : null}
            </div>
          }
        />
      </div>
    );
  }

  /* ——— SUNDAY ——— */
  if (screen.kind === "sunday") {
    if (screen.phase === "start") {
      return (
        <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center bg-gradient-to-b from-[#FFF7D6] via-[#EAF8FF] to-[#F4F4F5] px-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm text-center"
          >
            <FlowerArt kind="sunflower" stage={4} className="mx-auto h-40 w-40" />
            <h1 className="mt-4 text-[24px] font-extrabold text-[#3C3C3C]">
              {tx("今週の花を見つけよう", "Find this week’s flower")}
            </h1>
            <p className="mt-2 text-[14px] font-semibold text-zinc-500">
              {tx("お気に入りを選んで、プロジェクトに育てる", "Pick a favorite and deepen it")}
            </p>
            <DuoButton
              tone="orange"
              fullWidth
              className="mt-8"
              onClick={() => {
                setSundayIndex(0);
                setSunday("pick-flower");
              }}
            >
              {tx("花を見つける", "Find a flower")}
            </DuoButton>
          </motion.div>
        </div>
      );
    }

    if (screen.phase === "pick-flower") {
      const list = sundayCandidates;
      const cur = list[sundayIndex % Math.max(list.length, 1)];
      if (!cur) {
        return (
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#EAF8FF] px-6 text-center">
            <p className="font-bold text-zinc-600">{tx("選べる花がありません", "No flowers to pick")}</p>
          </div>
        );
      }
      return (
        <div className="relative flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#FFF7D6] to-[#EAF8FF] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
          {interruptUi}
          <p className="mt-4 text-center text-[15px] font-extrabold text-[#3C3C3C]">
            {tx("選んでください", "Please choose")}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md"
              onClick={() => setSundayIndex((i) => (i - 1 + list.length) % list.length)}
              aria-label={tx("前の花", "Previous")}
            >
              <ChevronLeft />
            </button>
            <motion.div
              key={cur.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-40"
            >
              <FlowerArt kind={cur.flowerKind} stage={4} className="h-44 w-full" />
            </motion.div>
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md"
              onClick={() => setSundayIndex((i) => (i + 1) % list.length)}
              aria-label={tx("次の花", "Next")}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="mx-auto mt-4 w-full max-w-md rounded-3xl border-[3px] border-[#E5E5E5] bg-white px-5 py-4 text-center">
            <p className="text-[18px] font-extrabold text-[#3C3C3C]">{cur.title}</p>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-zinc-500">{cur.answer}</p>
          </div>
          <div className="mx-auto mt-auto w-full max-w-md pt-6">
            <DuoButton
              tone="orange"
              fullWidth
              onClick={() => {
                setSundayPickId(cur.id);
                setSunday("target");
              }}
            >
              {tx("決定", "Decide")}
            </DuoButton>
          </div>
        </div>
      );
    }

    if (screen.phase === "target") {
      return (
        <div className="relative">
          {interruptUi}
          <QuestionPanel
            title={tx("このアイデアのターゲットは誰？", "Who is the target for this idea?")}
            value={target}
            onChange={setTarget}
            placeholder={tx("例：忙しい高校生", "e.g. busy high-school students")}
            buttonLabel={tx("次へ", "Next")}
            onSubmit={() => setSunday("situation")}
          />
        </div>
      );
    }

    if (screen.phase === "situation") {
      return (
        <div className="relative">
          {interruptUi}
          <QuestionPanel
            title={tx(
              "どのような時にこのアイデアは役に立つ？",
              "When is this idea useful?",
            )}
            value={situation}
            onChange={setSituation}
            placeholder={tx("例：朝の通学で時間が足りないとき", "e.g. when rushing to school")}
            buttonLabel={tx("完了", "Done")}
            onSubmit={() => setSunday("gilding")}
          />
        </div>
      );
    }

    if (screen.phase === "gilding" || screen.phase === "celebrate") {
      const plant = plants.find((p) => p.id === sundayPickId) ?? sundayCandidates[0];
      const gold = gildProgress >= 2;
      return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#FFF4C2] via-[#FFFBEB] to-[#FEF3C7] px-5">
          <AnimatePresence>
            {showCelebrateText ? (
              <motion.p
                initial={{ opacity: 0, y: -12, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-[max(2.5rem,env(safe-area-inset-top))] text-center text-[24px] font-extrabold text-[#92400E]"
              >
                {tx("素晴らしいアイデアだ！", "Wonderful idea!")}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.div
            animate={{
              scale: gildProgress >= 1 ? [1, 1.08, 1] : 1,
              filter: gold
                ? "drop-shadow(0 0 24px rgba(251,191,36,0.85))"
                : "drop-shadow(0 8px 16px rgba(0,0,0,0.12))",
            }}
            transition={{ duration: 0.7 }}
            className="w-56"
          >
            <FlowerArt
              kind={plant?.flowerKind ?? "sunflower"}
              stage={4}
              gold={gold}
              className="h-64 w-full"
            />
          </motion.div>

          {gildProgress >= 1 && !gold ? (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[#FBBF24]/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 0.9 }}
            />
          ) : null}

          <AnimatePresence>
            {showContinueBtn ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-10 left-5 right-5 mx-auto max-w-md"
              >
                <DuoButton tone="orange" fullWidth onClick={finishSunday}>
                  {tx("来週も頑張る", "Keep it up next week")}
                </DuoButton>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      );
    }
  }

  /* ——— GROW (Mon–Sat) ——— */
  if (screen.kind === "grow") {
    const bag = SEED_BAGS[bagIndex]!;

    if (screen.phase === "pick-bag") {
      return (
        <div className="flex min-h-[calc(100dvh-7rem)] flex-col bg-gradient-to-b from-[#E8F8FF] via-[#F0FFF4] to-[#FFF8E7] px-4 pb-6 pt-4">
          <h1 className="text-center text-[22px] font-extrabold text-[#3C3C3C]">
            {tx("花を咲かせる種を選ぼう", "Pick a seed to bloom")}
          </h1>
          <p className="mt-1 text-center text-[13px] font-semibold text-zinc-500">
            {tx("袋をタップして選ぶ", "Tap a bag to choose")}
          </p>

          <SeedBagCarousel
            index={bagIndex}
            onIndexChange={setBagIndex}
            onSelect={(kind) => {
              setSelectedKind(kind);
              setGrow("bag-focus");
            }}
          />
        </div>
      );
    }

    if (screen.phase === "paused") {
      return (
        <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center bg-gradient-to-b from-[#E8F8FF] via-[#EAF9D8] to-[#DDF6A8] px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
          <p className="mt-2 text-center text-[15px] font-extrabold text-[#3C3C3C]">
            {tx("続きから育てよう", "Continue growing")}
          </p>
          <DuoButton
            tone="orange"
            size="xl"
            className="mt-[18vh] min-w-[260px]"
            onClick={continuePaused}
          >
            {tx("続ける", "Continue")}
          </DuoButton>
          <div className="mt-auto w-64">
            <EmptyPotArt showSeed className="h-64 w-full" />
          </div>
        </div>
      );
    }

    if (screen.phase === "bag-focus") {
      const kind = selectedKind ?? bag.id;
      return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#E8F8FF] to-[#F0FFF4] px-6">
          {interruptUi}
          <p className="mb-6 text-center text-[15px] font-extrabold text-[#3C3C3C]">
            {tx("もう一度タップして種を出そう", "Tap again to open the bag")}
          </p>
          <motion.button
            type="button"
            data-testid="garden-bag-focus"
            animate={reduceMotion() ? undefined : { rotate: [-2.5, 2.5, -2.5] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            whileTap={{ scale: 1.08 }}
            onClick={() => setGrow("seed-reveal")}
            className="outline-none"
          >
            <SeedBagArt kind={kind} selected className="h-72 w-56" />
          </motion.button>
        </div>
      );
    }

    if (screen.phase === "seed-reveal") {
      return (
        <div className="relative min-h-[100dvh]">
          {interruptUi}
          <SeedRevealPhase kind={selectedKind ?? bag.id} onDone={() => setGrow("plant")} />
        </div>
      );
    }

    if (screen.phase === "plant") {
      return (
        <div className="relative flex min-h-[100dvh] flex-col items-center bg-gradient-to-b from-[#E8F8FF] via-[#EAF9D8] to-[#DDF6A8] px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
          {interruptUi}
          <DuoButton
            tone="orange"
            size="xl"
            className="mt-[22vh] min-w-[260px] sm:mt-[18vh]"
            onClick={goQuestionWithVeil}
          >
            {tx("育てる", "Grow")}
          </DuoButton>
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="mt-auto w-64"
          >
            <EmptyPotArt showSeed className="h-64 w-full" />
          </motion.div>
          <AnimatePresence>
            {sceneVeil === "in" ? (
              <motion.div
                key="grow-veil-in"
                className="pointer-events-none absolute inset-0 z-40 bg-[#F4FFE8]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.88 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: "easeInOut" }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      );
    }

    if (screen.phase === "question") {
      return (
        <div className="relative">
          {interruptUi}
          <QuestionPanel
            title={locale === "en" ? prompt.en : prompt.ja}
            hint={tx("身の回りのことからアイデアを出そう", "Ideas from everyday life")}
            value={answer}
            onChange={setAnswer}
            placeholder={tx("自由に書いてみよう", "Write freely…")}
            buttonLabel={tx("次へ", "Next")}
            onSubmit={() => setGrow("title")}
          />
          <AnimatePresence>
            {sceneVeil === "out" ? (
              <motion.div
                key="grow-veil-out"
                className="pointer-events-none absolute inset-0 z-40 bg-[#F4FFE8]"
                initial={{ opacity: 0.88 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      );
    }

    if (screen.phase === "title") {
      return (
        <div className="relative">
          {interruptUi}
          <QuestionPanel
            title={tx("このアイデアのタイトルを決めてください", "Give this idea a title")}
            value={title}
            onChange={setTitle}
            placeholder={tx("短いタイトル", "Short title")}
            buttonLabel={tx("完了", "Done")}
            onSubmit={() => {
              setGrowStage(0);
              setGrow("growing");
            }}
            multiline={false}
            maxLength={40}
          />
        </div>
      );
    }

    if (screen.phase === "growing" || screen.phase === "celebrate") {
      const kind = selectedKind ?? "rose";
      return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-end overflow-hidden bg-gradient-to-b from-[#87CEEB] via-[#C8F0A8] to-[#8FBC5A] px-5 pb-10">
          <AnimatePresence>
            {showCelebrateText ? (
              <motion.p
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute top-[max(2.5rem,env(safe-area-inset-top))] z-20 text-center text-[24px] font-extrabold text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]"
              >
                {tx("素晴らしいアイデアだ！", "Wonderful idea!")}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.div layout className="mb-6 w-64">
            <FlowerArt kind={kind} stage={growStage === 0 ? 1 : growStage} className="h-72 w-full" />
          </motion.div>

          <AnimatePresence>
            {showContinueBtn ? (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
              >
                <DuoButton tone="orange" fullWidth onClick={finishGrow}>
                  {tx("明日も頑張る", "I'll try again tomorrow")}
                </DuoButton>
              </motion.div>
            ) : (
              <div className="h-[58px]" />
            )}
          </AnimatePresence>
        </div>
      );
    }
  }

  return null;
}
