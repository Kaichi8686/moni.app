import { ConversationView } from "@/app/messages/_components/ConversationView";

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <ConversationView conversationId={conversationId} />
    </div>
  );
}
