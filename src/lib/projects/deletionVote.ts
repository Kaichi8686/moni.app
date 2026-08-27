import { supabase } from "@/lib/supabase";

const PROPOSAL_KIND = "deletion_proposal";
const VOTE_KIND = "deletion_vote";
const PROPOSAL_TITLE = "__project_deletion_proposal__";

export type DeletionProposal = {
  id: string;
  proposedBy: string;
  createdAt: string;
  status: "open" | "cancelled";
};

export type DeletionVote = {
  userId: string;
  approve: boolean;
};

export type DeletionState = {
  proposal: DeletionProposal | null;
  votes: DeletionVote[];
  memberCount: number;
  approveCount: number;
  /** 賛成がメンバーの2/3以上 */
  thresholdMet: boolean;
  myVote: boolean | null;
};

type TaskRow = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  meta: Record<string, unknown> | null;
};

function metaOf(row: TaskRow): Record<string, unknown> {
  return row.meta && typeof row.meta === "object" ? row.meta : {};
}

function requireClient() {
  if (!supabase) throw new Error("Supabase が未設定です。");
  return supabase;
}

export async function fetchDeletionState(projectId: string, uid: string | null): Promise<DeletionState> {
  const client = requireClient();
  const [{ data: members }, { data: tasks }] = await Promise.all([
    client.from("project_members").select("user_id").eq("project_id", projectId),
    client
      .from("project_tasks")
      .select("id,title,created_by,created_at,meta")
      .eq("project_id", projectId)
      .limit(500),
  ]);

  const memberCount = (members ?? []).length || 1;
  const rows = (tasks as TaskRow[] | null) ?? [];
  const proposalRow = rows.find((r) => metaOf(r).kind === PROPOSAL_KIND && metaOf(r).status !== "cancelled");
  const proposal: DeletionProposal | null = proposalRow
    ? {
        id: proposalRow.id,
        proposedBy: proposalRow.created_by,
        createdAt: proposalRow.created_at,
        status: "open",
      }
    : null;

  const votes: DeletionVote[] = rows
    .filter((r) => metaOf(r).kind === VOTE_KIND && metaOf(r).proposalId === proposal?.id)
    .map((r) => ({
      userId: r.created_by,
      approve: Boolean(metaOf(r).approve),
    }));

  const approveCount = votes.filter((v) => v.approve).length;
  const threshold = Math.ceil((memberCount * 2) / 3);
  const myVote = uid ? (votes.find((v) => v.userId === uid)?.approve ?? null) : null;

  return {
    proposal,
    votes,
    memberCount,
    approveCount,
    thresholdMet: Boolean(proposal) && approveCount >= threshold,
    myVote,
  };
}

export async function proposeDeletion(projectId: string, uid: string): Promise<void> {
  const client = requireClient();
  const state = await fetchDeletionState(projectId, uid);
  if (state.proposal) return;
  const { error } = await client.from("project_tasks").insert({
    project_id: projectId,
    title: PROPOSAL_TITLE,
    description: "project deletion proposal",
    status: "done",
    priority: "high",
    created_by: uid,
    ai_generated: false,
    meta: { kind: PROPOSAL_KIND, status: "open" },
  });
  if (error) throw new Error(error.message);
}

export async function cancelDeletionProposal(proposalId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("project_tasks")
    .update({
      meta: { kind: PROPOSAL_KIND, status: "cancelled" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
}

export async function castDeletionVote(
  projectId: string,
  proposalId: string,
  uid: string,
  approve: boolean,
): Promise<void> {
  const client = requireClient();
  const { data: existing } = await client
    .from("project_tasks")
    .select("id,meta,created_by")
    .eq("project_id", projectId)
    .contains("meta", { kind: VOTE_KIND, proposalId })
    .eq("created_by", uid)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("project_tasks")
      .update({
        meta: { kind: VOTE_KIND, proposalId, approve },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("project_tasks").insert({
    project_id: projectId,
    title: `__deletion_vote__:${proposalId.slice(0, 8)}`,
    description: "",
    status: "done",
    priority: "low",
    created_by: uid,
    ai_generated: false,
    meta: { kind: VOTE_KIND, proposalId, approve },
  });
  if (error) throw new Error(error.message);
}
