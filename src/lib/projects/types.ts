export type ProjectVisibility = "public" | "private";
export type ProjectRole = "owner" | "admin" | "member";
export type JoinRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  business_type?: "maker" | "software" | "social" | null;
  tags: string[];
  thumbnail_url: string | null;
  visibility: ProjectVisibility;
  recruitment_target: string;
  recruitment_message: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
};

/** project_tasks.meta に保存（タスク画面の入力種別・回答） */
export type ProjectTaskMeta = {
  inputKind?: "choice" | "text" | "none";
  choiceOptions?: string[];
  placeholder?: string;
  /** ユーザーが送信した回答（選択ラベルまたは自由記述） */
  answer?: string;
};

export type ProjectTaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  /** ロードマップの「段階」に紐づく具体タスク（任意） */
  roadmap_step_id?: string | null;
  meta?: ProjectTaskMeta | Record<string, unknown> | null;
  created_by: string;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
};
