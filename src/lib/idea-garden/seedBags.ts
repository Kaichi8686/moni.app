import type { FlowerKind, SeedBagDef } from "@/lib/idea-garden/types";

export const SEED_BAGS: SeedBagDef[] = [
  {
    id: "rose",
    labelJa: "バラの種",
    labelEn: "Rose seeds",
    bagColor: "#F472B6",
    bagShadow: "#BE185D",
    accent: "#FB7185",
  },
  {
    id: "sunflower",
    labelJa: "ひまわりの種",
    labelEn: "Sunflower seeds",
    bagColor: "#FBBF24",
    bagShadow: "#B45309",
    accent: "#F59E0B",
  },
  {
    id: "tulip",
    labelJa: "チューリップの種",
    labelEn: "Tulip seeds",
    bagColor: "#FB7185",
    bagShadow: "#BE123C",
    accent: "#F43F5E",
  },
  {
    id: "lavender",
    labelJa: "ラベンダーの種",
    labelEn: "Lavender seeds",
    bagColor: "#A78BFA",
    bagShadow: "#6D28D9",
    accent: "#8B5CF6",
  },
  {
    id: "daisy",
    labelJa: "デイジーの種",
    labelEn: "Daisy seeds",
    bagColor: "#67E8F9",
    bagShadow: "#0E7490",
    accent: "#22D3EE",
  },
  {
    id: "lily",
    labelJa: "ユリの種",
    labelEn: "Lily seeds",
    bagColor: "#86EFAC",
    bagShadow: "#15803D",
    accent: "#4ADE80",
  },
];

export function bagByKind(kind: FlowerKind): SeedBagDef {
  return SEED_BAGS.find((b) => b.id === kind) ?? SEED_BAGS[0];
}
