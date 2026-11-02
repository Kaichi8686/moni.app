"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { QuestionPanel } from "@/components/idea-garden/QuestionPanel";
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
  weekKeysDesc,
} from "@/lib/idea-garden/storage";
import type {
  FlowerKind,
  GardenScreen,
  GrowPhase,
  PlantedIdea,
  SundayPhase,
} from "@/lib/idea-garden/types";
import { createMyIdea } from "@/lib/idea-hub/myIdeas";
import { burstCelebration } from "@/lib/ui/confetti";
import { useI18n } from "@/lib/i18n/I18nProvider";

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

  // shelf
  const [weekIndex, setWeekIndex] = useState(0);

  const persist = useCallback((next: PlantedIdea[]) => {
    setPlants(next);
    saveGarden({ version: 1, plants: next });
  }, []);

  useEffect(() => {
    // localStorage hydrate (client-only)
    const state = loadGarden();
    /* eslint-disable react-hooks/set-state-in-effect -- mount hydrate from localStorage */
    setPlants(state.plants);
    setScreen(initialScreen(state.plants));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const immersive =
    screen.kind === "grow"
      ? screen.phase !== "pick-bag"
      : screen.kind === "sunday"
        ? screen.phase !== "start"
        : false;

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
    persist(upsertPlant(plants, plant));
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
    persist(next);
    setWeekIndex(0);
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

  /* ——— SHELF ——— */
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
          headerSlot={
            <div className="pt-1 text-center">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#3C3C3C]">
                {tx("アイデアの棚", "Idea shelf")}
              </h1>
              <p className="mt-1 text-[13px] font-semibold text-zinc-500">
                {isSunday()
                  ? tx("日曜はお気に入りを深掘りしよう", "Sundays are for deepening a favorite")
                  : tx("毎日ひとつ、種を育てよう", "Grow one idea seed each day")}
              </p>
              {canStartGrow ? (
                <div className="mt-4">
                  <DuoButton tone="green" onClick={() => setGrow("pick-bag")}>
                    {tx("今日の種を選ぶ", "Pick today’s seed")}
                  </DuoButton>
                </div>
              ) : null}
              {canStartSunday ? (
                <div className="mt-4">
                  <DuoButton tone="gold" onClick={() => setSunday("start")}>
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
              tone="gold"
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
        <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#FFF7D6] to-[#EAF8FF] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
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
              tone="gold"
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
        <QuestionPanel
          title={tx("このアイデアのターゲットは誰？", "Who is the target for this idea?")}
          value={target}
          onChange={setTarget}
          placeholder={tx("例：忙しい高校生", "e.g. busy high-school students")}
          buttonLabel={tx("次へ", "Next")}
          onSubmit={() => setSunday("situation")}
        />
      );
    }

    if (screen.phase === "situation") {
      return (
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
                <DuoButton tone="gold" fullWidth onClick={finishSunday}>
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

          <div className="relative mt-8 flex flex-1 items-center justify-center">
            <button
              type="button"
              className="absolute left-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md"
              onClick={() => setBagIndex((i) => (i - 1 + SEED_BAGS.length) % SEED_BAGS.length)}
              aria-label={tx("前の袋", "Previous bag")}
            >
              <ChevronLeft />
            </button>

            <div className="flex w-full items-center justify-center gap-3 overflow-hidden">
              <SeedBagArt
                kind={SEED_BAGS[(bagIndex - 1 + SEED_BAGS.length) % SEED_BAGS.length]!.id}
                className="h-36 w-28 shrink-0 opacity-40 scale-90"
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setSelectedKind(bag.id);
                  setGrow("bag-focus");
                }}
                className="relative z-10 shrink-0"
                aria-label={locale === "en" ? bag.labelEn : bag.labelJa}
              >
                <SeedBagArt kind={bag.id} selected className="h-56 w-44" />
              </motion.button>
              <SeedBagArt
                kind={SEED_BAGS[(bagIndex + 1) % SEED_BAGS.length]!.id}
                className="h-36 w-28 shrink-0 opacity-40 scale-90"
              />
            </div>

            <button
              type="button"
              className="absolute right-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md"
              onClick={() => setBagIndex((i) => (i + 1) % SEED_BAGS.length)}
              aria-label={tx("次の袋", "Next bag")}
            >
              <ChevronRight />
            </button>
          </div>

          <p className="mt-2 text-center text-[16px] font-extrabold text-[#3C3C3C]">
            {locale === "en" ? bag.labelEn : bag.labelJa}
          </p>
        </div>
      );
    }

    if (screen.phase === "bag-focus") {
      const kind = selectedKind ?? bag.id;
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#E8F8FF] to-[#F0FFF4] px-6">
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
      return <SeedRevealPhase kind={selectedKind ?? bag.id} onDone={() => setGrow("plant")} />;
    }

    if (screen.phase === "plant") {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center bg-gradient-to-b from-[#E8F8FF] via-[#EAF9D8] to-[#DDF6A8] px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
          <DuoButton tone="green" className="mt-4 min-w-[200px]" onClick={() => setGrow("question")}>
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
        </div>
      );
    }

    if (screen.phase === "question") {
      return (
        <QuestionPanel
          title={locale === "en" ? prompt.en : prompt.ja}
          hint={tx("身の回りのことからアイデアを出そう", "Ideas from everyday life")}
          value={answer}
          onChange={setAnswer}
          placeholder={tx("自由に書いてみよう", "Write freely…")}
          buttonLabel={tx("次へ", "Next")}
          onSubmit={() => setGrow("title")}
        />
      );
    }

    if (screen.phase === "title") {
      return (
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
                <DuoButton tone="green" fullWidth onClick={finishGrow}>
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
