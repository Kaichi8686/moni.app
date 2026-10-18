/** Glide風プロジェクトホーム（キューブ一覧。未オープン時 / ?list=1） */
export const HOME_PROJECTS_HREF = "/projects";

/** ソーシャルホーム（検索タブなど。エントリはプロジェクト） */
export const APP_HOME_HREF = "/";

/** コミュニティ知恵袋（アイデアタブ内・掲示板ビュー） */
export const IDEA_QNA_HREF = "/idea?tab=qna&view=board";

export function projectOverviewHref(projectId: string) {
  return `/projects/${projectId}/overview`;
}

/** ボトムナビ「ホーム」用：開いたプロジェクトがあればそこへ、なければキューブ一覧 */
export function resolveHomeProjectsHref(lastProjectId?: string | null): string {
  if (lastProjectId) return projectOverviewHref(lastProjectId);
  return HOME_PROJECTS_HREF;
}

/** ログイン直後・アプリ再開時の最初の画面 */
export function resolveAppEntryHref(): string {
  return HOME_PROJECTS_HREF;
}
