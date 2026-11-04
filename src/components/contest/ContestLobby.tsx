"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Lightbulb, RefreshCw } from "lucide-react";
import { daysLeft, loadContestLobby, type ContestLobbyItem } from "@/lib/contest/api";
import { DEMO_CONTEST, DEMO_CONTEST_SECONDARY } from "@/lib/contest/demo";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

const DEMO_LOBBY_ITEMS: ContestLobbyItem[] = [
  { ...DEMO_CONTEST, ideaCount: 3 },
  { ...DEMO_CONTEST_SECONDARY, ideaCount: 1 },
];

type LobbyFilter = "active" | "ended";

type Props = {
  onEnter: (contestId: string) => void;
  /** 発表CTA。先頭の開催中コンテストへ投稿フローで入室 */
  onCreate?: (contestId: string) => void;
};

function categoryGlyph(category: string): string {
  if (category === "habits") return "H";
  if (category === "school") return "S";
  if (category === "work") return "W";
  return "I";
}

export function ContestLobby({ onEnter, onCreate }: Props) {
  const { tx } = useI18n();
  const [filter, setFilter] = useState<LobbyFilter>("active");
  const [items, setItems] = useState<ContestLobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const reload = useCallback(async (next: LobbyFilter) => {
    if (!supabase || !supabaseEnabled) {
      setItems(next === "ended" ? [] : DEMO_LOBBY_ITEMS);
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
    <div className="relative min-h-[calc(100dvh-7rem)] bg-zinc-50 pb-28">
      <div className="mx-auto max-w-lg px-4 pt-3">
        <div className="mb-4 flex items-center gap-2">
          <div
            role="tablist"
            aria-label={tx("コンテストの状態", "Contest status")}
            className="grid flex-1 grid-cols-2 rounded-lg border border-zinc-200 bg-white p-0.5"
          >
            {(
              [
                ["active", tx("開催中", "Live")],
                ["ended", tx("終了", "Ended")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={`min-h-9 rounded-md text-[13px] font-medium tracking-tight transition ${
                  filter === id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800"
            aria-label={tx("更新", "Refresh")}
            onClick={() => void reload(filter)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {err ? <p className="mb-2 text-sm text-rose-600">{err}</p> : null}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[4.75rem] animate-pulse rounded-xl border border-zinc-200 bg-white" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-14 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {filter === "ended"
                ? tx("終了したコンテストはまだありません", "No ended contests yet")
                : tx("開催中のコンテストはまだありません", "No live contests yet")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((c) => {
              const left = daysLeft(c.endAt);
              const live = c.status === "active" && left > 0;
              return (
                <li key={c.id}>
                  <article className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:border-zinc-300">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] font-semibold tracking-wide text-zinc-600"
                      aria-hidden
                    >
                      {categoryGlyph(c.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-zinc-900">
                        {c.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-zinc-300"}`}
                            aria-hidden
                          />
                          {live ? tx("開催中", "Live") : tx("終了", "Ended")}
                        </span>
                        {live ? (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock3 className="h-3 w-3" aria-hidden />
                            {tx(`${left}日`, `${left}d`)}
                          </span>
                        ) : null}
                        <span className="tabular-nums">
                          {c.ideaCount}
                          {tx("件", "")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnter(c.id)}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      {tx("入室", "Enter")}
                      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-clearance)+0.5rem)] z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-lg">
          <button
            type="button"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[13px] font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={items.length === 0}
            onClick={() => {
              const first = items[0];
              if (!first) return;
              if (onCreate) onCreate(first.id);
              else onEnter(first.id);
            }}
          >
            <Lightbulb className="h-4 w-4" aria-hidden />
            {tx("発表する", "Share")}
          </button>
        </div>
      </div>
    </div>
  );
}
