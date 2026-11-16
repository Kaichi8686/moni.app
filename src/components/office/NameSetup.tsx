"use client";

import { useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  OFFICE_ABOUT_MAX,
  OFFICE_ABOUT_MIN,
  OFFICE_NAME_MAX,
} from "@/lib/office/constants";

type Props = {
  busy: boolean;
  error?: string;
  /** 説明補完モード：既存の会社名を固定表示 */
  existingName?: string | null;
  onSubmit: (payload: { name: string; about: string }) => void;
};

export function NameSetup({ busy, error, existingName, onSubmit }: Props) {
  const patchMode = Boolean(existingName);
  const [name, setName] = useState(existingName ?? "");
  const [about, setAbout] = useState("");

  const aboutOk = about.trim().length >= OFFICE_ABOUT_MIN && about.trim().length <= OFFICE_ABOUT_MAX;
  const canSubmit =
    !busy &&
    aboutOk &&
    (patchMode || (name.trim().length >= 1 && name.trim().length <= OFFICE_NAME_MAX));

  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-8 sm:px-6">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF9600]">
        Office
      </p>
      <h1 className="mt-2 text-center font-[family-name:var(--font-instrument-serif)] text-3xl tracking-tight text-zinc-900">
        {patchMode ? "会社を説明しよう" : "会社をつくろう"}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
        {patchMode
          ? `『${existingName}』はどんな会社？短く書いてね。あとからは変えられないよ。`
          : "会社名と、どんな会社かの説明を書こう。説明はあとから変えられないよ。"}
      </p>

      {!patchMode ? (
        <label className="mt-8 block">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-zinc-600">会社名</span>
            <span className="text-[11px] tabular-nums text-zinc-400">
              {name.length}/{OFFICE_NAME_MAX}
            </span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, OFFICE_NAME_MAX))}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
            placeholder="例: 放課後ラボ"
            autoFocus
          />
        </label>
      ) : (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-[11px] font-medium text-zinc-500">会社名</p>
          <p className="mt-0.5 text-base font-bold text-zinc-900">{existingName}</p>
        </div>
      )}

      <label className="mt-6 block">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-zinc-600">会社の説明</span>
          <span className="text-[11px] tabular-nums text-zinc-400">
            {about.length}/{OFFICE_ABOUT_MAX}
          </span>
        </div>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value.slice(0, OFFICE_ABOUT_MAX))}
          rows={4}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none ring-[#FF9600] focus:ring-2"
          placeholder="例: 文化祭向けにスマホ注文アプリを作る部活チーム"
          autoFocus={patchMode}
        />
        <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
          {OFFICE_ABOUT_MIN}〜{OFFICE_ABOUT_MAX}字。何を・誰に・どう届けるかを書くと事件が合いやすいよ。
        </p>
      </label>

      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="mt-5">
        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={() => {
            if (!aboutOk) return;
            onSubmit({
              name: patchMode ? (existingName ?? "").trim() : name.trim(),
              about: about.trim(),
            });
          }}
        >
          {busy ? "準備中…" : patchMode ? "説明を決める" : "会社を始める"}
        </DuoButton>
      </div>
    </div>
  );
}
