"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

const GOAL_STUCK_CLASS = "moni-goal-stuck";

/**
 * ゴールをヘッダー下で sticky 固定。張り付いたら html.moni-goal-stuck を立て、
 * ヘッダーは CSS でスッと退避する。
 */
export function StickyBelowWorkspaceHeader({ children, className = "" }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | null = null;
    let frame = 0;

    const headerOffsetPx = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--project-workspace-header-offset")
        .trim();
      if (raw.endsWith("rem")) return parseFloat(raw) * 16;
      if (raw.endsWith("px")) return parseFloat(raw);
      const header = document.querySelector(".project-workspace-header");
      return header instanceof HTMLElement ? header.offsetHeight : 60;
    };

    const applyStuck = (next: boolean) => {
      setStuck(next);
      document.documentElement.classList.toggle(GOAL_STUCK_CLASS, next);
    };

    const connect = () => {
      observer?.disconnect();
      const topInset = Math.max(1, Math.round(headerOffsetPx() + 8));
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          // センチネルがヘッダー下端より上に出たら張り付き中
          applyStuck(!entry.isIntersecting && entry.boundingClientRect.bottom < topInset + 1);
        },
        {
          root: null,
          threshold: 0,
          rootMargin: `-${topInset}px 0px 0px 0px`,
        },
      );
      observer.observe(sentinel);
    };

    connect();

    const onResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        connect();
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      document.documentElement.classList.remove(GOAL_STUCK_CLASS);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="pointer-events-none h-px w-full" aria-hidden />
      <div
        className={`sticky z-[90] mb-4 ${className}`.trim()}
        style={{
          top: stuck
            ? "max(0.5rem, env(safe-area-inset-top, 0px))"
            : "calc(var(--project-workspace-header-offset, 3.75rem) + 8px)",
          transition: "top 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
      </div>
    </>
  );
}
