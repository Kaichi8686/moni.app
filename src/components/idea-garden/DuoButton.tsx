"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "green" | "orange" | "gold" | "sky" | "zinc";
type Size = "md" | "lg" | "xl";

/**
 * Duolingo 型（参考画像どおり）:
 * 上面はフラット一色 / 奥行きはぼかしなしの下帯 box-shadow / 押すと沈む
 */
const TONES: Record<Tone, { face: string; text: string; lip: Record<Size, string> }> = {
  orange: {
    face: "bg-[#FF5C35]",
    text: "text-white",
    lip: {
      md: "shadow-[0_4px_0_#C2410C]",
      lg: "shadow-[0_5px_0_#C2410C]",
      xl: "shadow-[0_6px_0_#C2410C]",
    },
  },
  green: {
    face: "bg-[#FF5C35]",
    text: "text-white",
    lip: {
      md: "shadow-[0_4px_0_#C2410C]",
      lg: "shadow-[0_5px_0_#C2410C]",
      xl: "shadow-[0_6px_0_#C2410C]",
    },
  },
  gold: {
    face: "bg-[#FF5C35]",
    text: "text-white",
    lip: {
      md: "shadow-[0_4px_0_#C2410C]",
      lg: "shadow-[0_5px_0_#C2410C]",
      xl: "shadow-[0_6px_0_#C2410C]",
    },
  },
  sky: {
    face: "bg-[#1CB0F6]",
    text: "text-white",
    lip: {
      md: "shadow-[0_4px_0_#1899D6]",
      lg: "shadow-[0_5px_0_#1899D6]",
      xl: "shadow-[0_6px_0_#1899D6]",
    },
  },
  zinc: {
    face: "bg-[#E5E5E5]",
    text: "text-[#3C3C3C]",
    lip: {
      md: "shadow-[0_4px_0_#AFAFAF]",
      lg: "shadow-[0_5px_0_#AFAFAF]",
      xl: "shadow-[0_6px_0_#AFAFAF]",
    },
  },
};

const SIZES: Record<Size, { pad: string; text: string; radius: string; press: string }> = {
  md: {
    pad: "px-6 py-3.5",
    text: "text-[16px] leading-none",
    radius: "rounded-2xl",
    press: "enabled:active:translate-y-[4px]",
  },
  lg: {
    pad: "px-7 py-5",
    text: "text-[18px] leading-none",
    radius: "rounded-2xl",
    press: "enabled:active:translate-y-[5px]",
  },
  xl: {
    pad: "px-8 py-7",
    text: "text-[22px] leading-none",
    radius: "rounded-[1.25rem]",
    press: "enabled:active:translate-y-[6px]",
  },
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
};

/** Duolingo 風の立体ボタン（参考画像の構造・オレンジ） */
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

  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex select-none items-center justify-center font-extrabold tracking-tight",
        colors.face,
        colors.text,
        colors.lip[size],
        sizing.pad,
        sizing.text,
        sizing.radius,
        sizing.press,
        "transition-[transform,box-shadow] duration-75 ease-out",
        "enabled:active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
