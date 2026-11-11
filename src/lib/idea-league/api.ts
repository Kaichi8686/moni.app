import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRelationError } from "@/lib/contest/demo";
import { reviewIdeaWithAi } from "@/lib/idea-league/aiReview";
import {
  castLocalVote,
  completeLocalTutorial,
  finalizeLocalWeek,
  getTutorialPrompt,
  loadLocalBattle,
  loadLocalProfile,
  saveLocalPromptFromSeed,
  submitLocalIdea,
} from "@/lib/idea-league/localStore";
import { leagueNow, saturdayWeekKey, saturdayWindow, scheduleFor } from "@/lib/idea-league/calendar";
import { promptForWeek } from "@/lib/idea-league/prompts";
import {
  LEAGUE_TIER_META,
  PROMOTION_SLOTS,
  nextLeagueTier,
  parseLeagueTier,
} from "@/lib/idea-league/tiers";
import type {
  LeagueBattleState,
  LeagueMember,
  LeagueProfileState,
  LeagueSubmission,
  LeagueTutorialResult,
  LeagueWeek,
} from "@/lib/idea-league/types";
import { mergeEarnedBadges, type EarnedBadge } from "@/lib/gamification/badges";

export { getTutorialPrompt, PROMOTION_SLOTS };

export type MeIdentity = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

