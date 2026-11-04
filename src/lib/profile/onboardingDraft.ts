import { parseBirthday } from "@/lib/profile/birthday";
import { isProfileGender, type ProfileGender } from "@/lib/profile/gender";
import { parseInterestFields } from "@/lib/profile/interestFields";
import { normalizeTagList, parseStringTagArray } from "@/lib/profile/skillsTraits";
import { parseSocialIssues } from "@/lib/profile/socialIssues";

export type OnboardingDraft = {
  birthday: string;
  gender: ProfileGender | "";
  country: string;
  nickname: string;
  avatarUrl: string | null;
  skills: string[];
  traits: string[];
  interestFields: string[];
  socialIssues: string[];
};

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type OnboardingProgress = {
  v: 1;
  step: OnboardingStep;
  draft: OnboardingDraft;
  updatedAt: string;
};

export function emptyOnboardingDraft(nickname = ""): OnboardingDraft {
  return {
    birthday: "",
    gender: "",
    country: "",
    nickname,
    avatarUrl: null,
    skills: [],
    traits: [],
    interestFields: [],
    socialIssues: [],
  };
}

export function onboardingProgressKey(userId: string): string {
  return `moni-onboarding-progress-${userId}`;
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;
}

function sanitizeDraft(raw: unknown, fallbackNickname = ""): OnboardingDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const birthday = typeof d.birthday === "string" ? d.birthday.slice(0, 10) : "";
  const genderRaw = typeof d.gender === "string" ? d.gender : "";
  const gender = isProfileGender(genderRaw) ? genderRaw : "";
  const country = typeof d.country === "string" ? d.country.slice(0, 2).toUpperCase() : "";
  const nickname =
    typeof d.nickname === "string" ? d.nickname.trim().slice(0, 32) : fallbackNickname;
  const avatarUrl = typeof d.avatarUrl === "string" && d.avatarUrl ? d.avatarUrl : null;
  return {
    birthday,
    gender,
    country,
    nickname: nickname || fallbackNickname,
    avatarUrl,
    skills: normalizeTagList(parseStringTagArray(d.skills), 3),
    traits: normalizeTagList(parseStringTagArray(d.traits), 3),
    interestFields: parseInterestFields(d.interestFields),
    socialIssues: parseSocialIssues(d.socialIssues),
  };
}

export function readOnboardingProgress(
  userId: string,
  fallbackNickname = "",
): OnboardingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(onboardingProgressKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    if (parsed?.v !== 1) return null;
    const draft = sanitizeDraft(parsed.draft, fallbackNickname);
    if (!draft || !isOnboardingStep(parsed.step)) return null;
    return {
      v: 1,
      step: parsed.step,
      draft,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeOnboardingProgress(
  userId: string,
  progress: { step: OnboardingStep; draft: OnboardingDraft },
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: OnboardingProgress = {
      v: 1,
      step: progress.step,
      draft: {
        ...progress.draft,
        nickname: progress.draft.nickname.trim().slice(0, 32),
        skills: normalizeTagList(progress.draft.skills, 3),
        traits: normalizeTagList(progress.draft.traits, 3),
        interestFields: parseInterestFields(progress.draft.interestFields),
        socialIssues: parseSocialIssues(progress.draft.socialIssues),
      },
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(onboardingProgressKey(userId), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOnboardingProgress(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(onboardingProgressKey(userId));
  } catch {
    /* ignore */
  }
}

/**
 * DB / 下書きの入力済み項目から、再開すべきステップを推定する。
 * localStorage に step が無いときのフォールバック。
 */
export function inferOnboardingStep(draft: OnboardingDraft): OnboardingStep {
  const birthdayOk = parseBirthday(draft.birthday) !== null;
  const genderOk = isProfileGender(draft.gender);
  if (!birthdayOk || !genderOk) return 1;
  if (draft.country.length !== 2) return 2;
  if (draft.nickname.trim().length < 1) return 3;
  const interestsOk = draft.skills.length === 3 && draft.traits.length === 3;
  if (!interestsOk) {
    // アバターは任意。未設定なら 4、設定済みなら興味選択へ。
    return draft.avatarUrl ? 5 : 4;
  }
  if (draft.socialIssues.length > 0) return 7;
  if (draft.interestFields.length > 0) return 7;
  return 6;
}

/** ローカル下書きを優先しつつ、空の項目だけ DB 値で埋める */
export function mergeOnboardingDraft(
  base: OnboardingDraft,
  incoming: Partial<OnboardingDraft>,
): OnboardingDraft {
  return {
    birthday: base.birthday || incoming.birthday || "",
    gender: base.gender || incoming.gender || "",
    country: base.country || incoming.country || "",
    nickname: base.nickname.trim() || (incoming.nickname ?? "").trim(),
    avatarUrl: base.avatarUrl || incoming.avatarUrl || null,
    skills: base.skills.length > 0 ? base.skills : incoming.skills ?? [],
    traits: base.traits.length > 0 ? base.traits : incoming.traits ?? [],
    interestFields:
      base.interestFields.length > 0 ? base.interestFields : incoming.interestFields ?? [],
    socialIssues: base.socialIssues.length > 0 ? base.socialIssues : incoming.socialIssues ?? [],
  };
}
