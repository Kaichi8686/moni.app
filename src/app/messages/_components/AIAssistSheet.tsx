"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Mode = "polish" | "translate" | "suggest";

type Props = {
  draft: string;
  context?: string;
  onClose: () => void;
  onApply: (text: string) => void;
};

export function AIAssistSheet({ draft, context, onClose, onApply }: Props) {
  const { tx } = useI18n();
  const [mode, setMode] = useState<Mode>("polish");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, context, mode }),
      });
      const json = (await res.json()) as { result?: string; error?: string };
      if (json.result) setResult(json.result);
      else setResult(json.error ?? tx("失敗しました", "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h2 className="font-semibold">{tx("AI文章補助", "AI writing help")}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 flex gap-2">
          {(
            [
              ["polish", tx("丁寧に", "Polish")],
              ["translate", tx("英訳", "Translate")],
              ["suggest", tx("提案", "Suggest")],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-xs ${mode === m ? "bg-violet-600 text-white" : "bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="mb-3 w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? tx("生成中...", "Generating…") : tx("生成する", "Generate")}
        </button>
        {result ? <div className="mb-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800">{result}</div> : null}
        <button
          type="button"
          disabled={!result}
          onClick={() => {
            onApply(result);
            onClose();
          }}
          className="w-full rounded-xl border border-violet-600 py-2 text-sm font-semibold text-violet-600 disabled:opacity-40"
        >
          {tx("入力欄に反映", "Apply to input")}
        </button>
      </div>
    </div>
  );
}
