"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * プロジェクト名・通知ヘッダーの下に、ブラウザ標準の sticky で自然にくっつく。
 */
export function StickyBelowWorkspaceHeader({ children, className = "" }: Props) {
  return (
    <div
      /* シート類(z-80+)より下。ヘッダー(z-100)より下。ページ本文より上 */
      className={`sticky z-20 mb-4 ${className}`.trim()}
      style={{ top: "calc(var(--project-workspace-header-offset, 3.75rem) + 8px)" }}
    >
      {children}
    </div>
  );
}
