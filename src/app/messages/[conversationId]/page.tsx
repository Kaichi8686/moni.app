import { Suspense } from "react";
import { ConversationView } from "@/app/messages/_components/ConversationView";
import { ConversationSkeleton } from "@/components/ui/Skeleton";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <Suspense fallback={<ConversationSkeleton />}>
        <ConversationView conversationId={conversationId} />
      </Suspense>
    </div>
  );
}
