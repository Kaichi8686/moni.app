export type IdeaHubTab = "excavate" | "mine" | "interviews";

export type MyIdeaSource = "manual" | "interview";

export type MyIdea = {
  id: string;
  user_id: string;
  title: string;
  memo: string;
  source: MyIdeaSource;
  seed_id: string | null;
  theme: string | null;
  created_at: string;
  updated_at: string;
};

export type MyIdeaInsert = {
  title: string;
  memo?: string;
  source?: MyIdeaSource;
  seed_id?: string | null;
  theme?: string | null;
};

export type InterviewArticle = {
  id: string;
  title: string;
  excerpt: string;
  authorLabel: string;
  publishedAt: string;
  coverTone: "sky" | "amber" | "rose";
};

export const IDEA_HUB_TABS: Array<{ id: IdeaHubTab; label: string; labelEn: string; shortLabel: string; shortLabelEn: string }> = [
  { id: "excavate", label: "発掘", labelEn: "Discover", shortLabel: "発掘", shortLabelEn: "Find" },
  { id: "mine", label: "マイアイデア", labelEn: "My ideas", shortLabel: "マイ", shortLabelEn: "Mine" },
  { id: "interviews", label: "インタビュー", labelEn: "Interviews", shortLabel: "取材", shortLabelEn: "Stories" },
];

export function parseIdeaHubTab(value: string | null | undefined): IdeaHubTab {
  if (value === "mine" || value === "interviews" || value === "excavate") return value;
  return "excavate";
}
