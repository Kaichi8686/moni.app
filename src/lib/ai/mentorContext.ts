export type MentorClientContext = {
  displayName?: string;
  grade?: string;
  school?: string;
  projectName?: string;
  businessType?: string;
  phaseTitle?: string;
  phaseGoal?: string;
  completedTasks?: string[];
  pendingTasks?: string[];
  recentPosts?: string[];
  milestones?: string[];
};

export function buildMentorSystemExtension(ctx: MentorClientContext | null | undefined): string {
  if (!ctx) return "";
  const lines: string[] = [
    "",
    "【担当学生のコンテキスト（moniから）】",
    `名前: ${ctx.displayName?.trim() || "（未設定）"}`,
  ];
  if (ctx.grade || ctx.school) lines.push(`学年・学校: ${[ctx.grade, ctx.school].filter(Boolean).join(" / ")}`);
  if (ctx.projectName) {
    lines.push(`プロジェクト: ${ctx.projectName}${ctx.businessType ? `（${ctx.businessType}）` : ""}`);
  }
  if (ctx.phaseTitle) lines.push(`現在のフェーズ: ${ctx.phaseTitle}`);
  if (ctx.phaseGoal) lines.push(`フェーズのゴール: ${ctx.phaseGoal}`);
  if (ctx.completedTasks?.length) lines.push(`完了タスク: ${ctx.completedTasks.slice(0, 8).join("、")}`);
  if (ctx.pendingTasks?.length) lines.push(`未完了タスク: ${ctx.pendingTasks.slice(0, 8).join("、")}`);
  if (ctx.milestones?.length) lines.push(`マイルストーン: ${ctx.milestones.slice(0, 6).join("、")}`);
  if (ctx.recentPosts?.length) lines.push(`最近の投稿: ${ctx.recentPosts.slice(0, 3).join(" | ")}`);

  lines.push(
    "",
    "【メンターとしての役割】",
    "1. 渡された進捗・課題を踏まえ、状況に即した具体例で話す",
    "2. 今日何をすべきか、動詞で1つ提案できる",
    "3. 詰まったら次の一手と逃げ道をセットで示す",
    "4. 成功したら具体的に認め、次の小さな一歩を示す",
    "5. 税務・法律・医療は専門家相談を勧める",
    "話し方: タメ口と丁寧語の中間、深掘り質問は最大1つ、抽象論より「○○を▲▲までにやる」",
  );
  return lines.join("\n");
}
