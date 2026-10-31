"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { BottleVisual } from "@/components/idea-hub/weekly/BottleVisual";
import { DuoPressButton } from "@/components/idea-hub/weekly/DuoPressButton";
import { GiftBoxVisual } from "@/components/idea-hub/weekly/GiftBoxVisual";
import { WeeklyBox } from "@/components/idea-hub/weekly/WeeklyBox";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  GIFT_PATTERNS,
  PROMPT_QUESTION,
  TITLE_QUESTION,
  formatWeekRangeLabel,
  getBottleForSlot,
  invalidateWeeklyBottleCache,
  listBottlesForWeek,
  listPastWeekIds,
  newBottleId,
  readWeeklyBottleStore,
  tokyoWeekdaySlot,
  upsertBottle,
  weekIdForDate,
  type BottledIdea,
  type GiftPatternId,
  type WeekdaySlot,
} from "@/lib/idea-hub/weeklyBottles";

function subscribeBottles(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key !== "moni:weekly-idea-bottles:v1") return;
    invalidateWeeklyBottleCache();
    onStoreChange();
  };
  window.addEventListener("moni-weekly-bottles-changed", onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("moni-weekly-bottles-changed", onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type RitualImmersive = boolean;

type Phase =
  | "home"
  | "gift-select"
  | "gift-focus"
  | "gift-opened"
  | "paper-q1"
  | "paper-q2"
  | "bottle-seal"
  | "bottle-insert"
  | "success"
  | "view-open"
  | "view-detail";

type Props = {
  onImmersiveChange?: (immersive: boolean) => void;
};

export function WeeklyIdeaRitual({ onImmersiveChange }: Props) {
  const { tx, locale } = useI18n();
  const loc = locale === "en" ? "en" : "ja";

  const [giftIndex, setGiftIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [title, setTitle] = useState("");
  const [viewing, setViewing] = useState<BottledIdea | null>(null);
  const [insertingSlot, setInsertingSlot] = useState<WeekdaySlot | null>(null);
  const [selectedPastWeek, setSelectedPastWeek] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("home");
  const mounted = useClientMounted();
  const store = useSyncExternalStore(subscribeBottles, readWeeklyBottleStore, readWeeklyBottleStore);

  const currentWeekId = weekIdForDate();
  const todaySlot = tokyoWeekdaySlot();
  const weekBottles = listBottlesForWeek(currentWeekId, store);
  const pastWeekIds = listPastWeekIds(currentWeekId, store);
  const todayBottle = todaySlot != null ? getBottleForSlot(currentWeekId, todaySlot, store) : undefined;
  const giftPattern = GIFT_PATTERNS[giftIndex % GIFT_PATTERNS.length].id;

  /** After mount: empty week + weekday → gift carousel (avoid SSR mismatch). */
  const viewPhase: Phase =
    mounted && phase === "home" && weekBottles.length === 0 && todaySlot != null && !todayBottle
      ? "gift-select"
      : phase;

  const immersive =
    viewPhase === "gift-focus" ||
    viewPhase === "gift-opened" ||
    viewPhase === "paper-q1" ||
    viewPhase === "paper-q2" ||
    viewPhase === "bottle-seal" ||
    viewPhase === "bottle-insert" ||
    viewPhase === "success" ||
    viewPhase === "view-open" ||
    viewPhase === "view-detail";

  useEffect(() => {
    onImmersiveChange?.(immersive);
  }, [immersive, onImmersiveChange]);

  const startGiftFlow = () => {
    if (todaySlot == null || todayBottle) return;
    setAnswer("");
    setTitle("");
    setGiftIndex(0);
    setPhase("gift-select");
  };

  const openGiftFocus = () => setPhase("gift-focus");

  const openGift = () => setPhase("gift-opened");

  const startWriting = () => setPhase("paper-q1");

  const completeQ1 = () => {
    if (!answer.trim()) return;
    setPhase("paper-q2");
  };

  const completeTitle = () => {
    if (!title.trim() || todaySlot == null) return;
    setPhase("bottle-seal");
    window.setTimeout(() => {
      setInsertingSlot(todaySlot);
      setPhase("bottle-insert");
      const idea: BottledIdea = {
        id: newBottleId(),
        weekId: currentWeekId,
        slot: todaySlot,
        giftPattern,
        title: title.trim(),
        answer: answer.trim(),
        createdAt: new Date().toISOString(),
      };
      upsertBottle(idea);
      window.setTimeout(() => {
        setPhase("success");
        setInsertingSlot(null);
      }, 1100);
    }, 900);
  };

  const finishSuccess = () => {
    setPhase("home");
    setAnswer("");
    setTitle("");
  };

  const openBottle = (bottle: BottledIdea) => {
    setViewing(bottle);
    setPhase("view-open");
    window.setTimeout(() => setPhase("view-detail"), 900);
  };

  const closeViewer = () => {
    setViewing(null);
    setPhase("home");
    setSelectedPastWeek(null);
  };

  const displayWeekId = selectedPastWeek ?? currentWeekId;
  const displayBottles = listBottlesForWeek(displayWeekId, store);

  return (
    <div
      className={`relative min-h-[70dvh] overflow-hidden ${
        immersive ? "fixed inset-0 z-50 min-h-[100dvh]" : ""
      }`}
      style={{
        background: immersive
          ? "linear-gradient(180deg, #DDF4FF 0%, #FFFFFF 42%, #E5F8D0 100%)"
          : "linear-gradient(180deg, #DDF4FF 0%, #FFFFFF 38%, #F7F7F7 100%)",
      }}
    >
      <AnimatePresence mode="wait">
        {/* ——— HOME / BOX ——— */}
        {viewPhase === "home" || viewPhase === "bottle-insert" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`mx-auto flex max-w-lg flex-col px-4 ${immersive ? "pt-10" : "pb-28 pt-4"}`}
          >
            {!immersive ? (
              <div className="mb-4 text-center">
                <p className="text-[13px] font-extrabold uppercase tracking-widest text-[#1CB0F6]">
                  {tx("今週のアイデア", "This week’s ideas")}
                </p>
                <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[#3C3C3C]">
                  {formatWeekRangeLabel(currentWeekId, loc)}
                </h2>
                <p className="mt-1 text-[13px] font-medium text-[#777]">
                  {todaySlot == null
                    ? tx("日曜はお休み。瓶を見返そう！", "Sunday rest — revisit your bottles!")
                    : todayBottle
                      ? tx("今日の瓶、ちゃんと入ってるよ！", "Today’s bottle is in!")
                      : tx("月〜土、毎日ひとつアイデアを瓶に。", "Bottle one idea each day, Mon–Sat.")}
                </p>
              </div>
            ) : null}

            <div className="flex items-start gap-3">
              {/* Past weeks rail */}
              {!immersive && pastWeekIds.length > 0 ? (
                <div className="flex w-[6.75rem] shrink-0 flex-col gap-3 overflow-y-auto pt-6">
                  <p className="text-center text-[10px] font-extrabold uppercase tracking-wide text-[#AFAFAF]">
                    {tx("過去", "Past")}
                  </p>
                  {pastWeekIds.slice(0, 6).map((wid) => (
                    <button
                      key={wid}
                      type="button"
                      onClick={() => setSelectedPastWeek(wid === selectedPastWeek ? null : wid)}
                      className={`scale-[0.92] origin-top transition ${
                        selectedPastWeek === wid ? "opacity-100" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      <WeeklyBox
                        bottles={listBottlesForWeek(wid, store)}
                        locale={loc}
                        compact
                        label={formatWeekRangeLabel(wid, loc)}
                        onSelectBottle={openBottle}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <WeeklyBox
                  bottles={displayBottles}
                  locale={loc}
                  todaySlot={displayWeekId === currentWeekId ? todaySlot : null}
                  insertingSlot={insertingSlot}
                  highlightSlot={insertingSlot}
                  label={
                    selectedPastWeek
                      ? formatWeekRangeLabel(selectedPastWeek, loc)
                      : tx("今週のボックス", "This week’s box")
                  }
                  onSelectBottle={openBottle}
                  onEmptyToday={startGiftFlow}
                />

                {!immersive && displayWeekId === currentWeekId && todaySlot != null && !todayBottle ? (
                  <div className="mt-6">
                    <DuoPressButton tone="green" fullWidth onClick={startGiftFlow}>
                      {tx("今日のプレゼントを開ける", "Open today’s gift")}
                    </DuoPressButton>
                  </div>
                ) : null}

                {!immersive && selectedPastWeek ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPastWeek(null)}
                    className="mt-4 w-full text-center text-[13px] font-bold text-[#1CB0F6]"
                  >
                    {tx("今週に戻る", "Back to this week")}
                  </button>
                ) : null}
              </div>
            </div>

            {viewPhase === "bottle-insert" ? (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2"
                initial={{ y: -40, scale: 1.2, opacity: 1 }}
                animate={{ y: 120, scale: 0.45, opacity: 0.85 }}
                transition={{ duration: 0.95, ease: [0.4, 0, 0.2, 1] }}
              >
                <BottleVisual size="md" />
              </motion.div>
            ) : null}
          </motion.div>
        ) : null}

        {/* ——— GIFT SELECT ——— */}
        {viewPhase === "gift-select" ? (
          <motion.div
            key="gift-select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 pb-28 pt-6"
          >
            <p className="mb-1 text-[13px] font-extrabold uppercase tracking-widest text-[#1CB0F6]">
              {tx("今日のミッション", "Today’s mission")}
            </p>
            <h2 className="mb-8 text-center text-[24px] font-extrabold text-[#3C3C3C]">
              {tx("プレゼントを選ぼう", "Pick a gift")}
            </h2>

            <GiftCarousel index={giftIndex} onIndexChange={setGiftIndex} />

            <div className="mt-10 w-full max-w-xs">
              <DuoPressButton tone="green" fullWidth onClick={openGiftFocus}>
                {tx("開ける", "Open")}
              </DuoPressButton>
            </div>

            {weekBottles.length > 0 ? (
              <button
                type="button"
                onClick={() => setPhase("home")}
                className="mt-4 text-[13px] font-bold text-[#AFAFAF]"
              >
                {tx("ボックスに戻る", "Back to box")}
              </button>
            ) : null}
          </motion.div>
        ) : null}

        {/* ——— GIFT FOCUS (shake) ——— */}
        {viewPhase === "gift-focus" ? (
          <motion.div
            key="gift-focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-4"
          >
            <p className="mb-8 text-[15px] font-extrabold text-[#3C3C3C]">
              {tx("タップして開けて！", "Tap to open!")}
            </p>
            <button type="button" onClick={openGift} className="duo-pop-in focus:outline-none">
              <GiftBoxVisual pattern={giftPattern} size="xl" shaking />
            </button>
          </motion.div>
        ) : null}

        {/* ——— GIFT OPENED ——— */}
        {viewPhase === "gift-opened" ? (
          <motion.div
            key="gift-opened"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-4 pb-10"
          >
            <div className="relative mb-10 flex flex-col items-center">
              <motion.div
                className="relative z-10 mb-[-1.25rem]"
                initial={{ y: 40, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 16 }}
              >
                <RolledPaper />
              </motion.div>
              <GiftBoxVisual pattern={giftPattern} size="xl" open />
            </div>
            <div className="w-full max-w-xs">
              <DuoPressButton tone="sky" fullWidth onClick={startWriting}>
                {tx("書く", "Write")}
              </DuoPressButton>
            </div>
          </motion.div>
        ) : null}

        {/* ——— PAPER Q1 / Q2 ——— */}
        {viewPhase === "paper-q1" || viewPhase === "paper-q2" ? (
          <motion.div
            key="paper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-4 py-8"
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-[20px] border-[3px] border-[#E5C98A] px-5 py-6 shadow-[0_8px_0_#D4B56A]"
              style={{
                background:
                  "repeating-linear-gradient(180deg, #FFF8E7 0 28px, #F3E2B8 28px 29px), #FFF8E7",
              }}
            >
              <div className="pointer-events-none absolute inset-y-0 left-8 w-0.5 bg-[#FF4B4B]/35" />

              <AnimatePresence mode="wait">
                {viewPhase === "paper-q1" ? (
                  <motion.div
                    key="q1"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                  >
                    <p className="mb-1 text-[12px] font-extrabold uppercase tracking-widest text-[#FF9600]">
                      {tx("質問", "Question")}
                    </p>
                    <h3 className="mb-4 text-[20px] font-extrabold leading-snug text-[#3C3C3C]">
                      {loc === "en" ? PROMPT_QUESTION.en : PROMPT_QUESTION.ja}
                    </h3>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={5}
                      placeholder={tx("ここに書いてみよう…", "Write it here…")}
                      className="w-full resize-none rounded-2xl border-2 border-[#E5E5E5] bg-white/80 px-4 py-3 text-[15px] font-medium leading-relaxed text-[#3C3C3C] outline-none focus:border-[#1CB0F6]"
                    />
                    <div className="mt-5">
                      <DuoPressButton tone="green" fullWidth disabled={!answer.trim()} onClick={completeQ1}>
                        {tx("完了", "Done")}
                      </DuoPressButton>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="q2"
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                  >
                    <p className="mb-2 text-[13px] font-medium leading-relaxed text-[#777] line-clamp-3">
                      {answer}
                    </p>
                    <div className="mb-4 h-px bg-[#E5C98A]/80" />
                    <h3 className="mb-4 text-[20px] font-extrabold leading-snug text-[#3C3C3C]">
                      {loc === "en" ? TITLE_QUESTION.en : TITLE_QUESTION.ja}
                    </h3>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={tx("タイトル", "Title")}
                      className="w-full rounded-2xl border-2 border-[#E5E5E5] bg-white/80 px-4 py-3 text-[16px] font-extrabold text-[#3C3C3C] outline-none focus:border-[#1CB0F6]"
                    />
                    <div className="mt-5">
                      <DuoPressButton tone="green" fullWidth disabled={!title.trim()} onClick={completeTitle}>
                        {tx("完了", "Done")}
                      </DuoPressButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}

        {/* ——— BOTTLE SEAL ——— */}
        {viewPhase === "bottle-seal" ? (
          <motion.div
            key="seal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 1.1, y: -20 }}
              animate={{ scale: 0.35, y: 40, rotate: 8, opacity: 0 }}
              transition={{ duration: 0.85, ease: "easeIn" }}
              className="mb-4 w-full max-w-xs rounded-xl border-2 border-[#E5C98A] bg-[#FFF8E7] px-4 py-3 text-center text-sm font-bold text-[#3C3C3C]"
            >
              {title}
            </motion.div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 14 }}
              className="duo-float-y"
            >
              <BottleVisual size="lg" />
            </motion.div>
            <p className="mt-8 text-[15px] font-extrabold text-[#3C3C3C]">
              {tx("瓶に詰めてる…", "Bottling it up…")}
            </p>
          </motion.div>
        ) : null}

        {/* ——— SUCCESS ——— */}
        {viewPhase === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 14 }}
              className="mb-6"
              aria-hidden
            >
              <SuccessBurst />
            </motion.div>
            <h2 className="mb-10 text-center text-[28px] font-extrabold leading-tight text-[#3C3C3C]">
              {tx("素晴らしいアイデアだ！", "Wonderful idea!")}
            </h2>
            <div className="w-full max-w-xs">
              <DuoPressButton tone="green" fullWidth onClick={finishSuccess}>
                {tx("今日も頑張る！", "I’ll do my best today!")}
              </DuoPressButton>
            </div>
          </motion.div>
        ) : null}

        {/* ——— VIEW OPEN ——— */}
        {viewPhase === "view-open" && viewing ? (
          <motion.div
            key="view-open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full min-h-[100dvh] flex-col items-center justify-center px-4"
          >
            <BottleVisual size="lg" corkOpen paperRising />
          </motion.div>
        ) : null}

        {/* ——— VIEW DETAIL ——— */}
        {viewPhase === "view-detail" && viewing ? (
          <motion.div
            key="view-detail"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex h-full min-h-[100dvh] flex-col px-4 pb-10 pt-6"
          >
            <div className="mx-auto flex w-full max-w-lg items-center justify-between">
              <button
                type="button"
                onClick={closeViewer}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#E5E5E5] bg-white text-[#777]"
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
              <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#1CB0F6]">
                {tx("瓶のメモ", "Bottle note")}
              </span>
              <span className="w-11" />
            </div>

            <div
              className="mx-auto mt-6 w-full max-w-md flex-1 overflow-y-auto rounded-[20px] border-[3px] border-[#E5C98A] px-6 py-8 shadow-[0_8px_0_#D4B56A]"
              style={{
                background:
                  "repeating-linear-gradient(180deg, #FFF8E7 0 30px, #F3E2B8 30px 31px), #FFF8E7",
              }}
            >
              <h2 className="mb-5 text-[26px] font-extrabold leading-snug text-[#3C3C3C]">{viewing.title}</h2>
              <p className="whitespace-pre-wrap text-[16px] font-medium leading-relaxed text-[#4B4B4B]">
                {viewing.answer}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GiftCarousel({
  index,
  onIndexChange,
}: {
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const n = GIFT_PATTERNS.length;
  const prev = () => onIndexChange((index - 1 + n) % n);
  const next = () => onIndexChange((index + 1) % n);

  // swipe
  const [dragX, setDragX] = useState(0);

  return (
    <div className="relative flex w-full max-w-sm items-center justify-center gap-1">
      <button
        type="button"
        onClick={prev}
        className="z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#E5E5E5] bg-white text-[#1CB0F6] shadow-[0_3px_0_#E5E5E5] active:translate-y-[2px] active:shadow-none"
        aria-label="prev"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="relative flex h-48 w-full items-center justify-center overflow-visible">
        {([-1, 0, 1] as const).map((offset) => {
          const i = (index + offset + n) % n;
          const pattern = GIFT_PATTERNS[i].id as GiftPatternId;
          const isCenter = offset === 0;
          return (
            <motion.div
              key={`${pattern}-${offset}`}
              className="absolute"
              animate={{
                x: offset * 110 + dragX * (isCenter ? 1 : 0.4),
                scale: isCenter ? 1.15 : 0.78,
                opacity: isCenter ? 1 : 0.55,
                zIndex: isCenter ? 5 : 1,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              drag={isCenter ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.55}
              onDrag={(_, info) => setDragX(info.offset.x)}
              onDragEnd={(_, info) => {
                setDragX(0);
                if (info.offset.x < -60) next();
                else if (info.offset.x > 60) prev();
              }}
            >
              <GiftBoxVisual pattern={pattern} size={isCenter ? "lg" : "md"} />
            </motion.div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={next}
        className="z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#E5E5E5] bg-white text-[#1CB0F6] shadow-[0_3px_0_#E5E5E5] active:translate-y-[2px] active:shadow-none"
        aria-label="next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function RolledPaper() {
  return (
    <div className="relative" aria-hidden>
      <div
        className="h-20 w-12 rounded-full border-[3px] border-[#C4842D]/70"
        style={{
          background: "repeating-linear-gradient(90deg, #FFF8E7 0 5px, #FFE2A8 5px 9px)",
          boxShadow: "0 5px 0 rgba(180,120,40,0.28), 0 12px 20px rgba(60,40,10,0.14)",
        }}
      />
      <div className="absolute -right-1 top-2 h-3 w-3 rounded-full bg-[#FFC800] shadow-[0_2px_0_#E5A500]" />
      <div className="absolute -left-2 bottom-3 h-2.5 w-2.5 rounded-full bg-[#1CB0F6] shadow-[0_2px_0_#1899D6]" />
    </div>
  );
}

function SuccessBurst() {
  return (
    <div className="relative h-24 w-24">
      <div className="absolute inset-0 rounded-full bg-[#FFC800] shadow-[0_6px_0_#E5A500]" />
      <div className="absolute inset-[18%] rounded-full bg-white/35" />
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-[30%] bg-[#58CC02] shadow-[0_3px_0_#46A302]" />
      <span className="absolute -left-2 top-2 h-3 w-3 rotate-12 rounded-sm bg-[#FF4B4B]" />
      <span className="absolute -right-1 top-4 h-3 w-3 -rotate-12 rounded-sm bg-[#1CB0F6]" />
      <span className="absolute bottom-1 left-0 h-2.5 w-2.5 rounded-full bg-[#CE82FF]" />
      <span className="absolute bottom-2 right-0 h-2.5 w-2.5 rounded-full bg-[#FF86D0]" />
    </div>
  );
}
