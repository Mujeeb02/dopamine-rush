import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Zap, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { gameById } from '@/lib/games';
import { track } from '@/lib/analytics';
import { headlineNumber } from '@/lib/share';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState, Loading } from '@/components/platform/Platform';
import { GameRun } from './Game';

/** A friend's run, replayed with the exact same rounds. No sign-up needed to play. */
export default function ChallengeLink(){
  const {slug=''}=useParams();const {user}=useAuth();
  const query=useQuery({queryKey:['challenge',slug,user?.id],queryFn:()=>api.challenge(slug),retry:false,staleTime:15000});
  const game=gameById(query.data?.game_mode);
  useEffect(()=>{track('challenge_opened',{slug});},[slug]);
  useEffect(()=>{if(game&&query.data)document.title=`Beat ${query.data.creator.username} at ${game.name} · Dopamine Rush`;},[game,query.data]);
  if(query.isPending)return <div className="page"><Loading label="Loading the challenge…"/></div>;
  if(query.error||!query.data||!game)return <div className="page"><ErrorState message={(query.error as Error)?.message??'This challenge link is not valid.'}/><Link className="button" to="/game">Play something else</Link></div>;
  const c=query.data;const own=user?.id===c.creator.user_id;const target=headlineNumber(game.id,c.creator);
  if(c.expired)return <div className="page"><ErrorState message="This challenge has expired. Challenges stay open for 30 days."/><Link className="button" to={`/game/${game.id}`}>Play {game.name}</Link></div>;
  const intro=<><span className="eyebrow"><Zap size={14}/> {own?'YOUR CHALLENGE':'YOU’VE BEEN CHALLENGED'}</span>
    <h1>{own?'Your challenge is live.':<>Beat {c.creator.username}<span className="accent-dot">.</span></>}</h1>
    <p className="lead">{c.creator.username} scored <strong>{target.value}</strong> {target.label} in {game.name}. You get the exact same rounds.{c.attempts?` ${c.attempts} ${c.attempts===1?'person has':'people have'} tried so far.`:''}</p>
    {c.mine&&<p className="tiny">Your first attempt: {headlineNumber(game.id,c.mine).value}. Only first attempts count on this challenge.</p>}</>;
  return <>
    <GameRun key={slug} game={game} kind="challenge" slug={slug} intro={intro} opponent={own?undefined:{username:c.creator.username,score:c.creator.score,best_ms:c.creator.best_ms}}/>
    <section className="page challenge-section"><div className="section-heading"><div><span className="eyebrow"><Trophy size={14}/> THIS CHALLENGE</span><h2>Who has taken it on</h2></div></div>
      <div className="challenge-board">{c.entries.map((e,i)=><div key={e.user_id} className={`board-row ${e.user_id===user?.id?'is-you':''}`}><strong>{i+1}</strong><span>{e.username}{e.creator&&<small>CREATOR</small>}{e.user_id===user?.id&&<small>YOU</small>}</span><strong>{headlineNumber(game.id,e).value}</strong></div>)}</div>
    </section></>;
}
