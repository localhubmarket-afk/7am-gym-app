import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

declare global {
  interface Window {
    __SUPABASE_PUBLIC_CONFIG__?: Partial<SupabasePublicConfig>;
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigSignature = '';

function readPublicSupabaseConfig(): SupabasePublicConfig | null {
  let url = '';
  let anonKey = '';

  // 1. Standard Vite client environment variables (VITE_*)
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv) {
      url = String(metaEnv.VITE_SUPABASE_URL || '').trim();
      anonKey = String(metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();
    }
  } catch {
    // Non-Vite runtime (e.g. Node unit tests)
  }

  // 2. Optional runtime public config injected into window (anon key only)
  if ((!url || !anonKey) && typeof window !== 'undefined' && window.__SUPABASE_PUBLIC_CONFIG__) {
    url = url || String(window.__SUPABASE_PUBLIC_CONFIG__.url || '').trim();
    anonKey = anonKey || String(window.__SUPABASE_PUBLIC_CONFIG__.anonKey || '').trim();
  }

  // Reject placeholder values from env.example
  if (
    !url ||
    !anonKey ||
    url.includes('your-project-id') ||
    anonKey.includes('your_supabase_')
  ) {
    return null;
  }

  return { url, anonKey };
}

/**
 * Returns a singleton Supabase client configured for Realtime Postgres Changes.
 * Returns `null` cleanly when public Supabase env vars are not set so the PWA
 * gracefully falls back to local-only storage + REST sync without crashing.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const cfg = readPublicSupabaseConfig();
  if (!cfg) return null;

  const signature = `${cfg.url}::${cfg.anonKey.slice(0, 12)}`;
  if (cachedClient && cachedConfigSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 5
      }
    }
  });
  cachedConfigSignature = signature;
  return cachedClient;
}

export function isSupabaseRealtimeConfigured(): boolean {
  return Boolean(readPublicSupabaseConfig());
}

/**
 * Matches the exact row `id` convention used by `/api/state.js` in the `gym_state` table:
 * - Signed-in email: `user_<lowercase_email>`
 * - Guest / shared default row: `default`
 */
export function resolveGymStateRecordId(email?: string | null): string {
  const clean = String(email || '').trim().toLowerCase();
  if (clean && clean !== 'default' && clean.includes('@')) {
    return `user_${clean}`;
  }
  return 'default';
}
