import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyBookEntry, MyBookEntryInput, MyBookMood } from "@/lib/mybook/types";

const LOCAL_KEY = (userId: string) => `moni-mybook-${userId}`;

function mapRow(r: Record<string, unknown>): MyBookEntry {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    entryDate: String(r.entry_date).slice(0, 10),
    title: (r.title as string) ?? "",
    body: (r.body as string) ?? "",
    mood: (r.mood as MyBookMood) ?? null,
    isPrivate: Boolean(r.is_private ?? true),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42703" || /does not exist/i.test(error.message ?? "");
}

function readLocal(userId: string): MyBookEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MyBookEntry[];
    return Array.isArray(parsed) ? parsed.sort(byEntryDateAsc) : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, entries: MyBookEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(entries.slice(0, 400)));
}

function byEntryDateAsc(a: MyBookEntry, b: MyBookEntry): number {
  return a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt);
}

export async function loadMyBookEntries(client: SupabaseClient, userId: string): Promise<MyBookEntry[]> {
  const { data, error } = await client
    .from("my_book_entries")
    .select("id,user_id,entry_date,title,body,mood,is_private,created_at,updated_at")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true })
    .limit(400);

  if (error) {
    if (isMissingTable(error)) return readLocal(userId);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>)).sort(byEntryDateAsc);
}

export async function saveMyBookEntry(
  client: SupabaseClient,
  userId: string,
  input: MyBookEntryInput,
): Promise<MyBookEntry> {
  const entryDate = assertMyBookDateNotFuture(input.entryDate);
  const payload = {
    user_id: userId,
    entry_date: entryDate,
    title: input.title.trim(),
    body: input.body.trim(),
    mood: input.mood ?? null,
    is_private: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("my_book_entries")
    .upsert(payload, { onConflict: "user_id,entry_date" })
    .select("id,user_id,entry_date,title,body,mood,is_private,created_at,updated_at")
    .single();

  if (error) {
    if (isMissingTable(error)) {
      const now = new Date().toISOString();
      const entries = readLocal(userId);
      const existing = entries.find((e) => e.entryDate === entryDate);
      const next: MyBookEntry = existing
        ? {
            ...existing,
            title: payload.title,
            body: payload.body,
            mood: payload.mood as MyBookMood,
            updatedAt: now,
          }
        : {
            id: `local-${entryDate}-${Date.now()}`,
            userId,
            entryDate,
            title: payload.title,
            body: payload.body,
            mood: payload.mood as MyBookMood,
            isPrivate: true,
            createdAt: now,
            updatedAt: now,
          };
      const merged = [next, ...entries.filter((e) => e.entryDate !== entryDate)].sort(byEntryDateAsc);
      writeLocal(userId, merged);
      return next;
    }
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function deleteMyBookEntry(
  client: SupabaseClient,
  userId: string,
  entryId: string,
): Promise<void> {
  const { error } = await client.from("my_book_entries").delete().eq("id", entryId).eq("user_id", userId);
  if (error) {
    if (isMissingTable(error)) {
      writeLocal(
        userId,
        readLocal(userId).filter((e) => e.id !== entryId),
      );
      return;
    }
    throw new Error(error.message);
  }
}

export function todayKeyJapan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export function clampMyBookDate(dateKey: string): string {
  const today = todayKeyJapan();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return today;
  return dateKey > today ? today : dateKey;
}

export function assertMyBookDateNotFuture(dateKey: string): string {
  const clamped = clampMyBookDate(dateKey);
  if (clamped !== dateKey) {
    throw new Error("未来の日付では書けません。今日か、過去の日付を選んでください。");
  }
  return dateKey;
}

export function formatBookDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  } catch {
    return dateKey;
  }
}
