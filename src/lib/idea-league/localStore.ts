import { reviewIdeaWithAi } from "@/lib/idea-league/aiReview";
import { scheduleFor, saturdayWeekKey, saturdayWindow, leagueNow } from "@/lib/idea-league/calendar";
import { promptForWeek, TUTORIAL_PROMPT } from "@/lib/idea-league/prompts";
import { PROMOTION_SLOTS, nextLeagueTier, parseLeagueTier } from "@/lib/idea-league/tiers";
import type {
  LeagueAiReview,
  LeagueBattleState,
  LeagueHistoryEntry,
  LeagueMember,
  LeagueProfileState,
  LeagueSubmission,
  LeagueTier,
  LeagueTutorialResult,
  LeagueWeek,
} from "@/lib/idea-league/types";

function isRealUserId(userId: string): boolean {
  return Boolean(userId) && !userId.startsWith("bot-") && !userId.startsWith("bot");
}

const STORAGE_KEY = "moni.ideaLeague.v1";

type StoreShape = {
  profiles: Record<
    string,
    {
      tier: LeagueTier;
      tutorialCompletedAt: string | null;
      promotions: number;
      highlight: boolean;
      tutorial?: LeagueTutorialResult;
      history: LeagueHistoryEntry[];
    }
  >;
  weeks: Record<
    string,
    {
      week: LeagueWeek;
      seedPlantId: string | null;
      authoredByUserId: string | null;
      groups: Record<
        string,
        {
          groupId: string;
          tier: LeagueTier;
          members: Array<{
            membershipId: string;
            userId: string;
            displayName: string;
            avatarUrl: string | null;
            voteScore: number;
            submission?: {
              id: string;
              title: string;
              content: string;
              appeal: string | null;
              aiReview?: LeagueAiReview | null;
            };
          }>;
          votes: Record<string, string>; // voterId -> submissionId
        }
      >;
    }
  >;
};

function emptyStore(): StoreShape {
  return { profiles: {}, weeks: {} };
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.profiles || !parsed.weeks) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function ensureProfile(store: StoreShape, userId: string) {
  if (!store.profiles[userId]) {
    store.profiles[userId] = {
      tier: "bronze",
      tutorialCompletedAt: null,
      promotions: 0,
      highlight: false,
      history: [],
    };
  }
  return store.profiles[userId]!;
}

function ensureWeekGroup(
  store: StoreShape,
  weekKey: string,
  tier: LeagueTier,
  me: { userId: string; displayName: string; avatarUrl: string | null },
) {
  const { startsAt, endsAt } = saturdayWindow(weekKey);
  const prompt = promptForWeek(weekKey);
  const sched = scheduleFor(leagueNow());
  if (!store.weeks[weekKey]) {
    store.weeks[weekKey] = {
      week: {
        id: `week-${weekKey}`,
        weekKey,
        promptTitle: prompt.title,
        promptBody: prompt.body,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status:
          sched.weekKey === weekKey && (sched.phase === "submit" || sched.phase === "vote")
            ? "active"
            : sched.weekKey === weekKey && sched.phase === "results"
              ? "ended"
              : "upcoming",
      },
      seedPlantId: null,
      authoredByUserId: null,
      groups: {},
    };
  } else {
    store.weeks[weekKey]!.seedPlantId ??= null;
    store.weeks[weekKey]!.authoredByUserId ??= null;
  }
  const weekBucket = store.weeks[weekKey]!;
  const groupKey = `${tier}-0`;
  if (!weekBucket.groups[groupKey]) {
    weekBucket.groups[groupKey] = {
      groupId: `g-${weekKey}-${tier}-0`,
      tier,
      members: [
        {
          membershipId: `m-${weekKey}-${tier}-${me.userId}`,
          userId: me.userId,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          voteScore: 0,
        },
      ],
      votes: {},
    };
  } else {
    const g = weekBucket.groups[groupKey]!;
    // 旧デモの架空ユーザーを除去
    g.members = g.members.filter((m) => isRealUserId(m.userId));
    const botSubIds = new Set(
      Object.entries(g.votes)
        .filter(([voterId]) => !isRealUserId(voterId))
        .map(([, subId]) => subId),
    );
    for (const voterId of Object.keys(g.votes)) {
      if (!isRealUserId(voterId)) delete g.votes[voterId];
    }
    // ボット提出への票も落とす（提出自体は members から消えている）
    for (const [voterId, subId] of Object.entries(g.votes)) {
      if (botSubIds.has(subId) || subId.includes("-bot-")) delete g.votes[voterId];
    }

    const mine = g.members.find((m) => m.userId === me.userId);
    if (!mine) {
      g.members.unshift({
        membershipId: `m-${weekKey}-${tier}-${me.userId}`,
        userId: me.userId,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        voteScore: 0,
      });
    } else {
      mine.displayName = me.displayName;
      mine.avatarUrl = me.avatarUrl;
    }
  }
  return weekBucket.groups[groupKey]!;
}

