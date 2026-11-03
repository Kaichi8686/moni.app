import type { GardenDraft, GardenScreen, GardenState, GrowPhase, PlantedIdea, SundayPhase } from "@/lib/idea-garden/types";
import { isGrowDay, isSunday, tokyoDateKey, weekKeyFor } from "@/lib/idea-garden/calendar";

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

/** 今日の途中下書きが有効なら返す（完了済みなら無効） */
export function usableDraft(plants: PlantedIdea[], draft: GardenDraft | null | undefined): GardenDraft | null {
  if (!draft || draft.dateKey !== tokyoDateKey()) return null;

  if (isGrowDay() && plantForDate(plants, tokyoDateKey())) return null;
  if (isSunday() && goldDoneThisWeek(plants, weekKeyFor())) return null;

  return {
    ...draft,
    screen: stabilizeDraftScreen(draft.screen),
  };
}
