import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Trophy, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { gameById } from '@/lib/games';
import { dailyChallenge } from '@/lib/progression';
import { headlineNumber } from '@/lib/share';
import { useAuth } from '@/hooks/useAuth';
import { backendConfigured } from '@/integrations/supabase/client';
import { ErrorState, Loading, Empty } from '@/components/platform/Platform';
import { GameRun } from './Game';

/** One seeded run per day, the same rounds for everyone. The first attempt is the one that counts. */
export default function Daily(){
  const {user}=useAuth();
  const query=useQuery({queryKey:['daily',user?.id],queryFn:()=>api.daily(0),enabled:backendConfigured,staleTime:30000});
  const fallback=dailyChallenge();
  const game=gameById(query.data?.game_mode)??fallback.game;
  useEffect(()=>{document.title=`Daily challenge${query.data?` #${query.data.number}`:''} · Dopamine Rush`;},[query.data]);
  if(backendConfigured&&query.isPending)return <div className="page"><Loading label="Loading today’s challenge…"/></div>;
  if(query.error)return <div className="page"><ErrorState message={(query.error as Error).message} onRetry={()=>void query.refetch()}/></div>;
  const d=query.data;
  const intro=<><span className="daily-number"><CalendarDays size={14}/> DAILY{d?` #${d.number}`:''} · {fallback.day}</span>
    <h1>{game.name}<span className="accent-dot">.</span></h1>
    <p className="lead">Everyone gets the same rounds today. Your first run is the one that counts on today’s board, so make it a good one. Clear 5 rounds for +{fallback.reward} XP.</p>
    {d?.mine&&<p className="tiny">Today you scored {headlineNumber(game.id,d.mine).value} · #{d.mine.place} of {d.players}. Replays are for fun and don’t change your place.</p>}</>;
  return <>
    {backendConfigured?<GameRun key={`${d?.day}-${game.id}`} game={game} kind="daily" intro={intro}/>:<div className="page"><Empty title="Daily challenge needs the online service." detail="Practice is still available." action={<Link className="button" to={`/game/${game.id}`}>Practice {game.name}</Link>}/></div>}
    {d&&<section className="page"><div className="section-heading"><div><span className="eyebrow"><Trophy size={14}/> TODAY’S BOARD</span><h2>{d.players?`${d.players} ${d.players===1?'player':'players'} so far`:'Be the first today'}</h2></div><Link className="text-link" to="/leaderboard">All-time boards<ArrowUpRight size={16}/></Link></div>
      {d.entries.length?<div className="daily-board">{d.entries.map(e=><div key={e.user_id} className={`board-row ${e.user_id===user?.id?'is-you':''}`}><strong>{e.place}</strong><span>{e.username}{e.user_id===user?.id&&<small>YOU</small>}</span><strong>{headlineNumber(game.id,e).value}</strong></div>)}</div>
      :<p className="muted">No one has played today’s challenge yet. The first score sets the bar.</p>}</section>}
  </>;
}
