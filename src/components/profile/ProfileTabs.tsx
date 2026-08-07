"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** 投稿グリッドのみ（タグ付きタブは廃止） */
export function ProfileTabs({ children }: Props) {
  return <div>{children}</div>;
}
