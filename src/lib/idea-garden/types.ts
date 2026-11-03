/** 6種類の花（種袋に対応） */
export type FlowerKind = "rose" | "sunflower" | "tulip" | "lavender" | "daisy" | "lily";

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0 … Sat=6

export type PlantedIdea = {
  id: string;
  /** その週の月曜の日付キー YYYY-MM-DD (Asia/Tokyo) */
  weekKey: string;
  /** 植えた日 YYYY-MM-DD (Asia/Tokyo) */
  dateKey: string;
  weekday: WeekdayIndex;
  flowerKind: FlowerKind;
  title: string;
  /** 日替わり質問への答え */
  answer: string;
  promptId: string;
  gold: boolean;
  target?: string;
  situation?: string;
  createdAt: string;
  /** 日曜ディープダイブ完了日時 */
  goldAt?: string;
};

/** 月曜〜土曜の育成フロー段階 */
export type GrowPhase =
  | "pick-bag"
  | "bag-focus"
  | "seed-reveal"
  | "plant"
  | "question"
  | "title"
  | "growing"
  | "celebrate";

/** 日曜フロー段階 */
export type SundayPhase =
  | "start"
  | "pick-flower"
  | "target"
  | "situation"
  | "gilding"
  | "celebrate";

export type GardenScreen =
  | { kind: "shelf" }
  | { kind: "detail"; plantId: string }
  | { kind: "grow"; phase: GrowPhase }
  | { kind: "sunday"; phase: SundayPhase };

/** 途中離脱からの再開用（その日限り・個人専用） */
export type GardenDraft = {
  dateKey: string;
  screen: GardenScreen;
  bagIndex: number;
  selectedKind: FlowerKind | null;
  answer: string;
  title: string;
  sundayIndex: number;
  sundayPickId: string | null;
  target: string;
  situation: string;
};

export type GardenState = {
  version: 1;
  plants: PlantedIdea[];
  /** 進行中のフロー。完了したら null */
  draft?: GardenDraft | null;
};

export type SeedBagDef = {
  id: FlowerKind;
  labelJa: string;
  labelEn: string;
  bagColor: string;
  bagShadow: string;
  accent: string;
};
