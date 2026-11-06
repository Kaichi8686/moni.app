import { Suspense } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { InboxList } from "@/app/messages/_components/InboxList";

export default function MessagesPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">読み込み中...</div>
        }
      >
        <InboxList />
      </Suspense>
      <AppBottomNav />
    </>
  );
}
