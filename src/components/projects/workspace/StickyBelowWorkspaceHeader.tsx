"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * プロジェクト名・通知ヘッダーの下に、所定位置を過ぎたら張り付く。
 * 祖先の overflow-x-hidden で CSS sticky が効かないため、
 * スクロール位置を見て fixed に切り替える。
 */
export function StickyBelowWorkspaceHeader({ children, className = "" }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [placeholderH, setPlaceholderH] = useState(0);
  const [fixedStyle, setFixedStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const sentinel = sentinelRef.current;
    const shell = shellRef.current;
    if (!sentinel || !shell) return;

    const sync = () => {
      const header = document.querySelector(".project-workspace-header");
      const headerBottom = header
        ? header.getBoundingClientRect().bottom
        : (() => {
            const raw = getComputedStyle(document.documentElement)
              .getPropertyValue("--project-workspace-header-offset")
              .trim();
            if (raw.endsWith("rem")) return parseFloat(raw) * 16;
            if (raw.endsWith("px")) return parseFloat(raw);
            return 60;
          })();

      const sentTop = sentinel.getBoundingClientRect().top;
      const nextStuck = sentTop <= headerBottom + 0.5;
      setStuck(nextStuck);
      setPlaceholderH(shell.offsetHeight);

      const column = sentinel.closest(".max-w-3xl");
      const colRect = (column ?? sentinel.parentElement)?.getBoundingClientRect();
      if (nextStuck && colRect) {
        setFixedStyle({
          // ヘッダーとのわずかな隙間だけ。白い余白バーは付けない
          top: headerBottom + 8,
          left: colRect.left,
          width: colRect.width,
        });
      } else {
        setFixedStyle(null);
      }
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(shell);
    const column = sentinel.closest(".max-w-3xl");
    if (column) ro.observe(column);
    const header = document.querySelector(".project-workspace-header");
    if (header) ro.observe(header);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="pointer-events-none h-0" aria-hidden />
      {stuck ? <div style={{ height: placeholderH }} className="mb-4" aria-hidden /> : null}
      <div
        ref={shellRef}
        className={`${stuck ? "fixed z-[90]" : "relative mb-4"} ${className}`.trim()}
        style={
          stuck && fixedStyle
            ? {
                top: fixedStyle.top,
                left: fixedStyle.left,
                width: fixedStyle.width,
              }
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
