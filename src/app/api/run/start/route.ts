import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { RunServiceError, startRun } from "@/lib/office/build/runService";
import {
  bootstrapCompanyIfNeeded,
  getServerRunStore,
} from "@/lib/office/build/serverStore";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const body = (await req.json()) as { mode?: string };
    const mode = body.mode === "free" ? "free" : body.mode === "daily" ? "daily" : null;
    if (!mode) throw new RunServiceError("mode は daily か free だよ");
    const store = getServerRunStore(auth.userId);
    bootstrapCompanyIfNeeded(store, auth.userId);
    const result = startRun(store, auth.userId, mode);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof RunServiceError ? e.status : 400;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status },
    );
  }
}
