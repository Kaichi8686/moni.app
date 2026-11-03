"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "green" | "orange" | "gold" | "sky" | "zinc";
type Size = "md" | "lg" | "xl";

/**
 * 面は一色。奥行き用の下縁だけ同系の暗色（緑の二色見え問題を避ける）。
 * オレンジは moni / Duolingo 風。
 */
const TONES: Record<Tone, { face: string; edge: string }> = {
  green: { face: "bg-[#FF5C35]", edge: "bg-[#C2410C]" },
  orange: { face: "bg-[#FF5C35]", edge: "bg-[#C2410C]" },
  gold: { face: "bg-[#FF5C35]", edge: "bg-[#C2410C]" },
  sky: { face: "bg-[#1CB0F6]", edge: "bg-[#0B7FB5]" },
  zinc: { face: "bg-zinc-100", edge: "bg-zinc-300" },
};

const SIZES: Record<Size, { outer: string; face: string; text: string; edgeTop: string }> = {
  md: { outer: "px-6 py-3.5", face: "px-1 py-0.5", text: "text-[16px]", edgeTop: "top-[6px]" },
  lg: { outer: "px-7 py-5", face: "px-2 py-1.5", text: "text-[18px]", edgeTop: "top-[7px]" },
  xl: { outer: "px-8 py-7", face: "px-3 py-2.5", text: "text-[22px]", edgeTop: "top-[8px]" },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
};

/** Duolingo 風の立体ボタン（オレンジ基調） */
export function DuoButton({
  tone = "orange",
  size = "md",
  children,
  fullWidth,
  className = "",
  disabled,
  ...rest
}: Props) {
  const colors = TONES[tone];
  const sizing = SIZES[size];
  const textColor = tone === "zinc" ? "text-[#3C3C3C]" : "text-white";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative isolate inline-flex select-none items-center justify-center font-extrabold tracking-tight transition enabled:active:translate-y-[4px] enabled:active:[&>span:first-child]:opacity-0 disabled:cursor-not-allowed disabled:opacity-45 ${sizing.outer} ${sizing.text} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {/* 奥行き用の下縁（同系の暗いオレンジ） */}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 ${sizing.edgeTop} rounded-2xl ${colors.edge}`}
      />
      <span
        className={`relative block w-full rounded-2xl text-center shadow-[0_1px_0_rgba(255,255,255,0.25)_inset] ${sizing.face} ${colors.face} ${textColor}`}
      >
        {children}
      </span>
    </button>
  );
}
