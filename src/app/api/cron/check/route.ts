import { NextResponse } from "next/server";
import { getCronSecretFromEnv, verifyCronRequest } from "@/lib/auth/verifyCronSecret";

/** 本番で CRON_SECRET が読めているか・Bearer が合うか（値そのものは返さない） */
export async function GET(req: Request) {
  const configured = getCronSecretFromEnv().length > 0;
  const verified = verifyCronRequest(req);
  return NextResponse.json({
    configured,
    authorized: verified.ok,
    ...(verified.ok ? {} : { hint: verified.reason }),
    secretLength: configured ? getCronSecretFromEnv().length : 0,
  });
}
