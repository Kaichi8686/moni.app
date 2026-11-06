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
  "flex w-[7.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white";

const CARD_BTN =
  "!mt-1 !rounded-xl !px-1 !py-1.5 !text-[10px] !leading-none !shadow-none enabled:active:!translate-y-0";

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
        <article className={CARD_SHELL} style={{ height: "9.5rem" }}>
          <div className="flex h-[46%] items-center justify-center rounded-t-2xl bg-[#FF9600]">
            <Plus className="h-8 w-8 text-white" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1.5 pt-1.5">
            <p className="line-clamp-2 min-h-0 flex-1 text-center text-[11px] font-extrabold leading-tight tracking-tight text-zinc-900">
              {tx("投票を作る", "Create vote")}
            </p>
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
          <article key={ev.id} className={CARD_SHELL} style={{ height: "9.5rem" }}>
            <div className="flex h-[46%] items-center justify-center rounded-t-2xl bg-[#FF9600]">
              <Vote className="h-8 w-8 text-white" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1.5 pt-1.5">
              <p className="line-clamp-2 min-h-0 flex-1 text-center text-[11px] font-extrabold leading-tight tracking-tight text-zinc-900">
                {ev.title}
              </p>
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
