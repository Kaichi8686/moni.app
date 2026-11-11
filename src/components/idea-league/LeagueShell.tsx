"use client";

import type { ReactNode } from "react";

/** Shared league page frame: narrow on mobile, wide two-column on desktop. */
export function LeagueShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-[4.75rem] lg:self-start">{sidebar}</aside>
        <div className="min-w-0 space-y-4 sm:space-y-5">{children}</div>
      </div>
    </div>
  );
}

export const leagueCardClass =
  "rounded-2xl border border-orange-200/70 bg-white/95 p-4 shadow-[0_8px_24px_rgba(255,150,0,0.06)] sm:p-5";
