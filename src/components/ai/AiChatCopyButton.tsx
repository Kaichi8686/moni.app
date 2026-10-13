"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  text: string;
  className?: string;
  /** Compact icon-only control for dense bubbles */
  compact?: boolean;
};

export async function copyAiChatText(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Copy control for AI / user chat messages (selection + one-tap copy). */
export function AiChatCopyButton({ text, className = "", compact = false }: Props) {
  const { tx } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          const ok = await copyAiChatText(text);
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        })();
      }}
      className={
        compact
          ? `inline-flex h-8 w-8 items-center justify-center rounded-lg text-current/70 transition hover:bg-black/5 hover:text-current ${className}`
          : `inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-current/70 transition hover:bg-black/5 hover:text-current ${className}`
      }
      aria-label={copied ? tx("コピーしました", "Copied") : tx("テキストをコピー", "Copy text")}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {compact ? null : <span>{copied ? tx("コピー済み", "Copied") : tx("コピー", "Copy")}</span>}
    </button>
  );
}
