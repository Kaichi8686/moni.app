import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const accessLog = new Map<string, number[]>();

export async function GET() {
  const now = Date.now();
  const key = "global";
  const recent = (accessLog.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(MAX_PER_WINDOW),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-WindowMs": String(WINDOW_MS),
        },
      },
    );
  }
  recent.push(now);
  accessLog.set(key, recent);

  return NextResponse.json({
    ok: true,
    service: "moni",
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-RateLimit-Limit": String(MAX_PER_WINDOW),
      "X-RateLimit-Remaining": String(Math.max(0, MAX_PER_WINDOW - recent.length)),
      "X-RateLimit-WindowMs": String(WINDOW_MS),
    },
  });
}
