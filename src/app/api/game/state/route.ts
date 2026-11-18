import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { getGameState } from "@/lib/office/build/runService";
import {
  bootstrapCompanyIfNeeded,
  getServerRunStore,
} from "@/lib/office/build/serverStore";

export async function GET(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const store = getServerRunStore(auth.userId);
    bootstrapCompanyIfNeeded(store, auth.userId);
    const state = getGameState(store, auth.userId);
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
