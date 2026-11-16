"use client";

import { useState } from "react";
import { LeaveProjectDialog } from "@/components/projects/workspace/LeaveProjectDialog";
import type { Member } from "@/lib/workspace/types";

const DEMO_MEMBERS: Member[] = [
  { id: "owner-1", name: "アンパンマン", role: "owner" },
  { id: "m1", name: "Kaichi8686", role: "member" },
  { id: "m2", name: "カイチ", role: "member" },
  { id: "m3", name: "さくら", role: "member" },
  { id: "m4", name: "たろう", role: "member" },
  { id: "m5", name: "みお", role: "member" },
  { id: "m6", name: "ゆうき", role: "member" },
  { id: "m7", name: "はな", role: "member" },
  { id: "m8", name: "りく", role: "member" },
  { id: "m9", name: "あおい", role: "member" },
  { id: "m10", name: "そら", role: "member" },
];

export function LeaveDialogDevClient() {
  const [open, setOpen] = useState(true);

  return (
    <main className="relative min-h-dvh bg-zinc-200">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1534796636912-3b95b772ab17?auto=format&fit=crop&w=1400&q=60)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <button
          type="button"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow"
          onClick={() => setOpen(true)}
        >
          脱退ダイアログを開く
        </button>
      </div>
      <LeaveProjectDialog
        open={open}
        projectId="00000000-0000-4000-8000-000000000001"
        isOwner
        members={DEMO_MEMBERS}
        currentUserId="owner-1"
        onClose={() => setOpen(false)}
      />
    </main>
  );
}
