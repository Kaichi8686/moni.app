import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { diagnoseRun, RunServiceError } from "@/lib/office/build/runService";
import { getServerRunStore } from "@/lib/office/build/serverStore";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const body = (await req.json()) as { run_id?: string; hypothesis_id?: string };
    if (!body.run_id || !body.hypothesis_id) {
      throw new RunServiceError("run_id と hypothesis_id が必要だよ");
    }
    const store = getServerRunStore(auth.userId);
    const result = diagnoseRun(store, auth.userId, body.run_id, body.hypothesis_id);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof RunServiceError ? e.status : 400;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status },
    );
  }
}
