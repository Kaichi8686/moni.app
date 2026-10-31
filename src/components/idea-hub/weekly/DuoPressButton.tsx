"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "green" | "sky" | "orange" | "yellow" | "white" | "red";

const TONE: Record<Tone, { face: string; base: string; text: string }> = {
  green: { face: "bg-[#58CC02]", base: "bg-[#46A302]", text: "text-white" },
  sky: { face: "bg-[#1CB0F6]", base: "bg-[#1899D6]", text: "text-white" },
  orange: { face: "bg-[#FF9600]", base: "bg-[#E08600]", text: "text-white" },
  yellow: { face: "bg-[#FFC800]", base: "bg-[#E5A500]", text: "text-[#3C3C3C]" },
  white: { face: "bg-white", base: "bg-[#E5E5E5]", text: "text-[#1CB0F6]" },
  red: { face: "bg-[#FF4B4B]", base: "bg-[#EA2B2B]", text: "text-white" },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  children: ReactNode;
  fullWidth?: boolean;
};

/** Duolingo-like chunky pressable CTA */
export function DuoPressButton({
  tone = "green",
  children,
  fullWidth,
  className = "",
  disabled,
  ...rest
}: Props) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      className={`group relative isolate inline-flex min-h-[52px] items-center justify-center rounded-[16px] px-6 text-[17px] font-extrabold tracking-wide disabled:cursor-not-allowed disabled:opacity-45 ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...rest}
    >
      <span aria-hidden className={`absolute inset-x-0 bottom-0 top-[5px] rounded-[16px] ${t.base}`} />
      <span
        className={`relative flex min-h-[52px] w-full items-center justify-center rounded-[16px] border-2 border-black/5 px-6 transition-transform duration-100 group-active:translate-y-[4px] group-disabled:translate-y-0 ${t.face} ${t.text}`}
      >
        {children}
      </span>
    </button>
  );
}
