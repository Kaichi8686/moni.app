"use client";

import { useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { CoachScreen } from "@/components/office/visual/CoachScreen";
import { DiagnoseScreen } from "@/components/office/visual/DiagnoseScreen";
import { PlayScreen } from "@/components/office/visual/PlayScreen";
import { ScoreScreen } from "@/components/office/visual/ScoreScreen";
import { StepTracker, type VisualStep } from "@/components/office/visual/StepTracker";
import { TopBar } from "@/components/office/visual/TopBar";
import {
  calcMockScore,
  MOCK_COINS,
  MOCK_DATE_KEY,
  MOCK_STAMINA,
  type MockScore,
} from "@/components/office/visual/mockData";
import "@/app/office/office-visual.css";

type Props = {
  embedded?: boolean;
  hideChrome?: boolean;
};

const COL = "mx-auto w-full max-w-[480px] px-4 sm:px-5";

export function OfficeVisualApp({ embedded, hideChrome }: Props) {
  const [step, setStep] = useState<VisualStep>("diagnose");
  const [hypId, setHypId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [adlib, setAdlib] = useState("");
  const [score, setScore] = useState<MockScore | null>(null);
  const [coins, setCoins] = useState(MOCK_COINS);

  function toggleCard(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function startScore() {
    const s = calcMockScore(selected, hypId);
    setScore(s);
    setCoins(MOCK_COINS + s.coins);
    setStep("score");
  }

  function resetDay() {
    setStep("diagnose");
    setHypId(null);
    setSelected([]);
    setAdlib("");
    setScore(null);
  }

  return (
    <div className="office-visual">
      {!hideChrome ? (
        <header className="sticky top-0 z-30 border-b border-[var(--ov-border)] bg-[var(--ov-bg)]/95 backdrop-blur">
          <div className={`${COL} py-2`}>
            <p className="ov-title text-center text-xs tracking-[0.16em] text-[var(--ov-muted)]">
              moni オフィス（見た目モック）
            </p>
          </div>
        </header>
      ) : null}

      <main className={`${COL} space-y-3 pb-28 pt-3`}>
        <TopBar dateKey={MOCK_DATE_KEY} coins={coins} stamina={MOCK_STAMINA} />
        <StepTracker step={step} />

        {step === "diagnose" ? (
          <DiagnoseScreen
            selected={hypId}
            onSelect={setHypId}
            onNext={() => setStep("play")}
          />
        ) : null}

        {step === "play" ? (
          <PlayScreen
            selected={selected}
            onToggle={toggleCard}
            hypothesisId={hypId}
            adlib={adlib}
            onAdlib={setAdlib}
            onNext={startScore}
          />
        ) : null}

        {step === "score" && score ? (
          <ScoreScreen score={score} onNext={() => setStep("coach")} />
        ) : null}

        {step === "coach" ? <CoachScreen onNext={resetDay} /> : null}
      </main>

      {!hideChrome && !embedded ? <AppBottomNav /> : null}
    </div>
  );
}
