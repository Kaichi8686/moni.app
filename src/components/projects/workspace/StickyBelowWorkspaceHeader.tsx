"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * プロジェクト名・通知ヘッダーの下に、スクロールに合わせて自然にくっつく。
 * relative ↔ fixed の切替だとカクつくので、常に fixed + translateY で追従し、
 * ヘッダー下端でクランプする（CSS sticky 相当の滑らかさ）。
 */
export function StickyBelowWorkspaceHeader({ children, className = "" }: Props) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const placeholder = placeholderRef.current;
    const shell = shellRef.current;
    if (!placeholder || !shell) return;

    let frame = 0;

    const headerBottomPx = () => {
      const header = document.querySelector(".project-workspace-header");
      if (header) return header.getBoundingClientRect().bottom;
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--project-workspace-header-offset")
        .trim();
      if (raw.endsWith("rem")) return parseFloat(raw) * 16;
      if (raw.endsWith("px")) return parseFloat(raw);
      return 60;
    };

    const sync = () => {
      frame = 0;
      const column = placeholder.closest(".max-w-3xl");
      const colRect = (column ?? placeholder.parentElement)?.getBoundingClientRect();
      if (!colRect) return;

      const pinnedTop = headerBottomPx() + 8;
      const naturalTop = placeholder.getBoundingClientRect().top;
      const offsetY = Math.max(0, naturalTop - pinnedTop);

      placeholder.style.height = `${shell.offsetHeight}px`;
      shell.style.left = `${colRect.left}px`;
      shell.style.width = `${colRect.width}px`;
      shell.style.top = `${pinnedTop}px`;
      shell.style.transform = `translate3d(0, ${offsetY}px, 0)`;
      shell.style.zIndex = offsetY === 0 ? "90" : "40";
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const ro = new ResizeObserver(onScrollOrResize);
    ro.observe(shell);
    const column = placeholder.closest(".max-w-3xl");
    if (column) ro.observe(column);
    const header = document.querySelector(".project-workspace-header");
    if (header) ro.observe(header);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={placeholderRef} className="mb-4" aria-hidden />
      <div
        ref={shellRef}
        className={`fixed z-[40] will-change-transform ${className}`.trim()}
        style={{ top: 0, left: 0, width: "100%" }}
      >
        {children}
      </div>
    </>
  );
}
