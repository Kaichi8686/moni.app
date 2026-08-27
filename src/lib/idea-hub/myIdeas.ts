import { supabase } from "@/lib/supabase";
import type { MyIdea, MyIdeaInsert } from "@/lib/idea-hub/types";

export async function requireUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function listMyIdeas(): Promise<{ ideas: MyIdea[]; error: string | null }> {
  if (!supabase) return { ideas: [], error: "Supabase未接続です" };
  const userId = await requireUserId();
  if (!userId) return { ideas: [], error: "login_required" };

  const { data, error } = await supabase
    .from("my_ideas")
    .select("id,user_id,title,memo,source,seed_id,theme,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ideas: [], error: error.message };
  return { ideas: (data ?? []) as MyIdea[], error: null };
}

export async function createMyIdea(
  input: MyIdeaInsert,
): Promise<{ idea: MyIdea | null; error: string | null }> {
  if (!supabase) return { idea: null, error: "Supabase未接続です" };
  const userId = await requireUserId();
  if (!userId) return { idea: null, error: "login_required" };

  const title = input.title.trim();
  if (!title) return { idea: null, error: "タイトルを入力してください" };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("my_ideas")
    .insert({
      user_id: userId,
      title,
      memo: (input.memo ?? "").trim(),
      source: input.source ?? "manual",
      seed_id: input.seed_id ?? null,
      theme: input.theme ?? null,
      updated_at: now,
    })
    .select("id,user_id,title,memo,source,seed_id,theme,created_at,updated_at")
    .single();

  if (error) return { idea: null, error: error.message };
  return { idea: data as MyIdea, error: null };
}

export async function deleteMyIdea(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase未接続です" };
  const userId = await requireUserId();
  if (!userId) return { error: "login_required" };

  const { error } = await supabase.from("my_ideas").delete().eq("id", id).eq("user_id", userId);
  return { error: error?.message ?? null };
}
