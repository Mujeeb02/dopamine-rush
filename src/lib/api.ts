import { supabase, backendConfigured } from '@/integrations/supabase/client';
import type { Answer, Challenge, GameMode, GameResult } from './games';
export interface PlayerSummary {
  id:string;username:string;joined:string;onboarded:boolean;games:number;best:number;xp:number;play_ms:number;
  modes:number;current_streak:number;longest_streak:number;legacy_games:number;daily_completed:boolean;daily_progress:number;
  records:{game_mode:GameMode;best:number;games:number;average:number}[];
  recent:{id:string;game_mode:GameMode;score:number;created_at:string;duration_ms:number;xp_earned:number;verified:boolean}[];
  activity:{day:string;games:number}[];challenges:{challenge_day:string;reward:number}[];
}
export interface LeaderboardData {total:number;my_rank:number|null;entries:{user_id:string;username:string;score:number;place:number;created_at:string}[]}
export interface AnswerResponse {correct:boolean;completed:boolean;score?:number;result?:GameResult}
function requireBackend(){if(!backendConfigured)throw new Error('Online play is not configured. Practice is available.');}

// ── Temporary fallbacks: direct table queries until server functions are deployed ──
// These handle the PGRST202 ("function not found") error gracefully so
// profiles and leaderboards work even before the migration is applied.

async function playerFallback(id: string): Promise<PlayerSummary> {
  console.warn('[api] player_summary RPC unavailable — using client-side fallback. Apply the latest migration to enable server functions.');
  const { data: profile } = await supabase
    .from('profiles').select('id, username, created_at').eq('id', id).maybeSingle();
  if (!profile) throw new Error('Player not found');

  const { data: scores } = await supabase
    .from('game_scores').select('id, game_mode, score, streak, created_at')
    .eq('user_id', id).order('created_at', { ascending: false });
  const list = scores ?? [];

  // Per-mode aggregation
  const byMode = new Map<string, { games: number; best: number; total: number }>();
  for (const s of list) {
    const m = s.game_mode ?? 'classic';
    const v = byMode.get(m) ?? { games: 0, best: 0, total: 0 };
    v.games++; v.best = Math.max(v.best, s.score); v.total += s.score;
    byMode.set(m, v);
  }

  // Day streaks (consecutive UTC days with score > 0)
  const uniqueDays = [...new Set(
    list.filter(r => r.score > 0).map(r => new Date(r.created_at).toISOString().slice(0, 10))
  )].sort();
  const DAY = 86_400_000;
  let currentStreak = 0, longestStreak = 0, run = 0;
  for (let i = 0; i < uniqueDays.length; i++) {
    const gap = i === 0 ? 1
      : (new Date(uniqueDays[i] + 'T00:00Z').getTime() - new Date(uniqueDays[i - 1] + 'T00:00Z').getTime()) / DAY;
    run = gap === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  if (uniqueDays.length) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    const last = uniqueDays[uniqueDays.length - 1];
    if (last === today || last === yesterday) {
      currentStreak = 1;
      for (let i = uniqueDays.length - 2; i >= 0; i--) {
        if ((new Date(uniqueDays[i + 1] + 'T00:00Z').getTime() - new Date(uniqueDays[i] + 'T00:00Z').getTime()) === DAY)
          currentStreak++;
        else break;
      }
    }
  }

  // Activity last 14 days
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 14);
  const actMap = new Map<string, number>();
  for (const s of list) {
    if (new Date(s.created_at) >= cutoff) {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      actMap.set(d, (actMap.get(d) ?? 0) + 1);
    }
  }

  return {
    id: profile.id, username: profile.username ?? 'Player', joined: profile.created_at,
    onboarded: !!profile.username, games: list.length,
    best: Math.max(0, ...list.map(r => r.score)),
    xp: list.reduce((n, r) => n + r.score * 20, 0),
    play_ms: list.reduce((n, r) => n + r.score * 3500, 0),
    modes: byMode.size, current_streak: currentStreak, longest_streak: longestStreak,
    legacy_games: list.length, daily_completed: false, daily_progress: 0,
    records: [...byMode].map(([gm, v]) => ({
      game_mode: gm as GameMode, best: v.best, games: v.games,
      average: Math.round(v.total / v.games * 10) / 10,
    })),
    recent: list.slice(0, 20).map(r => ({
      id: r.id, game_mode: r.game_mode as GameMode, score: r.score,
      created_at: r.created_at, duration_ms: r.score * 3500, xp_earned: 0, verified: false,
    })),
    activity: [...actMap].map(([day, games]) => ({ day, games }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    challenges: [],
  };
}

async function leaderboardFallback(mode: string, period: string, offset: number): Promise<LeaderboardData> {
  console.warn('[api] get_leaderboard RPC unavailable — using client-side fallback.');
  let since: string | undefined;
  if (period !== 'all') {
    const d = new Date();
    if (period === 'day') d.setUTCHours(0, 0, 0, 0);
    else if (period === 'week') { d.setUTCDate(d.getUTCDate() - d.getUTCDay()); d.setUTCHours(0, 0, 0, 0); }
    else if (period === 'month') { d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
    since = d.toISOString();
  }
  let q = supabase.from('game_scores').select('user_id, score, created_at')
    .eq('game_mode', mode).order('score', { ascending: false });
  if (since) q = q.gte('created_at', since);
  const { data: scores } = await q;

  // Best score per user
  const best = new Map<string, { score: number; created_at: string }>();
  for (const r of scores ?? []) {
    const p = best.get(r.user_id);
    if (!p || r.score > p.score) best.set(r.user_id, { score: r.score, created_at: r.created_at });
  }

  // Fetch usernames
  const uids = [...best.keys()];
  const { data: profiles } = uids.length
    ? await supabase.from('profiles').select('id, username').in('id', uids)
    : { data: [] as { id: string; username: string | null }[] };
  const nameMap = new Map((profiles ?? []).map(p => [p.id, p.username ?? 'Player']));

  // Rank with shared places for ties
  const ranked = [...best].map(([uid, v]) => ({
    user_id: uid, ...v, username: nameMap.get(uid) ?? 'Player', place: 0,
  })).sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
  let pl = 0, prev = -1;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].score !== prev) { pl = i + 1; prev = ranked[i].score; }
    ranked[i].place = pl;
  }

  const { data: { user } } = await supabase.auth.getUser();
  return {
    total: ranked.length,
    my_rank: user ? ranked.find(r => r.user_id === user.id)?.place ?? null : null,
    entries: ranked.slice(offset, offset + 25).map(({ user_id, username, score, place, created_at }) =>
      ({ user_id, username, score, place, created_at })),
  };
}