async function loadProfileRow(
  client: SupabaseClient,
  userId: string,
): Promise<{
  tier: string;
  tutorialCompletedAt: string | null;
  promotions: number;
  highlight: boolean;
  badges: EarnedBadge[];
} | null> {
  const { data, error } = await client
    .from("profiles")
    .select("idea_league_tier, idea_league_tutorial_completed_at, idea_league_promotions, idea_league_highlight, badges")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    // column missing → local
    if ((error.message ?? "").includes("idea_league")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const badgesRaw = row.badges;
  let badges: EarnedBadge[] = [];
  if (Array.isArray(badgesRaw)) {
    badges = badgesRaw
      .filter((b): b is { id: string; earned_at: string } => Boolean(b && typeof b === "object" && "id" in b))
      .map((b) => ({ id: String(b.id), earned_at: String(b.earned_at) }));
  }
  return {
    tier: String(row.idea_league_tier ?? "bronze"),
    tutorialCompletedAt: (row.idea_league_tutorial_completed_at as string | null) ?? null,
    promotions: Number(row.idea_league_promotions ?? 0),
    highlight: Boolean(row.idea_league_highlight),
    badges,
  };
}

export async function loadLeagueProfile(
  client: SupabaseClient | null,
  userId: string,
): Promise<LeagueProfileState> {
  if (!client) return loadLocalProfile(userId);
  try {
    const row = await loadProfileRow(client, userId);
    if (!row) return loadLocalProfile(userId);

    const { data: hist, error: histErr } = await client
      .from("idea_league_memberships")
      .select("vote_score, rank, result_status, tier, week_id, idea_league_weeks(week_key, prompt_title, ends_at)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(12);

    if (histErr && isMissingRelationError(histErr)) return loadLocalProfile(userId);

    const history =
      (hist ?? []).map((r) => {
        const rowR = r as Record<string, unknown>;
        const week = rowR.idea_league_weeks as Record<string, unknown> | null;
        return {
          weekKey: String(week?.week_key ?? ""),
          promptTitle: String(week?.prompt_title ?? ""),
          tier: parseLeagueTier(rowR.tier),
          rank: (rowR.rank as number | null) ?? null,
          voteScore: Number(rowR.vote_score ?? 0),
          resultStatus: (rowR.result_status as LeagueProfileState["history"][0]["resultStatus"]) ?? "pending",
          endedAt: String(week?.ends_at ?? ""),
        };
      }) ?? [];

    return {
      userId,
      tier: parseLeagueTier(row.tier),
      tutorialCompleted: Boolean(row.tutorialCompletedAt) || loadLocalProfile(userId).tutorialCompleted,
      promotions: row.promotions,
      highlight: row.highlight,
      history,
    };
  } catch {
    return loadLocalProfile(userId);
  }
}

export async function completeTutorial(
  client: SupabaseClient | null,
  me: MeIdentity,
  input: { title: string; content: string },
): Promise<LeagueTutorialResult> {
  const local = completeLocalTutorial(me.userId, {
    title: input.title,
    content: input.content,
    displayName: me.displayName,
  });
  if (!client) return local;

  try {
    await client.from("idea_league_tutorial_runs").upsert(
      {
        user_id: me.userId,
        title: input.title,
        content: input.content,
        mock_rank: local.mockRank,
        completed_at: local.completedAt,
      },
      { onConflict: "user_id" },
    );
    await client
      .from("profiles")
      .update({ idea_league_tutorial_completed_at: local.completedAt })
      .eq("id", me.userId);

    // grant bronze league badge
    const row = await loadProfileRow(client, me.userId);
    if (row) {
      const nextBadges = mergeEarnedBadges(row.badges, [LEAGUE_TIER_META.bronze.badgeId]);
      await client.from("profiles").update({ badges: nextBadges }).eq("id", me.userId);
    }
  } catch {
    /* local already saved */
  }
  return local;
}

async function ensureRemoteWeek(
  client: SupabaseClient,
  weekKey: string,
): Promise<LeagueWeek | null> {
  const { data: existing, error } = await client
    .from("idea_league_weeks")
    .select("id, week_key, prompt_title, prompt_body, starts_at, ends_at, status")
    .eq("week_key", weekKey)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (existing) {
    const r = existing as Record<string, unknown>;
    return {
      id: String(r.id),
      weekKey: String(r.week_key),
      promptTitle: String(r.prompt_title),
      promptBody: String(r.prompt_body),
      startsAt: String(r.starts_at),
      endsAt: String(r.ends_at),
      status: (r.status as LeagueWeek["status"]) ?? "active",
    };
  }
  const prompt = promptForWeek(weekKey);
  const { startsAt, endsAt } = saturdayWindow(weekKey);
  const sched = scheduleFor(leagueNow());
  const status =
    sched.weekKey === weekKey && (sched.phase === "submit" || sched.phase === "vote")
      ? "active"
      : "upcoming";
  const { data: created, error: createErr } = await client
    .from("idea_league_weeks")
    .insert({
      week_key: weekKey,
      prompt_title: prompt.title,
      prompt_body: prompt.body,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status,
    })
    .select("id, week_key, prompt_title, prompt_body, starts_at, ends_at, status")
    .single();
  if (createErr) {
    if (isMissingRelationError(createErr)) return null;
    // race: fetch again
    const { data: again } = await client
      .from("idea_league_weeks")
      .select("id, week_key, prompt_title, prompt_body, starts_at, ends_at, status")
      .eq("week_key", weekKey)
      .maybeSingle();
    if (!again) return null;
    const r = again as Record<string, unknown>;
    return {
      id: String(r.id),
      weekKey: String(r.week_key),
      promptTitle: String(r.prompt_title),
      promptBody: String(r.prompt_body),
      startsAt: String(r.starts_at),
      endsAt: String(r.ends_at),
      status: (r.status as LeagueWeek["status"]) ?? "active",
    };
  }
  const r = created as Record<string, unknown>;
  return {
    id: String(r.id),
    weekKey: String(r.week_key),
    promptTitle: String(r.prompt_title),
    promptBody: String(r.prompt_body),
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    status: (r.status as LeagueWeek["status"]) ?? "active",
  };
}

export async function loadLeagueBattle(
  client: SupabaseClient | null,
  me: MeIdentity,
): Promise<LeagueBattleState> {
  if (!client) return loadLocalBattle(me);
  try {
    const profile = await loadLeagueProfile(client, me.userId);
    const weekKey = saturdayWeekKey(leagueNow());
    const week = await ensureRemoteWeek(client, weekKey);
    if (!week) return loadLocalBattle(me);

    // find or create membership/group
    let { data: membership } = await client
      .from("idea_league_memberships")
      .select("id, group_id, tier, vote_score, rank, promoted, result_status")
      .eq("week_id", week.id)
      .eq("user_id", me.userId)
      .maybeSingle();

    if (!membership) {
      let { data: group } = await client
        .from("idea_league_groups")
        .select("id")
        .eq("week_id", week.id)
        .eq("tier", profile.tier)
        .eq("group_index", 0)
        .maybeSingle();
      if (!group) {
        const { data: createdGroup, error: gErr } = await client
          .from("idea_league_groups")
          .insert({ week_id: week.id, tier: profile.tier, group_index: 0 })
          .select("id")
          .single();
        if (gErr) return loadLocalBattle(me);
        group = createdGroup;
      }
      const { data: createdMem, error: mErr } = await client
        .from("idea_league_memberships")
        .insert({
          week_id: week.id,
          group_id: (group as { id: string }).id,
          user_id: me.userId,
          tier: profile.tier,
        })
        .select("id, group_id, tier, vote_score, rank, promoted, result_status")
        .single();
      if (mErr) return loadLocalBattle(me);
      membership = createdMem;
    }

    const mem = membership as Record<string, unknown>;
    const groupId = String(mem.group_id);

    const { data: memRows } = await client
      .from("idea_league_memberships")
      .select("id, user_id, tier, vote_score, rank, promoted, result_status")
      .eq("group_id", groupId);

    const userIds = (memRows ?? []).map((r) => String((r as Record<string, unknown>).user_id));
    const { data: profiles } = await client
      .from("profiles")
      .select("id, display_name, username, avatar_url, idea_league_highlight")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map(
      (profiles ?? []).map((p) => {
        const row = p as Record<string, unknown>;
        return [
          String(row.id),
          {
            name: String(row.display_name || row.username || "Player"),
            avatar: (row.avatar_url as string | null) ?? null,
            highlight: Boolean(row.idea_league_highlight),
          },
        ] as const;
      }),
    );

    const { data: subs } = await client
      .from("idea_league_submissions")
      .select("id, user_id, membership_id, title, content, appeal, vote_count")
      .eq("group_id", groupId);

    const { data: myVote } = await client
      .from("idea_league_votes")
      .select("submission_id")
      .eq("week_id", week.id)
      .eq("voter_id", me.userId)
      .maybeSingle();

    const subByUser = new Map(
      (subs ?? []).map((s) => {
        const row = s as Record<string, unknown>;
        return [String(row.user_id), row] as const;
      }),
    );

    const scored = [...(memRows ?? [])]
      .map((r) => {
        const row = r as Record<string, unknown>;
        const uid = String(row.user_id);
        const sub = subByUser.get(uid);
        return {
          row,
          uid,
          score: Number(sub?.vote_count ?? row.vote_score ?? 0),
        };
      })
      .sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));

    const members: LeagueMember[] = scored.map((s, i) => {
      const rank = i + 1;
      const meta = profileMap.get(s.uid);
      return {
        id: String(s.row.id),
        userId: s.uid,
        displayName: meta?.name ?? "Player",
        avatarUrl: meta?.avatar ?? null,
        tier: parseLeagueTier(s.row.tier),
        voteScore: s.score,
        rank,
        promoted: rank <= PROMOTION_SLOTS,
        resultStatus: rank <= PROMOTION_SLOTS ? "promoted" : "stayed",
        hasSubmission: subByUser.has(s.uid),
        isMe: s.uid === me.userId,
        highlighted: Boolean(meta?.highlight),
      };
    });

    const sched = scheduleFor(leagueNow());
    const peersHidden = sched.phase === "submit";

    const myVoteSubmissionId =
      myVote && (myVote as { submission_id?: string }).submission_id
        ? String((myVote as { submission_id: string }).submission_id)
        : null;

    const inJudgment = sched.phase === "vote" || sched.phase === "results";
    const submissions: LeagueSubmission[] = (subs ?? [])
      .map((s) => {
        const row = s as Record<string, unknown>;
        const uid = String(row.user_id);
        const meta = profileMap.get(uid);
        const title = String(row.title);
        const content = String(row.content);
        const appeal = (row.appeal as string | null) ?? null;
        const aiReview = inJudgment
          ? reviewIdeaWithAi({ title, content, appeal })
          : null;
        return {
          id: String(row.id),
          userId: uid,
          membershipId: String(row.membership_id),
          title,
          content,
          appeal,
          voteCount: aiReview ? aiReview.score : Number(row.vote_count ?? 0),
          votedByMe: myVoteSubmissionId === String(row.id),
          authorName: meta?.name ?? "Player",
          authorAvatarUrl: meta?.avatar ?? null,
          isMe: uid === me.userId,
          highlighted: Boolean(meta?.highlight),
          aiReview,
        };
      })
      .filter((s) => (peersHidden ? s.isMe : true))
      .sort((a, b) => b.voteCount - a.voteCount);

    // Mirror AI 勝ち点 onto memberships for ranking during the bootstrap phase.
    const scoredMembers = inJudgment
      ? [...members]
          .map((m) => {
            const sub = submissions.find((s) => s.userId === m.userId);
            return sub?.aiReview ? { ...m, voteScore: sub.aiReview.score } : m;
          })
          .sort((a, b) => {
            if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
            return a.id.localeCompare(b.id);
          })
          .map((m, i) => ({
            ...m,
            rank: i + 1,
            promoted: i + 1 <= PROMOTION_SLOTS,
            resultStatus: (i + 1 <= PROMOTION_SLOTS ? "promoted" : "stayed") as LeagueMember["resultStatus"],
          }))
      : members;

    return {
      week,
      tier: profile.tier,
      groupId,
      members: peersHidden ? scoredMembers.filter((m) => m.isMe) : scoredMembers,
      submissions,
      myMembershipId: String(mem.id),
      mySubmission: submissions.find((s) => s.isMe) ?? null,
      myVoteSubmissionId,
      promotionCutoff: PROMOTION_SLOTS,
      demo: false,
      phase: sched.phase,
      peersHidden,
      displayResultsWeekKey: sched.displayResultsWeekKey,
      seedPlantId: null,
    };
  } catch {
    return loadLocalBattle(me);
  }
}

