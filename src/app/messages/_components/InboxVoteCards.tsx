"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { fetchEvents, type IdeaVoteEventWithCount } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { isVoteEventClosed } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
};

const CARD_SHELL =
  "flex w-[8rem] shrink-0 snap-start flex-col overflow-visible rounded-2xl border border-zinc-200 bg-white";

/** 作成・投票する = アイデアタブと同じ Duo 立体ボタン（下帯シャドウ＋押下） */
const CARD_BTN = "!mt-1 !min-h-[2.5rem] !px-2 !py-2.5 !text-[13px]";

const CARD_TITLE =
  "min-h-0 flex-1 truncate text-center text-[13px] font-extrabold leading-snug tracking-tight text-zinc-900";

/** プロジェクトメッセージ: 検索欄と名前一覧のあいだに置く縦長の投票カード */
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
          <div className="flex h-[4.25rem] items-center justify-center overflow-hidden rounded-t-2xl bg-[#FF9600]">
            <Plus className="h-8 w-8 text-white" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-3 pt-1.5">
            <p className={CARD_TITLE}>{tx("投票を作る", "Create vote")}</p>
            <DuoButton
              type="button"
              tone="orange"
              size="md"
              fullWidth
              onClick={() => router.push(`/projects/${projectId}/ideas/new`)}
              className={CARD_BTN}
            >
              {tx("作成", "Create")}
            </DuoButton>
          </div>
        </article>

        {events.map((ev) => (
          <article key={ev.id} className={CARD_SHELL} style={{ minHeight: "10.5rem" }}>
            <div className="flex h-[4.25rem] items-center justify-center overflow-hidden rounded-t-2xl bg-[#FF9600]">
              <Vote className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-3 pt-1.5">
              <p className={CARD_TITLE}>{ev.title}</p>
              <DuoButton
                type="button"
                tone="orange"
                size="md"
                fullWidth
                onClick={() =>
                  router.push(`/projects/${projectId}/ideas?event=${encodeURIComponent(ev.id)}`)
                }
                className={CARD_BTN}
              >
                {tx("投票する", "Vote")}
              </DuoButton>
            </div>
          </article>
        ))}
        <div className="w-4 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
