import type { GardenState, PlantedIdea } from "@/lib/idea-garden/types";

export const GARDEN_STORAGE_KEY = "moni.ideaGarden.v1";

export function emptyGarden(): GardenState {
  return { version: 1, plants: [] };
}

export function loadGarden(): GardenState {
  if (typeof window === "undefined") return emptyGarden();
  try {
    const raw = window.localStorage.getItem(GARDEN_STORAGE_KEY);
    if (!raw) return emptyGarden();
    const parsed = JSON.parse(raw) as Partial<GardenState>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.plants)) {
      return emptyGarden();
    }
    return { version: 1, plants: parsed.plants as PlantedIdea[] };
  } catch {
    return emptyGarden();
  }
}

export function saveGarden(state: GardenState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify(state));
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
