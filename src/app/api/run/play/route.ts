import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { playRun, RunServiceError } from "@/lib/office/build/runService";
import { getServerRunStore } from "@/lib/office/build/serverStore";
import { judgeAdlib } from "@/lib/office/build/adlib";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const body = (await req.json()) as {
      run_id?: string;
      played_card_ids?: string[];
      adlib_text?: string;
    };
    if (!body.run_id || !Array.isArray(body.played_card_ids)) {
      throw new RunServiceError("run_id と played_card_ids が必要だよ");
    }
    const store = getServerRunStore(auth.userId);
    const result = await playRun(
      store,
      auth.userId,
      body.run_id,
      body.played_card_ids,
      body.adlib_text,
      judgeAdlib,
    );
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof RunServiceError ? e.status : 400;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status },
    );
  }
}
