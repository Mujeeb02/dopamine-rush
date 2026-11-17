// Server-side read of a public RPC with the publishable key. Runs at the edge.
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  return res.ok ? (await res.json()) as T : null;
}
export interface PublicChallenge { slug: string; game_mode: string; expired: boolean; attempts: number; creator: { username: string; score: number; best_ms: number | null } }
