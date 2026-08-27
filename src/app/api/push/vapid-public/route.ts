import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json({ publicKey: null, error: "VAPID not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
