/** Step 1: 業種テンプレ（studentRoadmapTemplates と同じキー） */
export type OnboardingBusinessCategoryKey = "food" | "retail" | "app" | "event" | "education" | "custom";

/** Step 2: いまの進み具合（ロードマップ初期状態に反映） */
export type OnboardingProgressStage = "idea" | "research" | "prototype" | "live";

/** Step 3: チーム規模 */
export type OnboardingTeamSize = "solo" | "small" | "large";

const CATEGORY_KEYS = new Set<string>(["food", "retail", "app", "event", "education", "custom"]);

export type CoachingContext = {
  /** 達成したいこと（短文・任意） */
  dreamStatement?: string;
  /** 困っていること（任意） */
  stuckNow?: string;
  /** 期限の目安（例: 夏まで・3か月以内） */
  roughDeadline?: string;
  /** オンボーディングを済ませた日時 ISO */
  onboardingDoneAt?: string;
  /** オンボで選んだ業種テンプレ（ロードマップ生成に使用） */
  onboardingBusinessCategory?: OnboardingBusinessCategoryKey;
  /** オンボ Step2 */
  onboardingProgressStage?: OnboardingProgressStage;
  /** オンボ Step3 */
  onboardingTeamSize?: OnboardingTeamSize;
  /** チーム連続活動日（タスク／フェーズ完了などで更新） */
  teamActivityStreak?: number;
  /** teamActivityStreak の基準日（Asia/Tokyo の YYYY-MM-DD） */
  teamActivityLastDate?: string;
  /** 今週のタスク完了目標（1〜99）。未設定はフィールドなし */
  weeklyCompletionGoal?: number;
  /** 週のメモ（任意） */
  weeklyReview?: {
    done?: string;
    learned?: string;
    next?: string;
    updatedAt?: string;
  };
};

function parseBusinessCategory(raw: unknown): OnboardingBusinessCategoryKey | undefined {
  if (typeof raw !== "string" || !CATEGORY_KEYS.has(raw)) return undefined;
  return raw as OnboardingBusinessCategoryKey;
}

function parseProgressStage(raw: unknown): OnboardingProgressStage | undefined {
  if (raw === "idea" || raw === "research" || raw === "prototype" || raw === "live") return raw;
  return undefined;
}

function parseTeamSize(raw: unknown): OnboardingTeamSize | undefined {
  if (raw === "solo" || raw === "small" || raw === "large") return raw;
  return undefined;
}

export function parseCoachingContext(raw: unknown): CoachingContext {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const dreamStatement = typeof o.dreamStatement === "string" ? o.dreamStatement : undefined;
  const stuckNow = typeof o.stuckNow === "string" ? o.stuckNow : undefined;
  const roughDeadline = typeof o.roughDeadline === "string" ? o.roughDeadline : undefined;
  const onboardingDoneAt = typeof o.onboardingDoneAt === "string" ? o.onboardingDoneAt : undefined;
  const onboardingBusinessCategory = parseBusinessCategory(o.onboardingBusinessCategory);
  const onboardingProgressStage = parseProgressStage(o.onboardingProgressStage);
  const onboardingTeamSize = parseTeamSize(o.onboardingTeamSize);
  const teamActivityStreak =
    typeof o.teamActivityStreak === "number" && Number.isFinite(o.teamActivityStreak) && o.teamActivityStreak >= 0
      ? Math.floor(o.teamActivityStreak)
      : undefined;
  const teamActivityLastDate =
    typeof o.teamActivityLastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.teamActivityLastDate)
      ? o.teamActivityLastDate
      : undefined;

  let weeklyCompletionGoal: number | undefined;
  if (typeof o.weeklyCompletionGoal === "number" && Number.isFinite(o.weeklyCompletionGoal)) {
    const g = Math.floor(o.weeklyCompletionGoal);
    if (g >= 1 && g <= 99) weeklyCompletionGoal = g;
  }

  let weeklyReview: CoachingContext["weeklyReview"];
  const wr = o.weeklyReview;
  if (wr != null && typeof wr === "object" && !Array.isArray(wr)) {
    const w = wr as Record<string, unknown>;
    weeklyReview = {
      done: typeof w.done === "string" ? w.done : undefined,
      learned: typeof w.learned === "string" ? w.learned : undefined,
      next: typeof w.next === "string" ? w.next : undefined,
      updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : undefined,
    };
  }

  return {
    dreamStatement,
    stuckNow,
    roughDeadline,
    onboardingDoneAt,
    onboardingBusinessCategory,
    onboardingProgressStage,
    onboardingTeamSize,
    teamActivityStreak,
    teamActivityLastDate,
    weeklyCompletionGoal,
    weeklyReview,
  };
}

/** weeklyReview などネストを潰さずマージ（タスクパネルからの部分更新用） */
export function mergeCoachingContext(prev: CoachingContext, patch: Partial<CoachingContext>): CoachingContext {
  const next: CoachingContext = { ...prev, ...patch };
  if (patch.weeklyReview !== undefined) {
    next.weeklyReview = { ...prev.weeklyReview, ...patch.weeklyReview };
  }
  if (patch.weeklyCompletionGoal !== undefined) {
    const g = patch.weeklyCompletionGoal;
    if (!Number.isFinite(g) || g < 1 || g > 99) {
      delete next.weeklyCompletionGoal;
    } else {
      next.weeklyCompletionGoal = Math.floor(g);
    }
  }
  return next;
}
