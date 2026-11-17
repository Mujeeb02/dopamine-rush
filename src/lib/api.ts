import { supabase, backendConfigured } from '@/integrations/supabase/client';
import type { Answer, Challenge, GameMode, GameResult } from './games';
export interface PlayerSummary {
  id:string;username:string;joined:string;onboarded:boolean;games:number;best:number;xp:number;play_ms:number;
  modes:number;current_streak:number;longest_streak:number;legacy_games:number;daily_completed:boolean;daily_progress:number;
  records:{game_mode:GameMode;best:number;best_ms?:number|null;games:number;average:number}[];
  recent:{id:string;game_mode:GameMode;score:number;created_at:string;duration_ms:number;xp_earned:number;verified:boolean;best_ms?:number|null;kind?:string}[];
  activity:{day:string;games:number}[];challenges:{challenge_day:string;reward:number}[];
}
export interface LeaderboardData {total:number;my_rank:number|null;entries:{user_id:string;username:string;score:number;best_ms?:number|null;place:number;created_at:string}[]}
export interface ChallengeData {slug:string;game_mode:GameMode;expired:boolean;created_at:string;attempts:number;
  creator:{user_id:string;username:string;score:number;best_ms:number|null};mine:{score:number;best_ms:number|null}|null;
  entries:{user_id:string;username:string;score:number;best_ms:number|null;creator:boolean}[]}
export interface DailyData {day:string;number:number;game_mode:GameMode;players:number;attempted:boolean;
  mine:{score:number;best_ms:number|null;place:number}|null;entries:{user_id:string;username:string;score:number;best_ms:number|null;place:number}[]}
export interface AnswerResponse {correct:boolean;completed:boolean;score?:number;ms?:number|null;result?:GameResult}
export class GuestUnavailable extends Error{constructor(){super('Guest play is not available right now. Practice still works, or sign in to save scores.');}}
function requireBackend(){if(!backendConfigured)throw new Error('Online play is not configured. Practice is available.');}

// ── Public API ──

export const api={
  /** Makes sure there is a session to verify runs against: signs a guest in anonymously if needed. */
  async ensureSession(){
    requireBackend();
    const {data:{session}}=await supabase.auth.getSession();if(session)return session.user;
    const {data,error}=await supabase.auth.signInAnonymously();
    if(error||!data.user)throw new GuestUnavailable();
    return data.user;
  },
  async start(mode:GameMode,request:string,kind:'standard'|'daily'|'challenge'='standard',challenge?:string){
    requireBackend();
    const {data,error}=await supabase.rpc('start_game',{p_mode:mode,p_request:request,p_kind:kind,p_challenge:challenge??null});
    if(error){
      if(error.message.includes('wait'))throw new Error('Too many new runs. Take a short break and try again.');
      if(error.message.includes('Challenge not found'))throw new Error('This challenge has expired or does not exist.');
      if(error.message.includes('today'))throw new Error('Today’s challenge has changed. Refresh to get the new one.');
      throw new Error('Could not start an online run. Please retry.');
    }
    return data as string;
  },
  async createChallenge(scoreId:string){const {data,error}=await supabase.rpc('create_challenge',{p_score:scoreId});if(error)throw new Error('This run could not be turned into a challenge. Please retry.');return data as string;},
  async challenge(slug:string){requireBackend();const {data,error}=await supabase.rpc('get_challenge',{p_slug:slug});if(error)throw new Error(error.message.includes('not found')?'This challenge link is not valid.':'The challenge could not load. Please retry.');return data as unknown as ChallengeData;},
  async daily(offset=0){requireBackend();const {data,error}=await supabase.rpc('get_daily',{p_offset:offset});if(error)throw new Error('Today’s challenge could not load. Please retry.');return data as unknown as DailyData;},
  async round(id:string){const {data,error}=await supabase.rpc('get_game_round',{p_session:id});if(error)throw new Error('This round could not load. Retry, or start a new run.');return data as unknown as Challenge;},
  async answer(id:string,round:number,answer:Answer){const {data,error}=await supabase.rpc('answer_round',{p_session:id,p_round:round,p_answer:answer});if(error)throw new Error('Your answer could not be confirmed. Retry to recover this run.');return data as unknown as AnswerResponse;},
  async abandon(id:string){await supabase.rpc('abandon_game',{p_session:id});},
  async player(id:string){
    requireBackend();
    const {data,error}=await supabase.rpc('player_summary',{p_user:id});
    if(error)throw new Error('Player progress could not be loaded. Please try again.');
    return data as unknown as PlayerSummary;
  },
  async leaderboard(mode:string,period:string,offset:number){
    requireBackend();
    const {data,error}=await supabase.rpc('get_leaderboard',{p_mode:mode,p_period:period,p_offset:offset});
    if(error)throw new Error('The leaderboard is unavailable. Please try again.');
    return data as unknown as LeaderboardData;
  },
  async updatePlayer(username:string){
    const {error}=await supabase.rpc('update_player',{p_username:username});
    if(error)throw new Error(error.message.includes('Use 3 to 24')?error.message:'Your player name could not be saved. Please try again.');
  },
};