// ── Public API ──

export const api={
  async start(mode:GameMode,request:string){requireBackend();const {data,error}=await supabase.rpc('start_game',{p_mode:mode,p_request:request});if(error)throw new Error(error.message.includes('wait')?'Too many new runs. Take a short break and try again.':'Could not start an online run. Please retry.');return data;},
  async round(id:string){const {data,error}=await supabase.rpc('get_game_round',{p_session:id});if(error)throw new Error('This round could not load. Retry, or start a new run.');return data as unknown as Challenge;},
  async answer(id:string,round:number,answer:Answer){const {data,error}=await supabase.rpc('answer_round',{p_session:id,p_round:round,p_answer:answer});if(error)throw new Error('Your answer could not be confirmed. Retry to recover this run.');return data as unknown as AnswerResponse;},
  async abandon(id:string){await supabase.rpc('abandon_game',{p_session:id});},
  async player(id:string){
    requireBackend();
    const {data,error}=await supabase.rpc('player_summary',{p_user:id});
    if(error){
      if(error.code==='PGRST202')return playerFallback(id);
      throw new Error('Player progress could not be loaded. Please try again.');
    }
    return data as unknown as PlayerSummary;
  },
  async leaderboard(mode:string,period:string,offset:number){
    requireBackend();
    const {data,error}=await supabase.rpc('get_leaderboard',{p_mode:mode,p_period:period,p_offset:offset});
    if(error){
      if(error.code==='PGRST202')return leaderboardFallback(mode,period,offset);
      throw new Error('The leaderboard is unavailable. Please try again.');
    }
    return data as unknown as LeaderboardData;
  },
  async updatePlayer(username:string){
    const {error}=await supabase.rpc('update_player',{p_username:username});
    if(error){
      if(error.code==='PGRST202'){
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)throw new Error('Sign in required');
        const {error:e}=await supabase.from('profiles')
          .update({username:username.trim(),updated_at:new Date().toISOString()})
          .eq('id',user.id);
        if(e)throw new Error('Your player name could not be saved. Please try again.');
        return;
      }
      throw new Error('Your player name could not be saved. Please try again.');
    }
  },
};
