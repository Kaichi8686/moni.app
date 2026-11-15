import { supabase, supabaseEnabled } from "@/lib/supabase";
import {
  localCreateCompany,
  localCurrentIncident,
  localGetCompany,
  localMarkResultSeen,
  localRanking,
  localSubmit,
  localToggleRanking,
} from "@/lib/office/localStore";
import type {
  OfficeCompany,
  OfficeIncident,
  OfficeSeasonScore,
  OfficeSubmission,
  RankingRow,
} from "@/lib/office/types";

const GUEST_ID = "local-guest";

export type CompanyPayload = {
  company: OfficeCompany | null;
  stamina: { value: number; nextRecoverAt: string | null };
  seasonRevenue: number;
  pendingResult: OfficeSeasonScore | null;
};

class LocalModeError extends Error {
  constructor() {
    super("LOCAL");
    this.name = "LocalModeError";
  }
}

async function accessToken(): Promise<string | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function shouldUseLocalFallback(err: unknown): boolean {
  if (err instanceof LocalModeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === "LOCAL" ||
    msg.includes("DB unavailable") ||
    msg.includes("ログインが必要") ||
    msg.includes("relation") ||
    msg.includes("office_companies") ||
    msg.includes("schema cache")
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  if (!token) throw new LocalModeError();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function fetchCompany(): Promise<CompanyPayload> {
  try {
    return await api<CompanyPayload>("/api/office/company");
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    const local = localGetCompany(GUEST_ID);
    return {
      company: local.company,
      stamina: {
        value: local.stamina.value,
        nextRecoverAt: local.stamina.nextRecoverAt?.toISOString() ?? null,
      },
      seasonRevenue: local.seasonRevenue,
      pendingResult: local.pendingResult,
    };
  }
}

export async function createCompany(name: string): Promise<OfficeCompany> {
  try {
    const res = await api<{ company: OfficeCompany }>("/api/office/company", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return res.company;
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    return localCreateCompany(GUEST_ID, name);
  }
}

export async function fetchIncident(): Promise<OfficeIncident> {
  try {
    const res = await api<{ incident: OfficeIncident }>("/api/office/incident/current", {
      method: "POST",
      body: "{}",
    });
    return res.incident;
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    return localCurrentIncident(GUEST_ID);
  }
}

export async function submitAnswer(answer: string): Promise<{
  submission: OfficeSubmission;
  company: OfficeCompany;
  seasonRevenue: number;
  stamina: { value: number; nextRecoverAt: string | null };
}> {
  try {
    return await api("/api/office/submit", {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    const r = await localSubmit(GUEST_ID, answer);
    return {
      submission: r.submission,
      company: r.company,
      seasonRevenue: r.seasonRevenue,
      stamina: {
        value: r.stamina.value,
        nextRecoverAt: r.stamina.nextRecoverAt?.toISOString() ?? null,
      },
    };
  }
}

export async function fetchRanking(): Promise<{
  seasonKey: string;
  leagueId: string;
  rows: RankingRow[];
  myRank: number | null;
  rankingEnabled: boolean;
}> {
  try {
    return await api("/api/office/ranking");
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    return localRanking(GUEST_ID);
  }
}

export async function toggleRanking(enabled: boolean): Promise<OfficeCompany> {
  try {
    const res = await api<{ company: OfficeCompany }>("/api/office/ranking/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    return res.company;
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    return localToggleRanking(GUEST_ID, enabled);
  }
}

export async function markResultSeen(seasonKey: string): Promise<void> {
  try {
    await api("/api/office/company", {
      method: "POST",
      body: JSON.stringify({ markResultSeen: seasonKey }),
    });
  } catch (e) {
    if (!shouldUseLocalFallback(e)) throw e;
    localMarkResultSeen(GUEST_ID, seasonKey);
  }
}
