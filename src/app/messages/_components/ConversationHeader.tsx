"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  title: string;
  subtitle?: string;
  onTitleClick?: () => void;
};

export function ConversationHeader({ title, subtitle, onTitleClick }: Props) {
  const { tx } = useI18n();
  const titleEl = (
    <>
      <h1 className="truncate text-base font-semibold text-zinc-900">{title}</h1>
      {subtitle ? <p className="truncate text-xs text-zinc-500">{subtitle}</p> : null}
    </>
  );

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-2 py-2.5">
      <Link
        href="/messages"
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
        aria-label={tx("戻る", "Back")}
      >
        <ChevronLeft className="h-6 w-6" />
      </Link>
      {onTitleClick ? (
        <button type="button" onClick={onTitleClick} className="min-w-0 flex-1 text-left">
          {titleEl}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{titleEl}</div>
      )}
    </header>
  );
}
