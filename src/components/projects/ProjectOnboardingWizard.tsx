"use client";

import { useState } from "react";
import type { OnboardingProgressStage, OnboardingTeamSize } from "@/lib/projects/coachingContext";
import type { UserSituation } from "@/lib/projects/userSituation";
import { UserSituationPicker } from "@/components/projects/UserSituationPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ProjectOnboardingPayload = {
  userSituation: UserSituation;
  dreamText: string;
  progressStage: OnboardingProgressStage;
  teamSize: OnboardingTeamSize;
};

const PROGRESS_OPTIONS: Array<{ key: OnboardingProgressStage; label: string; hint: string }> = [
  { key: "idea", label: "まだ始めたばかり", hint: "これから動き出す" },
  { key: "research", label: "調べ始めた", hint: "人に聞いたり情報を集めている" },
  { key: "prototype", label: "少し試した", hint: "試作品や下書きがある" },
  { key: "live", label: "もう動いている", hint: "本番や発表が近い・始まっている" },
];

const TEAM_OPTIONS: Array<{ key: OnboardingTeamSize; label: string }> = [
  { key: "solo", label: "一人で" },
  { key: "small", label: "2〜3人" },
  { key: "large", label: "4人以上" },
];

type Props = {
  projectName: string;
  submitting: boolean;
  onComplete: (payload: ProjectOnboardingPayload) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
};

export function ProjectOnboardingWizard({ projectName, submitting, onComplete, onSkip }: Props) {
  const { tx } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [userSituation, setUserSituation] = useState<UserSituation | null>(null);
  const [dreamText, setDreamText] = useState("");
  const [progressStage, setProgressStage] = useState<OnboardingProgressStage | null>(null);
  const [teamSize, setTeamSize] = useState<OnboardingTeamSize | null>(null);

  const canNext1 = userSituation !== null;
  const canNext2 = progressStage !== null;
  const canFinish = teamSize !== null && canNext1 && canNext2;

  const finish = () => {
    if (!userSituation || !progressStage || !teamSize || submitting) return;
    void onComplete({
      userSituation,
      dreamText: dreamText.trim(),
      progressStage,
      teamSize,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#FAFAF8] px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-onboarding-title"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{tx("はじめに", "Getting started")}</p>
        <h1 id="project-onboarding-title" className="mt-2 text-center text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          {projectName}
        </h1>
        <p className="mx-auto mt-1 max-w-sm text-center text-sm text-zinc-600" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
          {tx("3ステップで、今日から動けるロードマップのたたき台をつくります。", "In 3 steps, we’ll draft a roadmap you can start using today.")}
        </p>

        <div className="mt-6 flex justify-center gap-2" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-2 w-8 rounded-full transition duration-200 ease-out ${step >= n ? "bg-[#FF5C35]" : "bg-zinc-200"}`}
            />
          ))}
        </div>

        <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Step 1/3</p>
              </div>
              <UserSituationPicker value={userSituation} onChange={setUserSituation} disabled={submitting} />
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">{tx("やりたいこと（任意）", "What you want to do (optional)")}</span>
                <textarea
                  className="mt-1 min-h-[5rem] w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none transition duration-200 ease-out placeholder:text-zinc-400 focus:border-[#FF5C35] focus:ring-2 focus:ring-orange-100"
                  style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}
                  placeholder={tx("例: 新しいアプリを作って公開したい、などひとことでOK", "e.g. I want to ship a new app — one sentence is enough")}
                  value={dreamText}
                  onChange={(e) => setDreamText(e.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Step 2/3</p>
                <h2 className="mt-1 text-base font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
                  {tx("今、どこまで進んでる？", "How far along are you?")}
                </h2>
              </div>
              <div className="grid gap-2">
                {PROGRESS_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={submitting}
                    onClick={() => setProgressStage(o.key)}
                    className={`flex min-h-[52px] flex-col rounded-2xl border px-4 py-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition duration-200 ease-out disabled:opacity-50 ${
                      progressStage === o.key
                        ? "border-[#FF5C35] bg-[#FFF3D6] ring-2 ring-[#FF5C35]/20"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-[#1A1A1A]">{tx(o.label, {
                      idea: "Just getting started",
                      research: "Started researching",
                      prototype: "Tried a little",
                      live: "Already running",
                    }[o.key])}</span>
                    <span className="mt-0.5 text-[11px] text-zinc-500">{tx(o.hint, {
                      idea: "About to start moving",
                      research: "Talking to people and gathering info",
                      prototype: "You have a prototype or draft",
                      live: "Launch or presentation is near / underway",
                    }[o.key])}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Step 3/3</p>
                <h2 className="mt-1 text-base font-bold text-[#1A1A1A]" style={{ fontFamily: "var(--font-noto-jp), sans-serif" }}>
                  {tx("チームで動く？一人でやる？", "Team or solo?")}
                </h2>
              </div>
              <div className="grid gap-2">
                {TEAM_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={submitting}
                    onClick={() => setTeamSize(o.key)}
                    className={`min-h-[48px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition duration-200 ease-out disabled:opacity-50 ${
                      teamSize === o.key
                        ? "border-[#FF5C35] bg-[#FFF3D6] text-[#1A1A1A] ring-2 ring-[#FF5C35]/20"
                        : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {tx(o.label, { solo: "Solo", small: "2–3 people", large: "4 or more" }[o.key])}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {tx(
                  "「完了する」と、選んだ状況に合ったステップが並び、進み具合に合わせて「進行中・完了」が初期セットされます。",
                  "When you finish, matching steps are laid out and In progress / Done are pre-set from how far along you are.",
                )}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-auto shrink-0 space-y-3 pt-6">
          {step < 3 ? (
            <div className="flex gap-2">
              {step > 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
                  className="min-h-[48px] flex-1 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition duration-200 ease-out hover:bg-zinc-50 disabled:opacity-50"
                >
                  {tx("戻る", "Back")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onSkip()}
                  className="min-h-[48px] flex-1 rounded-2xl border border-transparent text-sm font-medium text-zinc-500 transition duration-200 ease-out hover:text-zinc-700 disabled:opacity-50"
                >
                  {tx("後で", "Later")}
                </button>
              )}
              <button
                type="button"
                disabled={submitting || (step === 1 ? !canNext1 : !canNext2)}
                onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                className="min-h-[48px] flex-[2] rounded-2xl bg-[#FF5C35] text-sm font-bold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:opacity-40"
              >
                {tx("次へ", "Next")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={submitting || !canFinish}
                onClick={() => finish()}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-[#FF5C35] text-sm font-bold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:opacity-40"
              >
                {submitting ? tx("作成中…", "Creating…") : tx("完了してホームへ", "Finish and go home")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep(2)}
                className="min-h-[48px] flex-1 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition duration-200 ease-out hover:bg-zinc-50 disabled:opacity-50"
              >
                {tx("戻る", "Back")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
