import { createIdea, createVoteEvent, fetchEvents, LEGACY_EVENT_ID } from "@/lib/projects/ideaVoting/ideaVotingApi";
import { isVoteEventClosed } from "@/lib/projects/ideaVoting/types";

/** AIが出したアイデアを投票一覧に追加。追加件数を返す。 */
export async function appendIdeasToVoting(
  projectId: string,
  items: Array<{ title: string; pitch?: string; first_step?: string }>,
): Promise<number> {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) throw new Error("Supabase が未設定です。");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("ログインが必要です。");

  const events = await fetchEvents(projectId);
  let eventId = events.find((e) => e.id !== LEGACY_EVENT_ID && !isVoteEventClosed(e))?.id;
  if (!eventId) {
    const created = await createVoteEvent(projectId, uid, {
      title: "AIの提案",
      description: "相談AIから追加された選択肢",
      anonymous: true,
    });
    eventId = created.id;
  }

  let added = 0;
  for (const item of items) {
    const title = item.title.trim();
    if (!title) continue;
    const extra = [item.pitch, item.first_step ? `最初の一歩: ${item.first_step}` : ""].filter(Boolean).join("\n");
    const body = extra ? `${title}\n${extra}` : title;
    await createIdea(projectId, uid, body, null, eventId);
    added += 1;
  }
  return added;
}
