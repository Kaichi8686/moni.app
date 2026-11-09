import type { GardenDraft, GardenScreen, GardenState, GrowPhase, PlantedIdea, SundayPhase } from "@/lib/idea-garden/types";
import { addDaysToDateKey, gardenBusinessDateKey, weekKeyFor } from "@/lib/idea-garden/calendar";

/** レガシー（ユーザー未分離）キー — 初回だけ個人キーへ移行 */
export const GARDEN_STORAGE_KEY_LEGACY = "moni.ideaGarden.v1";

/** 個人のガーデン。共有しない。1人1日1花。 */
export function gardenStorageKey(ownerId: string | null | undefined): string {
  const id = (ownerId ?? "").trim() || "guest";
  return `moni.ideaGarden.v1:${id}`;
}

export function emptyGarden(): GardenState {
  return { version: 1, plants: [], draft: null };
}

function parseGarden(raw: string | null): GardenState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GardenState>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.plants)) return null;
    return {
      version: 1,
      plants: parsed.plants as PlantedIdea[],
      draft: (parsed.draft as GardenDraft | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export function loadGarden(ownerId?: string | null): GardenState {
  if (typeof window === "undefined") return emptyGarden();
  const key = gardenStorageKey(ownerId);
  const own = parseGarden(window.localStorage.getItem(key));
  if (own) return own;

  // 旧キーからの移行（ログイン時のみ本人へ移す）
  if (ownerId) {
    const legacy = parseGarden(window.localStorage.getItem(GARDEN_STORAGE_KEY_LEGACY));
    if (legacy && (legacy.plants.length > 0 || legacy.draft)) {
      window.localStorage.setItem(key, JSON.stringify(legacy));
      window.localStorage.removeItem(GARDEN_STORAGE_KEY_LEGACY);
      return legacy;
    }
  }

  return emptyGarden();
}

export function saveGarden(state: GardenState, ownerId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    gardenStorageKey(ownerId),
    JSON.stringify({
      version: 1 as const,
      plants: state.plants,
      draft: state.draft ?? null,
    }),
  );
}

export function upsertPlant(plants: PlantedIdea[], plant: PlantedIdea): PlantedIdea[] {
  const i = plants.findIndex((p) => p.id === plant.id);
  if (i < 0) return [plant, ...plants];
  const next = plants.slice();
  next[i] = plant;
  return next;
}

export function plantForDate(plants: PlantedIdea[], dateKey: string): PlantedIdea | undefined {
  return plants.find((p) => p.dateKey === dateKey);
}

export function plantsForWeek(plants: PlantedIdea[], weekKey: string): PlantedIdea[] {
  return plants
    .filter((p) => p.weekKey === weekKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function weekKeysDesc(plants: PlantedIdea[], currentWeekKey: string): string[] {
  const set = new Set(plants.map((p) => p.weekKey));
  set.add(currentWeekKey);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function goldDoneThisWeek(plants: PlantedIdea[], weekKey: string): boolean {
  return plants.some((p) => p.weekKey === weekKey && p.gold);
}

/** アニメ途中の画面は安定した段階へ寄せて再開 */
export function stabilizeDraftScreen(screen: GardenScreen): GardenScreen {
  if (screen.kind === "grow") {
    if (screen.phase === "paused") return screen;
    const phase: GrowPhase =
      screen.phase === "seed-reveal"
        ? "plant"
        : screen.phase === "growing"
          ? "celebrate"
          : screen.phase;
    return { kind: "grow", phase };
  }
  if (screen.kind === "sunday") {
    const phase: SundayPhase = screen.phase === "gilding" ? "celebrate" : screen.phase;
    return { kind: "sunday", phase };
  }
  return screen;
}

/**
 * 連続記録・カレンダー用の活動日。
 * 平日の植えた日 + 日曜に金にした日（goldAt）を含める。
 */
export function ideaActivityDateKeys(plants: PlantedIdea[]): string[] {
  const days = new Set<string>();
  for (const p of plants) {
    if (p.dateKey) days.add(p.dateKey);
    if (!p.gold) continue;
    if (p.goldAt) {
      days.add(gardenBusinessDateKey(new Date(p.goldAt)));
    } else if (p.weekKey) {
      // レガシー: goldAt が無い場合はその週の日曜とみなす
      days.add(addDaysToDateKey(p.weekKey, 6));
    }
  }
  return [...days];
}

/**
 * アイデア出した連続日数（東京暦・Duolingo風）。
 * 今日未実施なら昨日から遡って数える。日曜の金化も含む。
 */
export function ideaStreakDays(plants: PlantedIdea[]): number {
  const days = new Set(ideaActivityDateKeys(plants));
  if (days.size === 0) return 0;
  const today = gardenBusinessDateKey();
  let cursor = days.has(today) ? today : addDaysToDateKey(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }
  return streak;
}

/** 今日の途中下書きが有効なら返す（完了時は draft=null で消す） */
export function usableDraft(plants: PlantedIdea[], draft: GardenDraft | null | undefined): GardenDraft | null {
  if (!draft || draft.dateKey !== gardenBusinessDateKey()) return null;

  // 日曜ゴールド完了後は sunday 下書きだけ無効（棚の＋からの種袋フローは同日でも再開可）
  const sundayDone = goldDoneThisWeek(plants, weekKeyFor());
  const isSundayDraft =
    draft.screen.kind === "sunday" ||
    (Boolean(draft.paused) && draft.resumeScreen?.kind === "sunday");
  if (sundayDone && isSundayDraft) return null;

  if (draft.paused) {
    return {
      ...draft,
      screen: { kind: "grow", phase: "paused" },
      resumeScreen: draft.resumeScreen
        ? stabilizeDraftScreen(draft.resumeScreen)
        : { kind: "grow", phase: "plant" },
    };
  }

  return {
    ...draft,
    screen: stabilizeDraftScreen(draft.screen),
  };
}