function rankedMembers(
  group: StoreShape["weeks"][string]["groups"][string],
  meUserId: string,
  highlight: boolean,
): LeagueMember[] {
  const sorted = [...group.members]
    .filter((m) => isRealUserId(m.userId))
    .sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      return a.membershipId.localeCompare(b.membershipId);
    });
  return sorted.map((m, i) => {
    const rank = i + 1;
    const promoted = rank <= PROMOTION_SLOTS;
    return {
      id: m.membershipId,
      userId: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      tier: group.tier,
      voteScore: m.voteScore,
      rank,
      promoted,
      resultStatus: promoted ? "promoted" : "stayed",
      hasSubmission: Boolean(m.submission),
      isMe: m.userId === meUserId,
      highlighted: m.userId === meUserId ? highlight : false,
    };
  });
}

export function loadLocalProfile(userId: string): LeagueProfileState {
  const store = readStore();
  const p = ensureProfile(store, userId);
  writeStore(store);
  return {
    userId,
    tier: parseLeagueTier(p.tier),
    tutorialCompleted: Boolean(p.tutorialCompletedAt),
    promotions: p.promotions,
    highlight: p.highlight,
    history: p.history,
  };
}

export function completeLocalTutorial(
  userId: string,
  input: { title: string; content: string; displayName: string },
): LeagueTutorialResult {
  const store = readStore();
  const p = ensureProfile(store, userId);
  const mockBoard: LeagueMember[] = [
    {
      id: "tut-1",
      userId: "bot-t1",
      displayName: "ソラ",
      avatarUrl: null,
      tier: "bronze",
      voteScore: 9,
      rank: 1,
      promoted: true,
      resultStatus: "tutorial",
      hasSubmission: true,
      isMe: false,
      highlighted: false,
    },
    {
      id: "tut-2",
      userId: "bot-t2",
      displayName: "ユイ",
      avatarUrl: null,
      tier: "bronze",
      voteScore: 7,
      rank: 2,
      promoted: true,
      resultStatus: "tutorial",
      hasSubmission: true,
      isMe: false,
      highlighted: false,
    },
    {
      id: "tut-me",
      userId,
      displayName: input.displayName || "あなた",
      avatarUrl: null,
      tier: "bronze",
      voteScore: 6,
      rank: 3,
      promoted: true,
      resultStatus: "tutorial",
      hasSubmission: true,
      isMe: true,
      highlighted: false,
    },
    {
      id: "tut-4",
      userId: "bot-t4",
      displayName: "レン",
      avatarUrl: null,
      tier: "bronze",
      voteScore: 4,
      rank: 4,
      promoted: false,
      resultStatus: "tutorial",
      hasSubmission: true,
      isMe: false,
      highlighted: false,
    },
    {
      id: "tut-5",
      userId: "bot-t5",
      displayName: "ミオ",
      avatarUrl: null,
      tier: "bronze",
      voteScore: 2,
      rank: 5,
      promoted: false,
      resultStatus: "tutorial",
      hasSubmission: true,
      isMe: false,
      highlighted: false,
    },
  ];
  const result: LeagueTutorialResult = {
    title: input.title,
    content: input.content,
    mockRank: 3,
    mockBoard,
    completedAt: new Date().toISOString(),
  };
  p.tutorialCompletedAt = result.completedAt;
  p.tutorial = result;
  writeStore(store);
  return result;
}

