export type IdeaHubTab = "mine" | "qna" | "excavate";

export type IdeaAiMode = "consult" | "excavate";

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

export function parseIdeaHubTab(value: string | null | undefined): IdeaHubTab {
  if (value === "qna" || value === "excavate") return value;
  // legacy: interviews / 取材 tab removed → land on my ideas
  return "mine";
}

export function parseIdeaAiMode(value: string | null | undefined): IdeaAiMode | null {
  if (value === "consult" || value === "excavate") return value;
  return null;
}
