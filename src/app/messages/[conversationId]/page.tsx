import { Suspense } from "react";
import { ConversationView } from "@/app/messages/_components/ConversationView";
import { ConversationSkeleton } from "@/components/ui/Skeleton";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden">
      <Suspense fallback={<ConversationSkeleton />}>
        <ConversationView conversationId={conversationId} />
      </Suspense>
    </div>
  );
}
