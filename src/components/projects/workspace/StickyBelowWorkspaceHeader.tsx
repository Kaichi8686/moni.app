"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * プロジェクト名・通知ヘッダーの下に、ブラウザ標準の sticky で自然にくっつく。
 * JS で毎フレーム動かさない（下の方にいるときからガタつく原因だった）。
 */
export function StickyBelowWorkspaceHeader({ children, className = "" }: Props) {
  return (
    <div
      className={`sticky z-[90] mb-4 ${className}`.trim()}
      style={{ top: "calc(var(--project-workspace-header-offset, 3.75rem) + 8px)" }}
    >
      {children}
    </div>
  );
}
