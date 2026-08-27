import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

type GlobalWithSupabase = typeof globalThis & { __moniSupabaseClient?: SupabaseClient };

function createMoniClient(): SupabaseClient {
  const client = createClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
  if (typeof window !== "undefined") {
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        client.realtime.setAuth(session.access_token);
      }
    });
  }
  return client;
}

function getClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (typeof window === "undefined") {
    return createMoniClient();
  }
  const g = globalThis as GlobalWithSupabase;
  g.__moniSupabaseClient ??= createMoniClient();
  return g.__moniSupabaseClient;
}

export const supabase: SupabaseClient | null = supabaseEnabled ? getClient() : null;
