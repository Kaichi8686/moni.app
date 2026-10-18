import type { SupabaseClient } from "@supabase/supabase-js";

export function onboardingLocalStorageKey(userId: string): string {
  return `moni-onboarding-complete-${userId}`;
}

export function readLocalOnboardingDone(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(onboardingLocalStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeLocalOnboardingDone(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(onboardingLocalStorageKey(userId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** localStorage → DB の順で完了判定 */
export async function resolveOnboardingCompleted(
  client: SupabaseClient | null,
  userId: string,
): Promise<boolean> {
  if (readLocalOnboardingDone(userId)) return true;
  if (!client) return false;
  const { data, error } = await client
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  const done = Boolean(
    (data as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at,
  );
  if (done) writeLocalOnboardingDone(userId);
  return done;
}
