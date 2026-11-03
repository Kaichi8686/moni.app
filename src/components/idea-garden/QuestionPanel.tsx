"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";

type Props = {
  title: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  buttonLabel: string;
  onSubmit: () => void;
  multiline?: boolean;
  maxLength?: number;
};

export function QuestionPanel({
  title,
  hint,
  value,
  onChange,
  placeholder,
  buttonLabel,
  onSubmit,
  multiline = true,
  maxLength = 500,
}: Props) {
  const can = value.trim().length > 0;

  return (
    <div className="flex h-full min-h-[100dvh] flex-col bg-gradient-to-b from-[#E8F8FF] via-[#F7FFF0] to-[#FFF8E7] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <h1 className="mt-6 text-center text-[22px] font-extrabold leading-snug tracking-tight text-[#3C3C3C]">
          {title}
        </h1>
        {hint ? (
          <p className="mt-2 text-center text-[13px] font-semibold text-[#777]">{hint}</p>
        ) : null}

        <div className="mt-8 flex-1">
          {multiline ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
              placeholder={placeholder}
              rows={7}
              className="w-full resize-none rounded-3xl border-[3px] border-[#E5E5E5] bg-white px-4 py-4 text-[16px] font-semibold leading-relaxed text-[#3C3C3C] outline-none placeholder:text-zinc-300 focus:border-[#58CC02]"
            />
          ) : (
            <input
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
              placeholder={placeholder}
              className="w-full rounded-3xl border-[3px] border-[#E5E5E5] bg-white px-4 py-4 text-[16px] font-semibold text-[#3C3C3C] outline-none placeholder:text-zinc-300 focus:border-[#58CC02]"
            />
          )}
        </div>

        <DuoButton
          tone="orange"
          fullWidth
          disabled={!can}
          onClick={onSubmit}
          className="mt-4"
        >
          {buttonLabel}
        </DuoButton>
      </div>
    </div>
  );
}
