import { Suspense } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { InboxList } from "@/app/messages/_components/InboxList";

export default function MessagesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">読み込み中...</div>
        }
      >
        <InboxList />
      </Suspense>
      <AppBottomNav />
    </div>
  );
}
