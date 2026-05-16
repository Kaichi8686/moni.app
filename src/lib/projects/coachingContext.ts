export type CoachingContext = {
  /** 叶えたいこと（短文） */
  dreamStatement?: string;
  /** いま困っていること */
  stuckNow?: string;
  /** ざっくり期限のメモ（例: 夏まで・3か月以内） */
  roughDeadline?: string;
  /** オンボーディングを済ませた日時 ISO */
  onboardingDoneAt?: string;
  /** 週次ふりかえり（軽量・任意） */
  weeklyReview?: {
    done?: string;
    learned?: string;
    next?: string;
    updatedAt?: string;
  };
};

export function parseCoachingContext(raw: unknown): CoachingContext {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const dreamStatement = typeof o.dreamStatement === "string" ? o.dreamStatement : undefined;
  const stuckNow = typeof o.stuckNow === "string" ? o.stuckNow : undefined;
  const roughDeadline = typeof o.roughDeadline === "string" ? o.roughDeadline : undefined;
  const onboardingDoneAt = typeof o.onboardingDoneAt === "string" ? o.onboardingDoneAt : undefined;

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

  return { dreamStatement, stuckNow, roughDeadline, onboardingDoneAt, weeklyReview };
}

/** weeklyReview などネストを潰さずマージ（タスクパネルからの部分更新用） */
export function mergeCoachingContext(prev: CoachingContext, patch: Partial<CoachingContext>): CoachingContext {
  const next: CoachingContext = { ...prev, ...patch };
  if (patch.weeklyReview !== undefined) {
    next.weeklyReview = { ...prev.weeklyReview, ...patch.weeklyReview };
  }
  return next;
}
