"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Vote } from "lucide-react";
import { fetchEvents, type IdeaVoteEventWithCount } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { isVoteEventClosed } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
};

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

  const cards =
    events.length > 0
      ? events.map((ev) => ({
          key: ev.id,
          title: ev.title,
          href: `/projects/${projectId}/ideas?event=${encodeURIComponent(ev.id)}`,
        }))
      : [
          {
            key: "empty",
            title: tx("投票", "Voting"),
            href: `/projects/${projectId}/ideas`,
          },
        ];

  return (
    <div className="shrink-0 border-b border-zinc-100 bg-white px-4 py-2.5">
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => (
          <article
            key={card.key}
            className="flex w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-none border border-zinc-300 bg-white"
            style={{ height: "9.25rem" }}
          >
            <div className="flex h-[46%] items-center justify-center bg-orange-500">
              <Vote className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1.5 pt-1.5">
              <p className="line-clamp-2 min-h-0 flex-1 text-center text-[11px] font-semibold leading-tight tracking-tight text-zinc-900">
                {card.title}
              </p>
              <button
                type="button"
                onClick={() => router.push(card.href)}
                className="mt-1 w-full rounded-none bg-zinc-900 px-1 py-1 text-[10px] font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950"
              >
                {tx("投票する", "Vote")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