export async function saveLeaguePromptFromSeed(
  client: SupabaseClient | null,
  me: MeIdentity,
  input: { plantId: string; title: string; body: string },
): Promise<LeagueBattleState> {
  const local = saveLocalPromptFromSeed(me, input);
  if (!client) return local;
  try {
    const weekKey = saturdayWeekKey(leagueNow());
    const week = await ensureRemoteWeek(client, weekKey);
    if (!week) return local;
    await client
      .from("idea_league_weeks")
      .update({
        prompt_title: input.title.trim().slice(0, 80),
        prompt_body: input.body.trim(),
      })
      .eq("id", week.id);
    return loadLeagueBattle(client, me);
  } catch {
    return local;
  }
}

export async function submitLeagueIdea(
  client: SupabaseClient | null,
  me: MeIdentity,
  input: { title: string; content: string; appeal?: string },
): Promise<LeagueBattleState> {
  if (!client) return submitLocalIdea(me, input);
  try {
    const battle = await loadLeagueBattle(client, me);
    if (battle.demo) return submitLocalIdea(me, input);
    if (!battle.myMembershipId) return submitLocalIdea(me, input);

    const payload = {
      week_id: battle.week.id,
      group_id: battle.groupId,
      membership_id: battle.myMembershipId,
      user_id: me.userId,
      title: input.title.trim().slice(0, 40),
      content: input.content.trim(),
      appeal: input.appeal?.trim().slice(0, 140) || null,
    };

    if (battle.mySubmission) {
      await client
        .from("idea_league_submissions")
        .update({ title: payload.title, content: payload.content, appeal: payload.appeal })
        .eq("id", battle.mySubmission.id);
    } else {
      await client.from("idea_league_submissions").insert(payload);
    }
    return loadLeagueBattle(client, me);
  } catch {
    return submitLocalIdea(me, input);
  }
}

