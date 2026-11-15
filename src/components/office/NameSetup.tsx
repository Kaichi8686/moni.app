"use client";

import { useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";

type Props = {
  busy: boolean;
  error?: string;
  onSubmit: (name: string) => void;
};

export function NameSetup({ busy, error, onSubmit }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-8">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF9600]">
        Office
      </p>
      <h1 className="mt-2 text-center font-[family-name:var(--font-instrument-serif)] text-3xl tracking-tight text-zinc-900">
        きみの会社、なににする？
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
        会社名は自分で決めよう。あとから変えられないから、好きな名前でスタートしてね。
      </p>
      <label className="mt-8 block">
        <span className="text-xs font-bold text-zinc-600">会社名（40字以内）</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
          placeholder="例: 放課後スナック研究所"
          autoFocus
        />
      </label>
      {error ? <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="mt-5">
        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={busy || name.trim().length < 1}
          onClick={() => onSubmit(name.trim())}
        >
          {busy ? "作成中…" : "会社をはじめる"}
        </DuoButton>
      </div>
    </div>
  );
}
