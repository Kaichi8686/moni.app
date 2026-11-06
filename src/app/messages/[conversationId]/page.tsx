import { ConversationView } from "@/app/messages/_components/ConversationView";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <ConversationView conversationId={conversationId} />
    </div>
  );
}
