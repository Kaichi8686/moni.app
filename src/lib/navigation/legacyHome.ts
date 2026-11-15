import { HOME_PROJECTS_HREF, IDEA_QNA_HREF } from "@/lib/navigation/homeProjects";

/** 探す（旧ホーム ?tab=chat） */
export const DISCOVER_HREF = "/discover";

/** アイデア / AI（旧ホーム ?tab=mentor|articles） */
export const IDEA_HOME_HREF = "/idea";

/**
 * 旧 `/` + ?tab= / ?mentor= / ?community= を現行ルートへ写す。
 * LP（landing/about）のときは null（リダイレクトしない）。
 */
export function resolveLegacyHomeRedirect(
  params: URLSearchParams,
  fallback: string = HOME_PROJECTS_HREF,
): string | null {
  if (params.get("landing") === "1" || params.get("about") === "1") return null;

  const tab = params.get("tab");
  const community = params.get("community");
  const mentor = params.get("mentor");

  if (tab === "account") return "/profile";
  if (tab === "projects" || community === "progress") return HOME_PROJECTS_HREF;
  if (tab === "posts" || community === "qna") return IDEA_QNA_HREF;
  if (tab === "chat" || tab === "discovery") return DISCOVER_HREF;
  if (tab === "mentor" || tab === "articles" || mentor) return IDEA_HOME_HREF;

  // 未知の tab でも旧シェルを出さずプロジェクトへ
  if (tab) return HOME_PROJECTS_HREF;

  return fallback;
}
