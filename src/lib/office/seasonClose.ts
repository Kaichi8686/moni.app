import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isFirstSeasonForCompany,
  isTokyoMonthStart,
  previousSeasonKey,
  seasonKeyFor,
} from "@/lib/office/season";
import {
  nextOfficeLeague,
  prevOfficeLeague,
  promotionDemotionSlots,
  parseOfficeLeagueId,
} from "@/lib/office/tiers";
import type { OfficeLeagueId, SeasonResult } from "@/lib/office/types";
import { OFFICE_LEAGUE_ORDER } from "@/lib/office/constants";

/**
 * JST 毎月1日 0:00 相当（cron は毎日 15:00 UTC）に前月シーズンを締める。
 * 冪等: office_season_closures で二重締め防止。
 */
export async function runSeasonClose(
  admin: SupabaseClient,
  now: Date = new Date(),
  opts?: { forceSeasonKey?: string },
): Promise<{ ok: true; closed: string | null; detail: string } | { ok: false; detail: string }> {
  const target = opts?.forceSeasonKey ?? (isTokyoMonthStart(now) ? previousSeasonKey(now) : null);
  if (!target) {
    return { ok: true, closed: null, detail: "not month-start in Asia/Tokyo; skipped" };
  }

  const { data: existing } = await admin
    .from("office_season_closures")
    .select("season_key")
    .eq("season_key", target)
    .maybeSingle();
  if (existing) {
    return { ok: true, closed: target, detail: "already closed" };
  }

  const { error: lockErr } = await admin.from("office_season_closures").insert({ season_key: target });
  if (lockErr) {
    // unique violation → already closed
    return { ok: true, closed: target, detail: `lock: ${lockErr.message}` };
  }

  for (const leagueId of OFFICE_LEAGUE_ORDER) {
    await closeLeague(admin, target, leagueId);
  }

  // 新シーズン行はログイン時 ensure で作成。ここでは触らない（total_revenue も触らない）
  void seasonKeyFor(now);
  return { ok: true, closed: target, detail: "closed" };
}

async function closeLeague(admin: SupabaseClient, seasonKey: string, leagueId: OfficeLeagueId) {
  const { data: rows } = await admin
    .from("office_season_scores")
    .select("id, user_id, revenue, office_companies!inner(id, league_id, ranking_enabled, created_at)")
    .eq("season_key", seasonKey)
    .eq("league_id", leagueId)
    .eq("office_companies.ranking_enabled", true)
    .order("revenue", { ascending: false });

  const list = (rows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      user_id: string;
      revenue: number;
      office_companies:
        | { id: string; league_id: string; ranking_enabled: boolean; created_at: string }
        | Array<{ id: string; league_id: string; ranking_enabled: boolean; created_at: string }>;
    };
    const co = Array.isArray(r.office_companies) ? r.office_companies[0]! : r.office_companies;
    return {
      id: r.id,
      userId: r.user_id,
      revenue: Number(r.revenue ?? 0),
      createdAt: co.created_at,
      leagueId: parseOfficeLeagueId(co.league_id),
    };
  });

  list.sort((a, b) => b.revenue - a.revenue || a.userId.localeCompare(b.userId));
  const { promote, demote } = promotionDemotionSlots(list.length);

  for (let i = 0; i < list.length; i++) {
    const row = list[i]!;
    const rank = i + 1;
    let result: SeasonResult = "stayed";
    let nextLeague: OfficeLeagueId = leagueId;

    const inPromote = i < promote;
    const inDemote = i >= list.length - demote && demote > 0;

    if (inPromote) {
      const up = nextOfficeLeague(leagueId);
      if (up) {
        result = "promoted";
        nextLeague = up;
      }
    } else if (inDemote) {
      const down = prevOfficeLeague(leagueId);
      const firstMonthRookie =
        leagueId === "rookie" && isFirstSeasonForCompany(row.createdAt, seasonKey);
      // 最下位は降格なし。新人リーグの参加初月も降格なし
      if (down && leagueId !== "rookie" && !firstMonthRookie) {
        result = "demoted";
        nextLeague = down;
      }
    }

    await admin
      .from("office_season_scores")
      .update({ rank, result, result_seen: false })
      .eq("id", row.id);

    if (nextLeague !== leagueId) {
      await admin.from("office_companies").update({ league_id: nextLeague }).eq("user_id", row.userId);
    }
  }
}
