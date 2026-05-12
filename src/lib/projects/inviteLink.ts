/**
 * 共有・コピー用の絶対URL（招待リンク）。
 * 本番は NEXT_PUBLIC_SITE_URL、プレビューはブラウザの origin を優先。
 */
export function projectPageAbsoluteUrl(projectId: string): string {
  let origin = "";
  if (typeof window !== "undefined" && window.location?.origin) {
    origin = window.location.origin;
  }
  if (!origin) {
    const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    if (env) origin = env;
  }
  if (!origin) origin = "https://dream-spark-pro.vercel.app";
  return `${origin}/projects/${encodeURIComponent(projectId)}`;
}

export function projectInviteShareText(projectName: string, projectId: string): string {
  const url = projectPageAbsoluteUrl(projectId);
  return `「${projectName || "プロジェクト"}」に参加する（moni）\n${url}`;
}

/** Web Share API 用：URL は別フィールドに渡す想定の短い文 */
export function projectInviteShareCaption(projectName: string): string {
  return `moni のプロジェクト「${projectName || "（無題）"}」。開いてメンバータブから参加申請できます（公開の場合）。`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** プロジェクト詳細URLのみコピー */
export async function copyProjectInviteUrl(projectId: string): Promise<boolean> {
  return copyTextToClipboard(projectPageAbsoluteUrl(projectId));
}

export async function shareOrCopyProject(projectName: string, projectId: string): Promise<"shared" | "copied" | "failed"> {
  const url = projectPageAbsoluteUrl(projectId);
  const fallbackBlock = projectInviteShareText(projectName, projectId);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `${projectName || "プロジェクト"} | moni`,
        text: projectInviteShareCaption(projectName),
        url,
      });
      return "shared";
    }
    const ok = await copyTextToClipboard(fallbackBlock);
    return ok ? "copied" : "failed";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "shared";
    const ok = await copyTextToClipboard(fallbackBlock);
    return ok ? "copied" : "failed";
  }
}
