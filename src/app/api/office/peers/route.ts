import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbListPeers, dbReportPeer, dbVotePeer } from "@/lib/office/serverDb";
import { parseOfficeScene } from "@/lib/office/scenes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { IncidentType } from "@/lib/office/types";

function parseType(raw: string | null): IncidentType | null {
  const t = String(raw ?? "").trim();
  return ["pinch", "chance", "people", "rival"].includes(t) ? (t as IncidentType) : null;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const scene = parseOfficeScene(req.nextUrl.searchParams.get("scene"));
  const type = parseType(req.nextUrl.searchParams.get("type"));
  if (!scene || !type) {
    return NextResponse.json({ error: "scene/type required" }, { status: 400 });
  }
  try {
    const peers = await dbListPeers(admin, auth.userId, scene, type);
    return NextResponse.json({ peers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const body = (await req.json()) as {
      submissionId?: string;
      action?: "vote" | "report";
    };
    const submissionId = String(body.submissionId ?? "").trim();
    if (!submissionId) throw new Error("submissionId required");
    const peers =
      body.action === "report"
        ? await dbReportPeer(admin, auth.userId, submissionId)
        : await dbVotePeer(admin, auth.userId, submissionId);
    return NextResponse.json({ peers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
