"use client";

import { useState } from "react";
import { ExploreFriendProfilePreview } from "@/components/explore/ExploreFriendProfilePreview";

const DEMO_MEMBER = {
  id: "demo-friend-preview",
  name: "Danny",
  goal: "新しい仲間と一緒にプロダクトをつくりたい",
  strength: "デザイン",
  avatarUrl:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  skills: ["プログラミング", "デザイン", "動画編集"],
  interestFields: ["AI・機械学習", "ゲーム", "起業・ビジネス"],
  traits: ["好奇心旺盛", "リーダーシップ", "やさしい"],
};

const DEMO_PROJECTS = [
  {
    id: "p1",
    name: "週末ハッカソンチーム",
    description:
      "【きっかけ】\n学生が短期間でアイデアを形にしづらい\n\n【ゴール】\n2週間で動くプロトタイプを完成させる\n\n【すること】\n週末に集まってデザインと実装を進める",
    visibility: "public",
  },
  {
    id: "p2",
    name: "地域マップ改善",
    description:
      "【きっかけ】\nまち歩きのルートが分かりにくい\n\n【ゴール】\n誰でも使える地域マップを公開する\n\n【すること】\n現地調査とUI改善をくり返す",
    visibility: "public",
  },
];

export function FriendPreviewDevClient() {
  const [open, setOpen] = useState(true);
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <main className="min-h-dvh bg-zinc-100 p-6">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">Friend preview QA</h1>
        <button
          type="button"
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
          onClick={() => setOpen(true)}
        >
          Open preview
        </button>
      </div>
      {open ? (
        <ExploreFriendProfilePreview
          member={DEMO_MEMBER}
          projects={DEMO_PROJECTS}
          projectsLoading={false}
          isFollowing={following}
          isPending={pending}
          onClose={() => setOpen(false)}
          onToggleFollow={() => {
            if (following) {
              setFollowing(false);
              setPending(false);
              return;
            }
            if (pending) {
              setPending(false);
              setFollowing(true);
              return;
            }
            // 公開アカウント想定: 1タップでフォロー（メッセージボタン出現）
            setFollowing(true);
          }}
        />
      ) : null}
    </main>
  );
}
