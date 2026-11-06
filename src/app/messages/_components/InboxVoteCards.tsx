"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  VoteEventCreateForm,
  type VoteEventCreateInput,
} from "@/components/projects/idea-voting/VoteEventCreateForm";
import { createIdea, createVoteEvent, fetchEvents, type IdeaVoteEventWithCount } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { isVoteEventClosed } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
};

const CARD_SHELL =
  "flex w-[7.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_0_#D97706]";

function localDatetimeToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** プロジェクトメッセージ: 検索欄と名前一覧のあいだに置く縦長の投票カード */
export function InboxVoteCards({ projectId }: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const [events, setEvents] = useState<IdeaVoteEventWithCount[]>([]);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");

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

  async function handleCreate(input: VoteEventCreateInput) {
    if (!supabase) return;
    setBusy(true);
    setCreateError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error(tx("ログインが必要です", "Please sign in"));

      const created = await createVoteEvent(projectId, uid, {
        title: input.title,
        description: input.description,
        closesAt: localDatetimeToIso(input.closesAt),
        anonymous: input.anonymous,
        votesPerPerson: input.votesPerPerson,
        maxVotesPerIdea: input.maxVotesPerIdea,
      });

      const author = input.anonymous ? null : tx("メンバー", "Member");
      for (const text of input.options) {
        try {
          await createIdea(projectId, uid, text, author, created.id);
        } catch (e) {
          console.warn("createIdea", e);
        }
      }

      setCreateOpen(false);
      router.push(`/projects/${projectId}/ideas?event=${encodeURIComponent(created.id)}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : tx("作成に失敗しました", "Couldn’t create"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <>
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
                onClick={() => {
                  setCreateError("");
                  setCreateOpen(true);
                }}
                className="!mt-1 !rounded-xl !px-1 !py-1.5 !text-[10px] !leading-none"
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
                  className="!mt-1 !rounded-xl !px-1 !py-1.5 !text-[10px] !leading-none"
                >
                  {tx("投票する", "Vote")}
                </DuoButton>
              </div>
            </article>
          ))}
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onClick={() => {
            if (!busy) setCreateOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tx("投票を作る", "Create vote")}
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {createError ? (
              <p className="mb-2 rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">
                {createError}
              </p>
            ) : null}
            <VoteEventCreateForm
              busy={busy}
              onCancel={() => {
                if (!busy) setCreateOpen(false);
              }}
              onSubmit={(input) => void handleCreate(input)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
