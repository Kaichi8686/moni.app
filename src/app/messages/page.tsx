import { Suspense } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { InboxList } from "@/app/messages/_components/InboxList";
import { InboxListSkeleton } from "@/components/ui/Skeleton";

export default function MessagesPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="absolute inset-0 overflow-y-auto bg-[#fafaf8]">
            <div className="border-b border-zinc-100 px-4 py-2">
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            </div>
            <InboxListSkeleton />
          </div>
        }
      >
        <InboxList />
      </Suspense>
      <AppBottomNav />
    </>
  );
}
