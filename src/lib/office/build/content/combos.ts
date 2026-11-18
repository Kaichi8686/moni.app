export type ComboMatch =
  | { tags: string[] }
  | { card_ids: string[] };

export type ComboDef = {
  id: string;
  name: string;
  match: ComboMatch;
  bonusMult: number;
  termId: string;
};

export const OFFICE_COMBOS: ComboDef[] = [
  {
    id: "queue_ops",
    name: "行列さばき",
    match: { tags: ["queue", "ops"] },
    bonusMult: 1.15,
    termId: "rotation",
  },
  {
    id: "youth_price",
    name: "学生ターゲット",
    match: { tags: ["youth", "price"] },
    bonusMult: 1.2,
    termId: "target",
  },
  {
    id: "bundle_upsell",
    name: "セット販売コンボ",
    match: { tags: ["bundle", "upsell"] },
    bonusMult: 1.15,
    termId: "set_sales",
  },
  {
    id: "scarcity_promo",
    name: "限定感マーケ",
    match: { tags: ["scarcity", "promo"] },
    bonusMult: 1.25,
    termId: "scarcity",
  },
  {
    id: "sns_buzz",
    name: "口コミ拡散",
    match: { tags: ["sns", "promo"] },
    bonusMult: 1.2,
    termId: "wom",
  },
  {
    id: "gold_starter",
    name: "整理券×学割×セット",
    match: { card_ids: ["organize_ticket", "student_discount", "set_deal"] },
    bonusMult: 1.1,
    termId: "unit_price",
  },
  {
    id: "service_repeat",
    name: "リピート接客",
    match: { tags: ["service", "repeat"] },
    bonusMult: 1.15,
    termId: "repeat",
  },
  {
    id: "diff_story",
    name: "差別化ストーリー",
    match: { tags: ["diff", "promo"] },
    bonusMult: 1.18,
    termId: "diff",
  },
];
