const DEFAULT_ADMIN_EMAILS = ["kigyouman8686@gmail.com"];

function parseAdminEmails(): string[] {
  const raw = process.env.APP_ADMIN_EMAILS?.trim();
  if (!raw) return DEFAULT_ADMIN_EMAILS;
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAppAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return parseAdminEmails().includes(normalized);
}

export function isAppAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isAppAdminUser(params: {
  email?: string | null;
  role?: string | null;
}): boolean {
  return isAppAdminRole(params.role) || isAppAdminEmail(params.email);
}

/** 記事の下書き閲覧・通報対応など、従来の investor 権限 */
export function canModerateContent(role: string | null | undefined): boolean {
  return role === "investor" || role === "admin";
}
