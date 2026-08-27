import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:hello@moni.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) return { sent: 0, failed: 0 };
  const admin = getSupabaseAdmin();
  if (!admin) return { sent: 0, failed: 0 };

  const { data: rows } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth_key").eq("user_id", userId);
  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  for (const row of rows ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint as string,
          keys: { p256dh: row.p256dh as string, auth: row.auth_key as string },
        },
        body,
      );
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
