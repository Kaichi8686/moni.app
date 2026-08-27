import { ConversationView } from "@/app/messages/_components/ConversationView";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationView conversationId={conversationId} />
    </div>
  );
}
