"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Filter } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { daysLeft, loadContestLobby, type ContestLobbyItem } from "@/lib/contest/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

type LobbyFilter = "active" | "ended";

type Props = {
  onEnter: (contestId: string) => void;
  /** 発表CTA。先頭の開催中コンテストへ投稿フローで入室 */
  onCreate?: (contestId: string) => void;
};

function categoryEmoji(category: string): string {
  if (category === "habits") return "📱";
  if (category === "school") return "📚";
  if (category === "work") return "💼";
  return "💡";
}

export function ContestLobby({ onEnter, onCreate }: Props) {
  const { tx } = useI18n();
  const [filter, setFilter] = useState<LobbyFilter>("active");
  const [items, setItems] = useState<ContestLobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const reload = useCallback(async (next: LobbyFilter) => {
    if (!supabase || !supabaseEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const { items: rows } = await loadContestLobby(supabase, next);
      setItems(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(filter);
  }, [filter, reload]);

  return (
    <div className="relative min-h-[calc(100dvh-7rem)] bg-gradient-to-b from-[#FFF8EF] via-[#F7F4FF] to-[#EEF8FF] pb-28">
      <div className="mx-auto max-w-lg px-4 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-white/80 p-1 shadow-[var(--shadow-sm)] ring-1 ring-zinc-200/70">
            {(
              [
                ["active", tx("開催中", "Live")],
                ["ended", tx("終了", "Ended")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`min-h-11 rounded-xl text-sm font-extrabold tracking-tight transition ${
                  filter === id
                    ? "bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1 rounded-xl bg-white/80 px-3 text-xs font-bold text-zinc-600 shadow-[var(--shadow-sm)] ring-1 ring-zinc-200/70"
            aria-label={tx("絞り込み", "Filter")}
            onClick={() => void reload(filter)}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            {tx("更新", "Refresh")}
          </button>
        </div>

        {err ? <p className="mb-2 text-sm text-rose-600">{err}</p> : null}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-zinc-700">
              {filter === "ended"
                ? tx("終了したコンテストはまだありません", "No ended contests yet")
                : tx("開催中のコンテストはまだありません", "No live contests yet")}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((c) => {
              const left = daysLeft(c.endAt);
              const live = c.status === "active" && left > 0;
              return (
                <li key={c.id}>
                  <article className="flex items-stretch gap-3 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-[var(--shadow-sm)] ring-1 ring-zinc-100">
                    <div
                      className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF3D6] to-[#EEF0FF] text-3xl shadow-inner"
                      aria-hidden
                    >
                      {categoryEmoji(c.category)}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <h3 className="line-clamp-2 text-[14px] font-extrabold leading-snug tracking-tight text-zinc-900">
                        {c.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            live ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {live ? tx("開催中", "Live") : tx("終了", "Ended")}
                        </span>
                        {live ? (
                          <span className="text-[11px] font-semibold text-orange-600">
                            {tx(`残り ${left}日`, `${left}d left`)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-zinc-500">
                        {tx("投稿", "Posts")}{" "}
                        <span className="font-extrabold text-[#FF9600]">{c.ideaCount}</span>
                        {tx("件", "")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => onEnter(c.id)}
                        className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl bg-[#34C759] px-3 text-[13px] font-extrabold text-white shadow-[0_3px_0_#248A3D] transition active:translate-y-[3px] active:shadow-none"
                      >
                        {tx("入室", "Enter")}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-clearance)+0.5rem)] z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-lg">
          <DuoButton
            type="button"
            fullWidth
            size="lg"
            className="gap-2 shadow-lg"
            onClick={() => {
              const first = items[0];
              if (!first) return;
              if (onCreate) onCreate(first.id);
              else onEnter(first.id);
            }}
          >
            <Lightbulb className="h-4 w-4" aria-hidden />
            {tx("アイデアを発表する", "Share an idea")}
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
