import type { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  /** Sticky/mobile header wrappers that already provide padding */
  bare?: boolean;
};

/**
 * Instagram-style top bar: side actions + centered moni wordmark.
 */
export function AppBrandHeader({ left, right, className, bare }: Props) {
  return (
    <header
      className={
        bare
          ? `relative flex items-center justify-between gap-2 ${className ?? ""}`.trim()
          : `relative flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 bg-white px-4 py-2.5 sm:px-5 ${className ?? ""}`.trim()
      }
    >
      <div className="z-10 flex min-h-11 min-w-0 flex-1 items-center justify-start gap-1.5">
        {left ?? <span className="inline-block w-11" aria-hidden />}
      </div>
      <h1 className="moni-wordmark pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[1.75rem] leading-none sm:text-[1.9rem]">
        moni
      </h1>
      <div className="z-10 flex min-h-11 min-w-0 flex-1 items-center justify-end gap-1.5">
        {right ?? <span className="inline-block w-11" aria-hidden />}
      </div>
    </header>
  );
}
