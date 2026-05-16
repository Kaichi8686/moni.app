import type { TaskWorkStatus } from "@/lib/projects/taskStatus";

export type ProjectVisibility = "public" | "private";
export type ProjectRole = "owner" | "admin" | "member";
export type JoinRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

/** project_tasks.status（マイグレーション後）。レガシー todo/doing は normalize で吸収 */
export type TaskStatus = TaskWorkStatus;
export type TaskPriority = "low" | "medium" | "high";

export type TodayThreeSlot = "important" | "quick" | "consult";

export type BlockedReasonCode =
  | "unknown_how"
  | "need_help"
  | "missing_info"
  | "no_time"
  | "low_confidence";

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
  /** 伴走UI・オンボーディング（JSON）。カラム未適用時は欠落しうる */
  coaching_context?: unknown;
};

export type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
};

/** project_tasks.meta に保存（タスク画面の入力種別・回答・伴走フィールド） */
export type ProjectTaskMeta = {
  inputKind?: "choice" | "text" | "none";
  choiceOptions?: string[];
  placeholder?: string;
  /** ユーザーが送信した回答（選択ラベルまたは自由記述） */
  answer?: string;
  /** 回答の見え方: shared=全員 / private=投稿者と回答者のみ */
  answerVisibility?: "shared" | "private";
  answeredBy?: string;
  answeredAt?: string;
  /** 見積もり時間（分）。UIは 5/15/30/60 の選択 */
  estimatedMinutes?: 5 | 15 | 30 | 60;
  /** 完了の判断基準（短文） */
  completionCriteria?: string;
  /** このタスクが意味すること・なぜそれが効くか */
  whyThisMatters?: string;
  /** 完了直後の一言メモ・学び */
  lastReflection?: string;
  /** 「今日の3つ」のどれに固定するか（任意） */
  todaySlot?: TodayThreeSlot;
  /** 相談系タスクのヒント（任意・検索用） */
  consultHint?: string;
  /** blocked 時の理由カテゴリ（Phase 2） */
  blockedReasonCode?: BlockedReasonCode;
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
