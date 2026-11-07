import { supabase } from "@/lib/supabase";
import {
  parseIssueWorkFiles,
  serializeIssueWorkFiles,
  type IssueWorkFile,
} from "@/lib/workspace/issueWorkFiles";

export type DmSpaceSnapshot = {
  conversationId: string;
  workFiles: IssueWorkFile[];
  updatedAt: string | null;
};

function requireClient() {
  if (!supabase) throw new Error("Supabase が未設定です。");
  return supabase;
}

export async function loadDmSpace(conversationId: string): Promise<DmSpaceSnapshot> {
  const client = requireClient();
  const { data, error } = await client
    .from("conversation_spaces")
    .select("conversation_id, work_files_json, updated_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    conversationId,
    workFiles: parseIssueWorkFiles(data?.work_files_json),
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
  };
}

export async function saveDmSpaceWorkFiles(
  conversationId: string,
  uid: string,
  files: IssueWorkFile[],
): Promise<IssueWorkFile[]> {
  const client = requireClient();
  const serialized = serializeIssueWorkFiles(files);
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("conversation_spaces")
    .upsert(
      {
        conversation_id: conversationId,
        work_files_json: serialized,
        updated_by: uid,
        updated_at: now,
      },
      { onConflict: "conversation_id" },
    )
    .select("work_files_json")
    .single();
  if (error) throw new Error(error.message);
  return parseIssueWorkFiles(data?.work_files_json);
}

export async function createDmDocument(
  conversationId: string,
  uid: string,
  title: string,
): Promise<{ id: string; title: string; content: string; updated_at: string }> {
  const client = requireClient();
  const { data, error } = await client
    .from("conversation_documents")
    .insert({
      conversation_id: conversationId,
      title,
      content: "",
      updated_by: uid,
    })
    .select("id,title,content,updated_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "ドキュメントの作成に失敗しました。");
  return data as { id: string; title: string; content: string; updated_at: string };
}

export async function loadDmDocument(docId: string): Promise<{
  id: string;
  title: string;
  content: string;
  updated_at: string;
}> {
  const client = requireClient();
  const { data, error } = await client
    .from("conversation_documents")
    .select("id,title,content,updated_at")
    .eq("id", docId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "ドキュメントが見つかりません。");
  return data as { id: string; title: string; content: string; updated_at: string };
}

export async function saveDmDocument(
  docId: string,
  uid: string,
  title: string,
  content: string,
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("conversation_documents")
    .update({
      title,
      content,
      updated_by: uid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);
  if (error) throw new Error(error.message);
}

export async function deleteDmDocument(docId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("conversation_documents").delete().eq("id", docId);
  if (error) throw new Error(error.message);
}

export async function createDmBoard(
  conversationId: string,
  uid: string,
  title: string,
): Promise<{ id: string; title: string; updated_at: string }> {
  const client = requireClient();
  const { data, error } = await client
    .from("conversation_boards")
    .insert({
      conversation_id: conversationId,
      title,
      created_by: uid,
    })
    .select("id,title,updated_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "ボードの作成に失敗しました。");
  return data as { id: string; title: string; updated_at: string };
}

export async function deleteDmBoard(boardId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("conversation_boards").delete().eq("id", boardId);
  if (error) throw new Error(error.message);
}
