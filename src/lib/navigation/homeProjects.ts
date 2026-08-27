/** Glide風プロジェクトホーム */
export const HOME_PROJECTS_HREF = "/projects";

/** ソーシャルホーム（投稿フィード） */
export const APP_HOME_HREF = "/";

export function projectOverviewHref(projectId: string) {
  return `/projects/${projectId}/overview`;
}

/** ログイン直後・アプリ再開時の最初の画面 */
export function resolveAppEntryHref(): string {
  return HOME_PROJECTS_HREF;
}
