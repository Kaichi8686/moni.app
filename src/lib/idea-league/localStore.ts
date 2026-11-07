import { saturdayWeekKey, saturdayWindow, isSaturday, leagueNow } from "@/lib/idea-league/calendar";
import { promptForWeek, TUTORIAL_PROMPT } from "@/lib/idea-league/prompts";
import {
  LEAGUE_GROUP_SIZE,
  PROMOTION_SLOTS,
  nextLeagueTier,
  parseLeagueTier,
} from "@/lib/idea-league/tiers";
import type {
  LeagueBattleState,
  LeagueHistoryEntry,
  LeagueMember,
  LeagueProfileState,
  LeagueSubmission,
  LeagueTier,
  LeagueTutorialResult,
  LeagueWeek,
} from "@/lib/idea-league/types";

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
            submission?: { id: string; title: string; content: string; appeal: string | null };
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

function botName(i: number): string {
  const names = [
    "あおい",
    "ハルト",
    "ユイ",
    "ソラ",
    "レン",
    "ミオ",
    "カイ",
    "ヒナ",
    "タクト",
    "ナツキ",
    "リコ",
    "シュン",
    "マナ",
    "コウ",
  ];
  return names[i % names.length] ?? `Player ${i + 1}`;
}

function ensureWeekGroup(
  store: StoreShape,
  weekKey: string,
  tier: LeagueTier,
  me: { userId: string; displayName: string; avatarUrl: string | null },
) {
  const { startsAt, endsAt } = saturdayWindow(weekKey);
  const prompt = promptForWeek(weekKey);
  if (!store.weeks[weekKey]) {
    store.weeks[weekKey] = {
      week: {
        id: `week-${weekKey}`,
        weekKey,
        promptTitle: prompt.title,
        promptBody: prompt.body,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: isSaturday(leagueNow()) && saturdayWeekKey(leagueNow()) === weekKey ? "active" : "ended",
      },
      groups: {},
    };
  }
  const weekBucket = store.weeks[weekKey]!;
  const groupKey = `${tier}-0`;
  if (!weekBucket.groups[groupKey]) {
    const bots = Array.from({ length: LEAGUE_GROUP_SIZE - 1 }, (_, i) => ({
      membershipId: `m-${weekKey}-${tier}-bot-${i}`,
      userId: `bot-${tier}-${i}`,
      displayName: botName(i),
      avatarUrl: null as string | null,
      voteScore: Math.max(0, 12 - i + ((hash(`${weekKey}-${i}`) % 5) - 2)),
      submission: {
        id: `s-${weekKey}-${tier}-bot-${i}`,
        title: `アイデア案 ${i + 1}`,
        content: `${prompt.title} への解決案です。小さな習慣から変えていきます。（デモ）`,
        appeal: null as string | null,
      },
    }));
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
        ...bots,
      ],
      votes: {},
    };
  } else {
    const g = weekBucket.groups[groupKey]!;
    const mine = g.members.find((m) => m.userId === me.userId);
    if (!mine) {
      g.members.unshift({
        membershipId: `m-${weekKey}-${tier}-${me.userId}`,
        userId: me.userId,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        voteScore: 0,
      });
      if (g.members.length > LEAGUE_GROUP_SIZE) g.members.pop();
    } else {
      mine.displayName = me.displayName;
      mine.avatarUrl = me.avatarUrl;
    }
  }
  return weekBucket.groups[groupKey]!;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

function rankedMembers(
  group: StoreShape["weeks"][string]["groups"][string],
  meUserId: string,
  highlight: boolean,
): LeagueMember[] {
  const sorted = [...group.members].sort((a, b) => {
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
): LeagueBattleState {
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const weekKey = saturdayWeekKey(leagueNow());
  const group = ensureWeekGroup(store, weekKey, profile.tier, me);
  const week = store.weeks[weekKey]!.week;
  week.status = isSaturday(leagueNow()) ? "active" : "ended";

  // sync vote scores from votes map
  const voteCounts: Record<string, number> = {};
  for (const subId of Object.values(group.votes)) {
    voteCounts[subId] = (voteCounts[subId] ?? 0) + 1;
  }
  for (const m of group.members) {
    if (m.submission) m.voteScore = voteCounts[m.submission.id] ?? m.voteScore;
  }

  writeStore(store);

  const members = rankedMembers(group, me.userId, profile.highlight);
  const submissions: LeagueSubmission[] = group.members
    .filter((m) => m.submission)
    .map((m) => {
      const s = m.submission!;
      return {
        id: s.id,
        userId: m.userId,
        membershipId: m.membershipId,
        title: s.title,
        content: s.content,
        appeal: s.appeal,
        voteCount: m.voteScore,
        votedByMe: group.votes[me.userId] === s.id,
        authorName: m.displayName,
        authorAvatarUrl: m.avatarUrl,
        isMe: m.userId === me.userId,
        highlighted: m.userId === me.userId ? profile.highlight : false,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  const mine = group.members.find((m) => m.userId === me.userId);
  const mySubmission = submissions.find((s) => s.isMe) ?? null;

  return {
    week,
    tier: profile.tier,
    groupId: group.groupId,
    members,
    submissions,
    myMembershipId: mine?.membershipId ?? null,
    mySubmission,
    myVoteSubmissionId: group.votes[me.userId] ?? null,
    promotionCutoff: PROMOTION_SLOTS,
    demo: true,
  };
}

export function submitLocalIdea(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  input: { title: string; content: string; appeal?: string },
): LeagueBattleState {
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const weekKey = saturdayWeekKey(leagueNow());
  const group = ensureWeekGroup(store, weekKey, profile.tier, me);
  const mine = group.members.find((m) => m.userId === me.userId)!;
  mine.submission = {
    id: mine.submission?.id ?? `s-${weekKey}-${me.userId}`,
    title: input.title.trim().slice(0, 40),
    content: input.content.trim(),
    appeal: input.appeal?.trim().slice(0, 140) || null,
  };
  writeStore(store);
  return loadLocalBattle(me);
}

export function castLocalVote(
  me: { userId: string; displayName: string; avatarUrl: string | null },
  submissionId: string,
): LeagueBattleState {
  const store = readStore();
  const profile = ensureProfile(store, me.userId);
  const weekKey = saturdayWeekKey(leagueNow());
  const group = ensureWeekGroup(store, weekKey, profile.tier, me);
  const target = group.members.find((m) => m.submission?.id === submissionId);
  if (!target || target.userId === me.userId) return loadLocalBattle(me);
  group.votes[me.userId] = submissionId;

  // recompute scores: base bot scores + votes
  const voteCounts: Record<string, number> = {};
  for (const subId of Object.values(group.votes)) {
    voteCounts[subId] = (voteCounts[subId] ?? 0) + 1;
  }
  for (const m of group.members) {
    if (!m.submission) continue;
    const base = m.userId.startsWith("bot-")
      ? Math.max(0, 8 - Number(m.userId.split("-").pop() ?? 0))
      : 0;
    m.voteScore = base + (voteCounts[m.submission.id] ?? 0);
  }
  writeStore(store);
  return loadLocalBattle(me);
}

/** 土曜終了後（またはデモ強制）に上位3を昇格 */
export function finalizeLocalWeek(userId: string): LeagueProfileState {
  const store = readStore();
  const profile = ensureProfile(store, userId);
  const weekKey = saturdayWeekKey(leagueNow());
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
      endedAt: weekBucket.week.endsAt,
    });
    weekBucket.week.status = "ended";
  }
  writeStore(store);
  return loadLocalProfile(userId);
}

export function getTutorialPrompt() {
  return TUTORIAL_PROMPT;
}
