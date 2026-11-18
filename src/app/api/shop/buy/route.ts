import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { buyShopItem, RunServiceError } from "@/lib/office/build/runService";
import {
  bootstrapCompanyIfNeeded,
  getServerRunStore,
} from "@/lib/office/build/serverStore";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    const body = (await req.json()) as { item_type?: string; id?: string };
    if (body.item_type !== "card" && body.item_type !== "employee") {
      throw new RunServiceError("item_type が不正だよ");
    }
    if (!body.id) throw new RunServiceError("id が必要だよ");
    const store = getServerRunStore(auth.userId);
    bootstrapCompanyIfNeeded(store, auth.userId);
    const result = buyShopItem(store, auth.userId, body.item_type, body.id);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof RunServiceError ? e.status : 400;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status },
    );
  }
}