export function loadLocalBattle(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  opts?: { weekKey?: string },
): LeagueBattleState {
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const sched = scheduleFor(leagueNow());
  const weekKey = opts?.weekKey ?? sched.weekKey;
  const group = ensureWeekGroup(store, weekKey, profile.tier, me);
  const week = store.weeks[weekKey]!.week;
  const phase = weekKey === sched.weekKey ? sched.phase : "results";
  week.status =
    phase === "submit" || phase === "vote" ? "active" : phase === "results" ? "ended" : "upcoming";

  // Early phase: AI / ops review owns 勝ち点 (available as soon as you submit).
  const showAiReview = phase === "submit" || phase === "vote" || phase === "results";
  for (const m of group.members) {
    if (!isRealUserId(m.userId) || !m.submission) continue;
    if (!m.submission.aiReview) {
      m.submission.aiReview = reviewIdeaWithAi({
        title: m.submission.title,
        content: m.submission.content,
        appeal: m.submission.appeal,
      });
    }
    m.voteScore = m.submission.aiReview.score;
  }

  writeStore(store);

  const peersHidden = phase === "submit";
  const members = rankedMembers(group, me.userId, profile.highlight);
  const submissions: LeagueSubmission[] = group.members
    .filter((m) => isRealUserId(m.userId) && m.submission)
    .filter((m) => (peersHidden ? m.userId === me.userId : true))
    .map((m) => {
      const s = m.submission!;
      return {
        id: s.id,
        userId: m.userId,
        membershipId: m.membershipId,
        title: s.title,
        content: s.content,
        appeal: s.appeal,
        voteCount: peersHidden && m.userId !== me.userId ? 0 : m.voteScore,
        votedByMe: group.votes[me.userId] === s.id,
        authorName: m.displayName,
        authorAvatarUrl: m.avatarUrl,
        isMe: m.userId === me.userId,
        highlighted: m.userId === me.userId ? profile.highlight : false,
        aiReview: showAiReview && (m.userId === me.userId || !peersHidden) ? s.aiReview ?? null : null,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  const mine = group.members.find((m) => m.userId === me.userId);
  const mySubmission = submissions.find((s) => s.isMe) ?? null;

  return {
    week,
    tier: profile.tier,
    groupId: group.groupId,
    members: peersHidden ? members.filter((m) => m.isMe) : members,
    submissions,
    myMembershipId: mine?.membershipId ?? null,
    mySubmission,
    myVoteSubmissionId: group.votes[me.userId] ?? null,
    promotionCutoff: PROMOTION_SLOTS,
    demo: true,
    phase: phase === "waiting" ? "waiting" : phase,
    peersHidden,
    displayResultsWeekKey: sched.displayResultsWeekKey,
    seedPlantId: store.weeks[weekKey]?.seedPlantId ?? null,
  };
}

export function saveLocalPromptFromSeed(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  input: { plantId: string; title: string; body: string },
): LeagueBattleState {
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const weekKey = saturdayWeekKey(leagueNow());
  ensureWeekGroup(store, weekKey, profile.tier, me);
  const bucket = store.weeks[weekKey]!;
  bucket.week.promptTitle = input.title.trim().slice(0, 80);
  bucket.week.promptBody = input.body.trim();
  bucket.seedPlantId = input.plantId;
  bucket.authoredByUserId = me.userId;
  writeStore(store);
  return loadLocalBattle(me);
}

export function submitLocalIdea(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  input: { title: string; content: string; appeal?: string },
): LeagueBattleState {
  if (scheduleFor(leagueNow()).phase !== "submit") return loadLocalBattle(me);
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const weekKey = saturdayWeekKey(leagueNow());
  const group = ensureWeekGroup(store, weekKey, profile.tier, me);
  const mine = group.members.find((m) => m.userId === me.userId)!;
  const title = input.title.trim().slice(0, 40);
  const content = input.content.trim();
  const appeal = input.appeal?.trim().slice(0, 140) || null;
  // Instant AI 勝ち点 so submitting feels rewarding (official board still settles in judgment).
  const aiReview = reviewIdeaWithAi({ title, content, appeal });
  mine.submission = {
    id: mine.submission?.id ?? `s-${weekKey}-${me.userId}`,
    title,
    content,
    appeal,
    aiReview,
  };
  mine.voteScore = aiReview.score;
  writeStore(store);
  return loadLocalBattle(me);
}

export function castLocalVote(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  _submissionId: string,
): LeagueBattleState {
  // Early phase: AI / ops review owns 勝ち点. Peer voting is retained for a later mode.
  void _submissionId;
  return loadLocalBattle(me);
}

/** 水曜 11:00 の結果公表時に上位3を昇格 */
export function finalizeLocalWeek(userId: string): LeagueProfileState {
  const store = readStore();
  const profile = ensureProfile(store, userId);
  const sched = scheduleFor(leagueNow());
  if (sched.phase !== "results") return loadLocalProfile(userId);
  const weekKey = sched.weekKey;
  const weekBucket = store.weeks[weekKey];
  if (!weekBucket) return loadLocalProfile(userId);
  const groupKey = `${profile.tier}-0`;
  const group = weekBucket.groups[groupKey];
  if (!group) return loadLocalProfile(userId);

  const members = rankedMembers(group, userId, profile.highlight);
  const me = members.find((m) => m.isMe);
  if (!me) return loadLocalProfile(userId);

  const alreadyLogged = profile.history.some((h) => h.weekKey === weekKey);
  if (!alreadyLogged) {
    const promoted = me.rank <= PROMOTION_SLOTS;
    const toTier = promoted ? nextLeagueTier(profile.tier) ?? profile.tier : profile.tier;
    if (promoted && toTier !== profile.tier) {
      profile.tier = toTier;
      profile.promotions += 1;
      profile.highlight = toTier !== "bronze";
    }
    profile.history.unshift({
      weekKey,
      promptTitle: weekBucket.week.promptTitle,
      tier: me.tier,
      rank: me.rank,
      voteScore: me.voteScore,
      resultStatus: promoted ? "promoted" : "stayed",
      endedAt: sched.resultsAt.toISOString(),
    });
    weekBucket.week.status = "ended";
  }
  writeStore(store);
  return loadLocalProfile(userId);
}

export function getTutorialPrompt() {
  return TUTORIAL_PROMPT;
}
