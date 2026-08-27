import { supabase } from "@/lib/supabase";
import type { WhiteboardElement } from "@/lib/projects/whiteboard/types";

type DbRow = {
  id: string;
  board_id: string;
  element_type: string;
  payload: Record<string, unknown>;
  updated_at: string;
};

function rowToElement(row: DbRow): WhiteboardElement | null {
  const type = row.element_type;
  if (type !== "pen" && type !== "note" && type !== "text" && type !== "shape") return null;
  return {
    id: row.id,
    boardId: row.board_id,
    type,
    payload: row.payload as WhiteboardElement["payload"],
    updatedAt: row.updated_at,
  };
}

export async function ensureProjectBoard(projectId: string, uid: string): Promise<string> {
  if (!supabase) throw new Error("Supabase が未設定です。");

  const { data: existing } = await supabase
    .from("project_boards")
    .select("id")
    .eq("project_id", projectId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("project_boards")
    .insert({ project_id: projectId, title: "ホワイトボード", created_by: uid })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(error?.message ?? "ボードの作成に失敗しました。");
  return data.id as string;
}

export async function loadBoardElements(boardId: string): Promise<WhiteboardElement[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("project_board_elements")
    .select("id, board_id, element_type, payload, updated_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r) => rowToElement(r as DbRow))
    .filter((x): x is WhiteboardElement => x !== null);
}

export async function insertBoardElement(
  boardId: string,
  uid: string,
  element: Pick<WhiteboardElement, "type" | "payload">,
  /** Undo/Redo で同じ id を復元したい場合に指定 */
  explicitId?: string,
): Promise<WhiteboardElement> {
  if (!supabase) throw new Error("Supabase が未設定です。");

  const insertRow: Record<string, unknown> = {
    board_id: boardId,
    element_type: element.type,
    payload: element.payload,
    created_by: uid,
    updated_by: uid,
  };
  if (explicitId) insertRow.id = explicitId;

  const { data, error } = await supabase
    .from("project_board_elements")
    .insert(insertRow)
    .select("id, board_id, element_type, payload, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "保存に失敗しました。");
  const mapped = rowToElement(data as DbRow);
  if (!mapped) throw new Error("要素の読み込みに失敗しました。");
  return mapped;
}

export async function updateBoardElement(
  id: string,
  uid: string,
  payload: WhiteboardElement["payload"],
): Promise<void> {
  if (!supabase) throw new Error("Supabase が未設定です。");

  const { error } = await supabase
    .from("project_board_elements")
    .update({ payload, updated_by: uid, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteBoardElement(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase が未設定です。");
  const { error } = await supabase.from("project_board_elements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