export async function castLeagueVote(
  client: SupabaseClient | null,
  me: MeIdentity,
  submissionId: string,
): Promise<LeagueBattleState> {
  if (!client) return castLocalVote(me, submissionId);
  try {
    const battle = await loadLeagueBattle(client, me);
    if (battle.demo) return castLocalVote(me, submissionId);
    const target = battle.submissions.find((s) => s.id === submissionId);
    if (!target || target.isMe) return battle;

    // one vote per week: replace
    await client.from("idea_league_votes").delete().eq("week_id", battle.week.id).eq("voter_id", me.userId);
    await client.from("idea_league_votes").insert({
      week_id: battle.week.id,
      group_id: battle.groupId,
      submission_id: submissionId,
      voter_id: me.userId,
    });
    return loadLeagueBattle(client, me);
  } catch {
    return castLocalVote(me, submissionId);
  }
}

export async function finalizeLeagueIfNeeded(
  client: SupabaseClient | null,
  me: MeIdentity,
): Promise<LeagueProfileState> {
  const sched = scheduleFor(leagueNow());
  if (sched.phase !== "results") return loadLeagueProfile(client, me.userId);
  const local = finalizeLocalWeek(me.userId);
  if (!client) return local;
  try {
    const battle = await loadLeagueBattle(client, me);
    if (battle.demo) return local;

    const meMember = battle.members.find((m) => m.isMe);
    if (!meMember) return loadLeagueProfile(client, me.userId);

    const promoted = meMember.rank <= PROMOTION_SLOTS;
    const toTier = promoted ? nextLeagueTier(battle.tier) ?? battle.tier : battle.tier;

    await client
      .from("idea_league_memberships")
      .update({
        rank: meMember.rank,
        vote_score: meMember.voteScore,
        promoted,
        result_status: promoted ? "promoted" : "stayed",
      })
      .eq("id", meMember.id);

    if (promoted && toTier !== battle.tier) {
      const row = await loadProfileRow(client, me.userId);
      const badgeId = LEAGUE_TIER_META[toTier].badgeId;
      const nextBadges = mergeEarnedBadges(row?.badges ?? [], [badgeId]);
      await client
        .from("profiles")
        .update({
          idea_league_tier: toTier,
          idea_league_promotions: (row?.promotions ?? 0) + 1,
          idea_league_highlight: true,
          badges: nextBadges,
        })
        .eq("id", me.userId);
      await client.from("idea_league_promotions").insert({
        user_id: me.userId,
        week_id: battle.week.id,
        from_tier: battle.tier,
        to_tier: toTier,
        final_rank: meMember.rank,
      });
    }

    await client.from("idea_league_weeks").update({ status: "ended" }).eq("id", battle.week.id);
    return loadLeagueProfile(client, me.userId);
  } catch {
    return local;
  }
}
