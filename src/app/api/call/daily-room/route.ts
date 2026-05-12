import { NextResponse } from "next/server";

const DAILY_API_BASE = (process.env.DAILY_API_BASE ?? "https://api.daily.co/v1").trim();

function sanitizeRoomName(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `moni-${cleaned || Math.random().toString(36).slice(2, 10)}`.slice(0, 63);
}

async function dailyRequest(path: string, init: RequestInit, apiKey: string) {
  const res = await fetch(`${DAILY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  return res;
}

export async function POST(req: Request) {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  const dailyDomain = process.env.DAILY_DOMAIN?.trim();

  if (!apiKey || !dailyDomain) {
    return NextResponse.json(
      { error: "DAILY_API_KEY / DAILY_DOMAIN が未設定です。", hint: "Vercelの環境変数を確認してください。" },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { roomSeed?: string; userName?: string };
    const roomName = sanitizeRoomName(body.roomSeed ?? "");
    const userName = (body.userName ?? "moni user").trim().slice(0, 80);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 6; // 6 hours

    const createRes = await dailyRequest(
      "/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp,
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
            eject_at_room_exp: true,
          },
        }),
      },
      apiKey,
    );

    let roomUrl = "";
    if (createRes.ok) {
      const created = (await createRes.json()) as { url?: string };
      roomUrl = created.url ?? "";
    } else if (createRes.status === 409) {
      const getRes = await dailyRequest(`/rooms/${roomName}`, { method: "GET" }, apiKey);
      if (!getRes.ok) {
        const detail = await getRes.text();
        return NextResponse.json({ error: "Dailyルーム取得に失敗しました。", detail }, { status: 502 });
      }
      const existing = (await getRes.json()) as { url?: string };
      roomUrl = existing.url ?? "";
    } else {
      const detail = await createRes.text();
      return NextResponse.json({ error: "Dailyルーム作成に失敗しました。", detail }, { status: 502 });
    }

    const normalizedDomain = dailyDomain.startsWith("http") ? dailyDomain : `https://${dailyDomain}`;
    const fallbackUrl = `${normalizedDomain.replace(/\/$/, "")}/${roomName}`;
    const baseRoomUrl = roomUrl || fallbackUrl;

    const tokenRes = await dailyRequest(
      "/meeting-tokens",
      {
        method: "POST",
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: userName,
            is_owner: true,
            exp,
            eject_after_elapsed: 60 * 60 * 3,
          },
        }),
      },
      apiKey,
    );

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return NextResponse.json({ error: "Dailyトークン発行に失敗しました。", detail }, { status: 502 });
    }
    const tokenData = (await tokenRes.json()) as { token?: string };
    if (!tokenData.token) {
      return NextResponse.json({ error: "Dailyトークンの取得に失敗しました。" }, { status: 502 });
    }
    const safeToken = encodeURIComponent(tokenData.token);

    return NextResponse.json({
      roomName: roomName.toUpperCase(),
      roomUrl: `${baseRoomUrl}?t=${safeToken}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "通話ルーム作成中にエラーが発生しました。", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
