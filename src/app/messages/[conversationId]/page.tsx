import { Suspense } from "react";
import { ConversationView } from "@/app/messages/_components/ConversationView";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">読み込み中...</div>
        }
      >
        <ConversationView conversationId={conversationId} />
      </Suspense>
    </div>
  );
}
