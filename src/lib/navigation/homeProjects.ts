/** Glide風プロジェクトホーム */
export const HOME_PROJECTS_HREF = "/projects";

/** ソーシャルホーム（検索タブなど。エントリはプロジェクト） */
export const APP_HOME_HREF = "/";

/** 質問・相談（アイデアタブ内） */
export const IDEA_QNA_HREF = "/idea?tab=qna";

export function projectOverviewHref(projectId: string) {
  return `/projects/${projectId}/overview`;
}

/** ログイン直後・アプリ再開時の最初の画面 */
export function resolveAppEntryHref(): string {
  return HOME_PROJECTS_HREF;
}
