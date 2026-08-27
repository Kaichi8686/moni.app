import type { SupabaseClient } from "@supabase/supabase-js";

/** Realtime がログイン後の JWT を使うようにする */
export async function ensureRealtimeAuth(client: SupabaseClient): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    client.realtime.setAuth(token);
  }
}
