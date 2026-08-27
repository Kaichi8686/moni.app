"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export type SettingsItem = {
  icon: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  color: string;
  type?: "toggle" | "link";
  onClick?: () => void;
  toggle?: React.ReactNode;
};

type Props = {
  item: SettingsItem;
  isLast: boolean;
};

export function SettingsRow({ item, isLast }: Props) {
  const inner = (
    <>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${item.color}1A` }}
      >
        <item.icon className="h-4 w-4" style={{ color: item.color }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug text-zinc-900">{item.label}</p>
        {item.description ? (
          <p className="mt-0.5 text-sm leading-snug text-zinc-600">{item.description}</p>
        ) : null}
      </div>
      {item.type === "toggle" && item.toggle ? (
        item.toggle
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
      )}
    </>
  );

  const rowClass = `settings-card-row flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 ${
    !isLast ? "border-b border-zinc-200" : ""
  }`;

  if (item.href) {
    return (
      <Link href={item.href} className={rowClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={item.onClick} className={rowClass}>
      {inner}
    </button>
  );
}
