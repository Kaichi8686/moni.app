export type MyBookMood = "happy" | "calm" | "think" | "tired" | "excited" | null;

export type MyBookEntry = {
  id: string;
  userId: string;
  entryDate: string;
  title: string;
  body: string;
  mood: MyBookMood;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MyBookEntryInput = {
  entryDate: string;
  title: string;
  body: string;
  mood?: MyBookMood;
};

export const MYBOOK_MOOD_OPTIONS: { value: NonNullable<MyBookMood>; label: string; labelEn: string; icon: string }[] = [
  { value: "happy", label: "うれしい", labelEn: "Happy", icon: "😊" },
  { value: "calm", label: "落ち着き", labelEn: "Calm", icon: "🌿" },
  { value: "think", label: "考え中", labelEn: "Thinking", icon: "💭" },
  { value: "tired", label: "疲れた", labelEn: "Tired", icon: "😴" },
  { value: "excited", label: "ワクワク", labelEn: "Excited", icon: "✨" },
];
