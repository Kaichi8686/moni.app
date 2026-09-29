"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Reader = { id: string; displayName: string; avatarUrl?: string | null };

type Props = {
  readers: Reader[];
};

/** 自分のメッセージに対する既読表示（文字のみ） */
export function ReadReceipt({ readers }: Props) {
  const { tx } = useI18n();
  if (readers.length === 0) return null;

  return (
    <span className="text-[11px] font-medium text-zinc-400" aria-label={tx("既読", "Read")}>
      {tx("既読", "Read")}
    </span>
  );
}
