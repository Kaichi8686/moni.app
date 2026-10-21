import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function findDirectId(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  peerId: string,
): Promise<string | null> {
  const { data: myMemberships } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const convIds = (myMemberships ?? []).map((m) => m.conversation_id as string);
  if (convIds.length === 0) return null;

  const { data: directs } = await admin
    .from("conversations")
    .select("id")
    .eq("type", "direct")
    .in("id", convIds);
  const directIds = (directs ?? []).map((c) => c.id as string);
  if (directIds.length === 0) return null;

  const { data: peerRows } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", peerId)
    .in("conversation_id", directIds)
    .limit(1);
  return (peerRows?.[0]?.conversation_id as string | undefined) ?? null;
}

async function canMessagePeer(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  peerId: string,
): Promise<boolean> {
  const { data: follow } = await admin
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("following_id", peerId)
    .maybeSingle();
  if (follow) return true;

  const [{ data: owned }, { data: mem }] = await Promise.all([
    admin.from("projects").select("id").eq("owner_id", userId).limit(80),
    admin.from("project_members").select("project_id").eq("user_id", userId).limit(80),
  ]);
  const projectIds = new Set<string>();
  for (const row of owned ?? []) projectIds.add(row.id as string);
  for (const row of mem ?? []) projectIds.add(row.project_id as string);
  if (projectIds.size === 0) return false;

  const ids = [...projectIds];
  const [{ data: ownedPeer }, { data: memPeer }] = await Promise.all([
    admin.from("projects").select("id").eq("owner_id", peerId).in("id", ids).limit(1),
    admin.from("project_members").select("project_id").eq("user_id", peerId).in("project_id", ids).limit(1),
  ]);
  return Boolean((ownedPeer ?? []).length || (memPeer ?? []).length);
}

async function createDirectAdmin(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  peerId: string,
): Promise<string | null> {
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ type: "direct", created_by: userId })
    .select("id")
    .single();
  if (convErr || !conv?.id) {
    console.error("api/messages/direct create conv", convErr);
    return null;
  }
  const convId = conv.id as string;
  const { error: memErr } = await admin.from("conversation_members").insert([
    { conversation_id: convId, user_id: userId, role: "admin" },
    { conversation_id: convId, user_id: peerId, role: "member" },
  ]);
  if (memErr) {
    console.error("api/messages/direct create members", memErr);
    return null;
  }
  return convId;
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "login_required", reason: "error" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json({ error: "supabase_unconfigured", reason: "error" }, { status: 503 });
  }

  let body: { peerUserId?: string };
  try {
    body = (await req.json()) as { peerUserId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body", reason: "error" }, { status: 400 });
  }
  const peerUserId = typeof body.peerUserId === "string" ? body.peerUserId.trim() : "";
  if (!peerUserId) {
    return NextResponse.json({ error: "peer_required", reason: "error" }, { status: 400 });
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const uid = userData.user?.id;
  if (userError || !uid) {
    return NextResponse.json({ error: "invalid_session", reason: "error" }, { status: 401 });
  }
  if (uid === peerUserId) {
    return NextResponse.json({ error: "invalid_peer", reason: "error" }, { status: 400 });
  }

  // Prefer user RPC (works when DB function allows one-way follow).
  const { data: rpcId, error: rpcErr } = await userClient.rpc("get_or_create_direct_conversation", {
    p_other_user_id: peerUserId,
  });
  if (!rpcErr && rpcId) {
    return NextResponse.json({ conversationId: rpcId as string });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "admin_unavailable", reason: "error", detail: rpcErr?.message ?? null },
      { status: 503 },
    );
  }

  const existing = await findDirectId(admin, uid, peerUserId);
  if (existing) {
    return NextResponse.json({ conversationId: existing });
  }

  const allowed = await canMessagePeer(admin, uid, peerUserId);
  if (!allowed) {
    return NextResponse.json({ error: "not_allowed", reason: "not_mutual" }, { status: 403 });
  }

  const created = await createDirectAdmin(admin, uid, peerUserId);
  if (!created) {
    return NextResponse.json({ error: "create_failed", reason: "error" }, { status: 500 });
  }
  return NextResponse.json({ conversationId: created });
}
