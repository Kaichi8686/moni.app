export type TermDef = {
  id: string;
  name: string;
  shortDesc: string;
  formula: string | null;
  unlockBy: string | null;
};

export const OFFICE_TERMS: TermDef[] = [
  {
    id: "customers",
    name: "客数",
    shortDesc: "何人来てくれたか。売上の左の数字。",
    formula: "売上 = 客数 × 客単価",
    unlockBy: null,
  },
  {
    id: "unit_price",
    name: "客単価",
    shortDesc: "一人あたりいくら払ってくれたか。",
    formula: "売上 = 客数 × 客単価",
    unlockBy: "upsell_drink",
  },
  {
    id: "repeat",
    name: "リピート率",
    shortDesc: "また来てくれる割合。客数を安定させる。",
    formula: null,
    unlockBy: "loyalty_stamp",
  },
  {
    id: "rotation",
    name: "回転率",
    shortDesc: "同じ席・時間で何組回せるか。",
    formula: null,
    unlockBy: "organize_ticket",
  },
  {
    id: "cost",
    name: "原価",
    shortDesc: "仕入れや材料にかかるお金。下げすぎ注意。",
    formula: "利益 ≒ 売上 − 原価",
    unlockBy: "cost_cut_pack",
  },
  {
    id: "profit",
    name: "利益",
    shortDesc: "売ったあと手元に残る分。",
    formula: "利益 ≒ 売上 − 原価",
    unlockBy: "data_board",
  },
  {
    id: "target",
    name: "ターゲット",
    shortDesc: "だれに届けるかの仮説。当たると効く。",
    formula: null,
    unlockBy: "student_discount",
  },
  {
    id: "diff",
    name: "差別化",
    shortDesc: "ほかと違う理由。選ばれるフック。",
    formula: null,
    unlockBy: "story_sign",
  },
  {
    id: "wom",
    name: "口コミ",
    shortDesc: "人づてやSNSでの広がり。",
    formula: null,
    unlockBy: "word_of_mouth",
  },
  {
    id: "set_sales",
    name: "セット販売",
    shortDesc: "まとめて売る工夫。単価を上げやすい。",
    formula: null,
    unlockBy: "set_deal",
  },
  {
    id: "scarcity",
    name: "限定感",
    shortDesc: "今だけの空気。来店のきっかけになる。",
    formula: null,
    unlockBy: "limited_poster",
  },
  {
    id: "ops",
    name: "オペレーション",
    shortDesc: "現場の流れ。詰まると客数が落ちる。",
    formula: null,
    unlockBy: "staff_brief",
  },
  {
    id: "service",
    name: "接客品質",
    shortDesc: "気持ちよさ。リピートと口コミに効く。",
    formula: null,
    unlockBy: "smile_service",
  },
  {
    id: "mult",
    name: "倍率",
    shortDesc: "施策の噛み合いで売上が何倍になるか。",
    formula: "売上 = 客数 × 客単価 × 倍率",
    unlockBy: null,
  },
  {
    id: "norma",
    name: "ノルマ",
    shortDesc: "その日クリアしたい売上の目安。",
    formula: "達成率 = 売上 ÷ ノルマ",
    unlockBy: null,
  },
  {
    id: "hypothesis",
    name: "仮説",
    shortDesc: "現場データから立てる「なぜ」の予想。",
    formula: null,
    unlockBy: null,
  },
  {
    id: "combo",
    name: "コンボ",
    shortDesc: "カードの組み合わせで倍率が跳ねる。",
    formula: null,
    unlockBy: null,
  },
  {
    id: "adlib",
    name: "アドリブ",
    shortDesc: "場のカードに合わせた一言アイデア。",
    formula: null,
    unlockBy: null,
  },
  {
    id: "mood",
    name: "調子",
    shortDesc: "会社のムード。最近の結果で変わる。",
    formula: null,
    unlockBy: null,
  },
  {
    id: "revenue_eq",
    name: "売上方程式",
    shortDesc: "売上は客数×客単価。ゲームの基本ルール。",
    formula: "売上 = 客数 × 客単価 × 倍率",
    unlockBy: null,
  },
];
