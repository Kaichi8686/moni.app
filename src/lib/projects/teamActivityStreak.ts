import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeCoachingContext, parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";

/** Asia/Tokyo の暦日キー YYYY-MM-DD */
export function todayKeyJapan(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** この瞬間を含む暦週の月曜 00:00（Asia/Tokyo）を epoch ms で返す */
export function startOfWeekMondayJapanMs(now = new Date()): number {
  const ymd = todayKeyJapan(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const daysFromMonday = (wd + 6) % 7;
  const monday = new Date(Date.UTC(y, m - 1, d));
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  const my = monday.getUTCFullYear();
  const mm = monday.getUTCMonth() + 1;
  const md = monday.getUTCDate();
  return new Date(`${my}-${pad2(mm)}-${pad2(md)}T00:00:00+09:00`).getTime();
}

/** タスク完了などチーム活動があった日に 1 日 1 回だけ適用するパッチ */
export function computeTeamStreakPatch(prev: CoachingContext): Partial<CoachingContext> {
  const today = todayKeyJapan();
  const lastRaw = prev.teamActivityLastDate?.trim();
  const cur =
    typeof prev.teamActivityStreak === "number" && Number.isFinite(prev.teamActivityStreak) && prev.teamActivityStreak >= 0
      ? Math.floor(prev.teamActivityStreak)
      : 0;

  if (!lastRaw || !/^\d{4}-\d{2}-\d{2}$/.test(lastRaw)) {
    return { teamActivityLastDate: today, teamActivityStreak: 1 };
  }
  if (lastRaw === today) return {};

  const [ty, tm, td] = today.split("-").map(Number);
  const [ly, lm, ld] = lastRaw.split("-").map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const lastUtc = Date.UTC(ly, lm - 1, ld);
  const diffDays = Math.round((todayUtc - lastUtc) / 86400000);

  if (diffDays === 1) return { teamActivityLastDate: today, teamActivityStreak: cur + 1 };
  return { teamActivityLastDate: today, teamActivityStreak: 1 };
}

export type BumpTeamActivityStreakResult = {
  changed: boolean;
  prevStreak: number;
  newStreak: number;
};

export async function bumpTeamActivityStreak(
  client: SupabaseClient,
  projectId: string,
): Promise<BumpTeamActivityStreakResult | null> {
  const { data, error } = await client.from("projects").select("coaching_context").eq("id", projectId).maybeSingle();
  if (error || !data) return null;
  const prev = parseCoachingContext((data as { coaching_context?: unknown }).coaching_context);
  const prevStreak =
    typeof prev.teamActivityStreak === "number" && Number.isFinite(prev.teamActivityStreak) && prev.teamActivityStreak >= 0
      ? Math.floor(prev.teamActivityStreak)
      : 0;
  const delta = computeTeamStreakPatch(prev);
  if (Object.keys(delta).length === 0) {
    return { changed: false, prevStreak, newStreak: prevStreak };
  }
  const next = mergeCoachingContext(prev, delta);
  const newStreak =
    typeof next.teamActivityStreak === "number" && Number.isFinite(next.teamActivityStreak) && next.teamActivityStreak >= 0
      ? Math.floor(next.teamActivityStreak)
      : prevStreak;
  await client.from("projects").update({ coaching_context: next, updated_at: new Date().toISOString() }).eq("id", projectId);
  return { changed: true, prevStreak, newStreak };
}
