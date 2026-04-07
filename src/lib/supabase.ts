import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anonKey);

type GlobalWithSupabase = typeof globalThis & { __moniSupabaseClient?: SupabaseClient };

/** ブラウザでは Web Locks を使わず即実行。React Strict Mode の二重マウントと競合しないようにする */
function createMoniClient(): SupabaseClient {
  const browserAuthLock =
    typeof window !== "undefined"
      ? async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn()
      : undefined;
  return createClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(browserAuthLock ? { lock: browserAuthLock } : {}),
    },
  });
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
