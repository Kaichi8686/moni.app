"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { fetchEvents, type IdeaVoteEventWithCount } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { isVoteEventClosed } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
};

/**
 * サイズは維持。白カード＋細いオレンジ帯。
 * CTA は Duo 立体ではなく Apple 風のフラットなカプセルボタン。
 */
const CARD_SHELL =
  "relative flex w-[8rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white";

/** Apple 風: 立体シャドウなし・角丸カプセル・押下は opacity */
const CARD_BTN =
  "mt-1 inline-flex min-h-[2.5rem] w-full items-center justify-center rounded-full bg-[#FF9600] px-3 py-2.5 text-[13px] font-semibold tracking-tight text-white transition-opacity active:opacity-70 disabled:opacity-45";

const CARD_TITLE =
  "min-h-0 flex-1 truncate text-center text-[13px] font-extrabold leading-snug tracking-tight text-zinc-900";

/** プロジェクトメッセージ: 検索欄と名前一覧のあいだに置く投票カード */
export function InboxVoteCards({ projectId }: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const [events, setEvents] = useState<IdeaVoteEventWithCount[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) {
      setReady(true);
      return;
    }
    try {
      const list = await fetchEvents(projectId);
      setEvents(list.filter((ev) => !isVoteEventClosed(ev)));
    } catch (e) {
      console.warn("inbox vote cards", e);
      setEvents([]);
    } finally {
      setReady(true);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (!ready) return null;

  return (
    /*
      横パディングを外側に置くと overflow のクリップ枠（額縁）になり、
      スクロール中にカードが画面端より内側で切れる。スクロール面は全幅にし、
      余白は内側スペーサーだけにする（カードサイズは変えない）。
    */
    <div className="shrink-0 border-b border-zinc-100 bg-white py-2.5">
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-4 shrink-0" aria-hidden />

        <article className={CARD_SHELL} style={{ minHeight: "10.5rem" }}>
          <div className="h-1.5 w-full bg-[#FF9600]" aria-hidden />
          <div className="flex min-h-0 flex-1 flex-col items-center px-2 pb-3 pt-2.5">
            <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[#FF9600] bg-orange-50 text-[#D97706]">
              <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </span>
            <p className={CARD_TITLE}>{tx("投票を作る", "Create vote")}</p>
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}/ideas/new`)}
              className={CARD_BTN}
            >
              {tx("作成", "Create")}
            </button>
          </div>
        </article>

        {events.map((ev) => (
          <article key={ev.id} className={CARD_SHELL} style={{ minHeight: "10.5rem" }}>
            <div className="h-1.5 w-full bg-[#FF9600]" aria-hidden />
            <div className="flex min-h-0 flex-1 flex-col items-center px-2 pb-3 pt-2.5">
              <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-[#D97706]">
                <Vote className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </span>
              <p className={CARD_TITLE}>{ev.title}</p>
              <button
                type="button"
                onClick={() =>
                  router.push(`/projects/${projectId}/ideas?event=${encodeURIComponent(ev.id)}`)
                }
                className={CARD_BTN}
              >
                {tx("投票する", "Vote")}
              </button>
            </div>
          </article>
        ))}

        <div className="w-4 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
