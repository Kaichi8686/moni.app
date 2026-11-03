"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "green" | "orange" | "gold" | "sky" | "zinc";
type Size = "md" | "lg" | "xl";

const TONES: Record<Tone, { face: string; edge: string }> = {
  green: { face: "bg-[#58CC02]", edge: "bg-[#46A302]" },
  orange: { face: "bg-[#FF9600]", edge: "bg-[#E08600]" },
  gold: { face: "bg-[#FFC800]", edge: "bg-[#E6A800]" },
  sky: { face: "bg-[#1CB0F6]", edge: "bg-[#1899D6]" },
  zinc: { face: "bg-zinc-200", edge: "bg-zinc-400" },
};

const SIZES: Record<Size, { outer: string; face: string; text: string }> = {
  md: { outer: "px-6 py-3.5", face: "px-1 py-0.5", text: "text-[16px]" },
  lg: { outer: "px-7 py-5", face: "px-2 py-1.5", text: "text-[18px]" },
  xl: { outer: "px-8 py-7", face: "px-3 py-2.5", text: "text-[22px]" },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
};

/** Duolingo 風の立体ボタン */
export function DuoButton({
  tone = "green",
  size = "md",
  children,
  fullWidth,
  className = "",
  disabled,
  ...rest
}: Props) {
  const colors = TONES[tone];
  const sizing = SIZES[size];
  const textColor =
    tone === "zinc" || tone === "gold" ? "text-[#3C3C3C]" : "text-white";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative isolate inline-flex select-none items-center justify-center font-extrabold tracking-tight transition enabled:active:translate-y-[4px] enabled:active:[&>span:first-child]:opacity-0 disabled:cursor-not-allowed disabled:opacity-45 ${sizing.outer} ${sizing.text} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 top-[5px] rounded-2xl ${colors.edge}`}
      />
      <span
        className={`relative block w-full rounded-2xl text-center ${sizing.face} ${colors.face} ${textColor}`}
      >
        {children}
      </span>
    </button>
  );
}
