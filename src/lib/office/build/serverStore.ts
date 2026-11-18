import { ensureStarterCompany, type RunStore } from "@/lib/office/build/runService";
import { createMemoryRunStore } from "@/lib/office/build/localBuildStore";
import type { BuildCompanyState } from "@/lib/office/build/runTypes";
import { STARTER_CARD_IDS } from "@/lib/office/build/content/cards";

/**
 * プロセス内ストア（DB未適用・ローカル検証用）。
 * ユーザーごとに会社が無ければブートストラップする。
 */
const stores = new Map<string, RunStore>();

export function getServerRunStore(userId: string): RunStore {
  let store = stores.get(userId);
  if (!store) {
    store = createMemoryRunStore();
    stores.set(userId, store);
  }
  return store;
}

export function bootstrapCompanyIfNeeded(
  store: RunStore,
  userId: string,
  seed?: Partial<BuildCompanyState>,
): BuildCompanyState {
  const existing = store.getCompany(userId);
  if (existing) return existing;
  const company = ensureStarterCompany({
    id: seed?.id ?? crypto.randomUUID(),
    userId,
    name: seed?.name ?? "テスト商事",
    about: seed?.about ?? "学生向けの店を運営する会社",
    industry: seed?.industry ?? "food",
    coins: seed?.coins ?? 0,
    mood: seed?.mood ?? "good",
    streak: seed?.streak ?? 0,
    totalRevenue: seed?.totalRevenue ?? 0,
    level: seed?.level ?? 1,
    stamina: seed?.stamina ?? 5,
    staminaUpdatedAt: seed?.staminaUpdatedAt ?? new Date().toISOString(),
    tutorialDone: seed?.tutorialDone ?? false,
    rankingEnabled: seed?.rankingEnabled ?? true,
    sfxMuted: seed?.sfxMuted ?? true,
    ownerName: seed?.ownerName ?? "カイ",
    deckIds: seed?.deckIds ?? [...STARTER_CARD_IDS],
  });
  store.saveCompany(company);
  return company;
}

export function resetAllServerStores() {
  stores.clear();
}
