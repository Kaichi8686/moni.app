/** Vercel Cron / 手動 curl 用の秘密検証 */

function normalizeSecret(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function extractBearer(authHeader: string | null): string {
  if (!authHeader) return "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function getCronSecretFromEnv(): string {
  return normalizeSecret(process.env.CRON_SECRET);
}

export function verifyCronRequest(req: Request): { ok: true } | { ok: false; reason: string } {
  const secret = getCronSecretFromEnv();
  if (!secret) {
    return { ok: false, reason: "CRON_SECRET is not set on this deployment" };
  }

  const auth = req.headers.get("authorization");
  const bearer = extractBearer(auth);
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  const querySecret = new URL(req.url).searchParams.get("secret")?.trim() ?? "";

  const candidate = bearer || headerSecret || querySecret;
  if (!candidate) {
    return { ok: false, reason: "Missing Authorization: Bearer … or x-cron-secret header" };
  }

  if (candidate !== secret) {
    return { ok: false, reason: "Secret mismatch" };
  }

  return { ok: true };
}
