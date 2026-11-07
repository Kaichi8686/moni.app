"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  problemMotivation: string;
  projectGoal: string;
  saving: boolean;
  error: string;
  onChange: (next: { problemMotivation: string; projectGoal: string }) => void;
  onBack: () => void;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
  confirmDiscard: boolean;
  onSubmit: () => void;
};

function subscribeNoop() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * ゴール初回入力の全画面。
 * 画面切替の演出は親の SceneVeil（育てると同じベール）側。ここは差し替え後の中身だけ。
 */
export function ProjectBriefComposer({
  projectName,
  problemMotivation,
  projectGoal,
  saving,
  error,
  onChange,
  onBack,
  onConfirmDiscard,
  onCancelDiscard,
  confirmDiscard,
  onSubmit,
}: Props) {
  const { tx } = useI18n();
  const portalReady = useIsClient();
  const [exiting, setExiting] = useState(false);

  const name = projectName.trim() || tx("プロジェクト", "Project");
  const title = tx(`「${name}」のゴール`, `Goal of “${name}”`);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
    };
  }, []);

  function requestBack() {
    if (saving || exiting) return;
    onBack();
  }

  function finishDiscard() {
    setExiting(true);
    window.setTimeout(() => onConfirmDiscard(), 200);
  }

  if (!portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex w-full max-w-[100vw] flex-col overscroll-none bg-[#FFFCF8]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-brief-composer-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-orange-100/50 via-transparent to-orange-50/40"
        aria-hidden
      />

      <div className="relative flex shrink-0 items-center gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          disabled={saving || exiting}
          onClick={requestBack}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-800 shadow-[0_2px_0_#D4D4D8] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[2px] enabled:active:shadow-none disabled:opacity-50"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
        <h1
          id="project-brief-composer-title"
          className="min-w-0 flex-1 truncate text-[20px] font-extrabold leading-tight text-zinc-900"
        >
          {title}
        </h1>
      </div>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-2">
        <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col gap-5">
          <p className="text-[13px] leading-relaxed text-zinc-600">
            {tx(
              "なぜ始めたかと、目指すゴールを書いておきましょう。ロードマップの土台になります。",
              "Write why you started and the goal you’re aiming for. It becomes the base for your roadmap.",
            )}
          </p>

          <label className="block">
            <span className="text-[12px] font-semibold text-zinc-700">
              {tx(
                "どのようなことを解決したくてこのプロジェクトを思いついたか",
                "What problem made you think of this project?",
              )}
            </span>
            <textarea
              className="mt-1.5 min-h-[7rem] w-full resize-y rounded-2xl border border-orange-200/80 bg-white px-3.5 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              rows={4}
              placeholder={tx(
                "例: 学校の行事告知がバラバラで、みんな見逃しがちだった",
                "e.g. Event notices were scattered and people kept missing them",
              )}
              value={problemMotivation}
              onChange={(e) =>
                onChange({ problemMotivation: e.target.value, projectGoal })
              }
              disabled={saving || exiting}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-zinc-700">
              {tx("このプロジェクトのゴール", "Project goal")}
            </span>
            <textarea
              className="mt-1.5 min-h-[5.5rem] w-full resize-y rounded-2xl border border-orange-200/80 bg-white px-3.5 py-3 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-400 placeholder:font-normal focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              rows={3}
              placeholder={tx(
                "例: 文化祭までに、クラス全員が見られる告知アプリを公開する",
                "e.g. Ship a notice app the whole class can use by the school festival",
              )}
              value={projectGoal}
              onChange={(e) =>
                onChange({ problemMotivation, projectGoal: e.target.value })
              }
              disabled={saving || exiting}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100/80 bg-[#FFFCF8]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <DuoButton
            type="button"
            tone="orange"
            size="lg"
            fullWidth
            disabled={saving || exiting}
            onClick={onSubmit}
          >
            {saving ? tx("保存中…", "Saving…") : tx("一歩を踏み出す", "Take the first step")}
          </DuoButton>
        </div>
      </div>

      {confirmDiscard ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="project-brief-discard-title"
            className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 text-center shadow-xl"
          >
            <h3 id="project-brief-discard-title" className="text-base font-semibold text-[#202124]">
              {tx("今書いた内容は消えますが大丈夫ですか？", "Your writing will be deleted. Is that OK?")}
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              {tx(
                "戻ると、ゴールときっかけの下書きは捨てられます。この操作は取り消せません。",
                "Going back discards your goal and motivation draft. This can’t be undone.",
              )}
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-[220px] flex-col items-stretch gap-3">
              <button
                type="button"
                className="rounded-xl bg-[#d93025] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c5221f]"
                onClick={finishDiscard}
              >
                {tx("捨てて戻る", "Discard")}
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                onClick={onCancelDiscard}
              >
                {tx("キャンセル", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
