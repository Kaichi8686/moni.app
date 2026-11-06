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
  "flex w-[8rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white";

/** 作成・投票する = アイデアタブと同系の大きめ DuoButton */
const CARD_BTN = "!mt-1 !min-h-[2.35rem] !rounded-2xl !px-2 !py-2 !text-[12px] !leading-none";

const CARD_TITLE =
  "line-clamp-2 min-h-0 flex-1 text-center text-[13px] font-extrabold leading-snug tracking-tight text-zinc-900";

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
    <div className="shrink-0 border-b border-zinc-100 bg-white px-4 py-2.5">
      <div className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <article className={CARD_SHELL} style={{ height: "10.25rem" }}>
          <div className="flex h-[42%] items-center justify-center rounded-t-2xl bg-[#FF9600]">
            <Plus className="h-8 w-8 text-white" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-2 pt-1.5">
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
          <article key={ev.id} className={CARD_SHELL} style={{ height: "10.25rem" }}>
            <div className="flex h-[42%] items-center justify-center rounded-t-2xl bg-[#FF9600]">
              <Vote className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-2 pt-1.5">
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
      </div>
    </div>
  );
}
