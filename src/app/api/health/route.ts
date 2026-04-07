import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "moni",
    timestamp: new Date().toISOString(),
  });
}
