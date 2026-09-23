import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, Trophy, ShieldCheck, RotateCcw, Share2, Star, Check, Zap } from 'lucide-react';
import GameGrid from '@/components/GameGrid';
import { GameArt, ErrorState, Loading, XpProgress } from '@/components/platform/Platform';
import { gameById, games, type Answer, type Challenge, type GameResult, type RoundProps } from '@/lib/games';
import { api } from '@/lib/api';
import { answerMatches, practiceHistory, practiceRound, savePractice } from '@/lib/practice';
import { durationLabel } from '@/lib/progression';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { playTone, useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import RatingDialog from '@/components/ui/rating-dialog';
const FreezeFrame=lazy(()=>import('@/components/games/FreezeFrame'));
const ReverseSequence=lazy(()=>import('@/components/games/ReverseSequence'));
const QuickReflex=lazy(()=>import('@/components/games/QuickReflex'));
const TrailTracker=lazy(()=>import('@/components/games/TrailTracker'));
const PaletteRecall=lazy(()=>import('@/components/games/PaletteRecall'));
const SpeedTypist=lazy(()=>import('@/components/games/SpeedTypist'));
const renderers={classic:GameGrid,'freeze-frame':FreezeFrame,'reverse-sequence':ReverseSequence,'quick-reflex':QuickReflex,'trail-tracker':TrailTracker,'palette-recall':PaletteRecall,'speed-typist':SpeedTypist};
type Phase='ready'|'countdown'|'loading'|'playing'|'feedback'|'result'|'error';
function GameRun({game}:{game:typeof games[number]}){
  const {user,loading:authLoading}=useAuth();const player=usePlayer();const cache=useQueryClient();const {settings}=useSettings();
  const [phase,setPhase]=useState<Phase>('ready'),[score,setScore]=useState(0),[countdown,setCountdown]=useState(3);
  const [ranked,setRanked]=useState(false),[challenge,setChallenge]=useState<Challenge|null>(null),[result,setResult]=useState<GameResult|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[shareMessage,setShareMessage]=useState(''),[reviewOpen,setReviewOpen]=useState(false),[reviewError,setReviewError]=useState('');
  const run=useRef({session:'',request:'',generation:0,online:false,start:0,expected:null as Answer|null,locked:false});
  const retry=useRef<()=>Promise<void>>(async()=>{});const timer=useRef<ReturnType<typeof setTimeout>>();
  const storedBest=Math.max(0,...practiceHistory().filter(r=>r.game_mode===game.id).map(r=>r.score));
  const best=ranked?(player.data?.records.find(r=>r.game_mode===game.id)?.best??0):storedBest;
  useEffect(()=>{if(phase==='ready')setRanked(!!user);},[user,phase]);
  useEffect(()=>{const state=run.current;return()=>{state.generation++;clearTimeout(timer.current);if(state.session)void api.abandon(state.session);document.body.removeAttribute('data-playing');};},[]);
  useEffect(()=>{document.body.dataset.playing=String(['countdown','loading','playing','feedback'].includes(phase));},[phase]);
  const fail=(message:string,operation:()=>Promise<void>)=>{setError(message);retry.current=operation;setPhase('error');setBusy(false);};
  const loadRound=async(nextScore:number)=>{
    const generation=run.current.generation;setPhase('loading');
    try{let next:Challenge;if(run.current.online)next=await api.round(run.current.session);else{const local=practiceRound(game.id,nextScore);next=local.challenge;run.current.expected=local.expected;}
      if(generation!==run.current.generation)return;run.current.locked=false;setChallenge(next);setPhase('playing');
    }catch(e){if(generation===run.current.generation)fail((e as Error).message,()=>loadRound(nextScore));}
  };
  const begin=async()=>{
    const generation=++run.current.generation;run.current.locked=false;run.current.online=ranked;run.current.request||=crypto.randomUUID();setScore(0);setResult(null);setShareMessage('');setPhase('loading');
    try{if(ranked){const id=await api.start(game.id,run.current.request);if(generation!==run.current.generation){void api.abandon(id);return;}run.current.session=id;}
      run.current.start=Date.now();setCountdown(3);setPhase('countdown');
    }catch(e){if(generation===run.current.generation)fail((e as Error).message,begin);}
  };
  useEffect(()=>{if(phase!=='countdown')return;const id=setTimeout(()=>{if(countdown>1)setCountdown(n=>n-1);else void loadRound(0);},1000);return()=>clearTimeout(id);
    // loadRound reads the current run ref; the countdown owns its single timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,countdown]);
  const reset=()=>{run.current.generation++;clearTimeout(timer.current);if(run.current.session)void api.abandon(run.current.session);run.current.session='';run.current.request='';run.current.locked=false;setChallenge(null);setResult(null);setScore(0);setBusy(false);setPhase('ready');};
  const submit=async(answer:Answer,retrying=false)=>{
    if(!challenge||(!retrying&&run.current.locked))return;run.current.locked=true;setBusy(true);const generation=run.current.generation;
    try{
      let response;
      if(run.current.online)response=await api.answer(run.current.session,challenge.round,answer);
      else{
        const correct=answerMatches(game.id,answer,run.current.expected!);
        if(correct)response={correct:true,completed:false,score:score+1};
        else{const local:GameResult={id:crypto.randomUUID(),game_mode:game.id,score,duration_ms:Date.now()-run.current.start,accuracy:Math.round(score/(score+1)*100),xp_earned:0,challenge_bonus:0,personal_best:score>storedBest,previous_best:storedBest,created_at:new Date().toISOString(),verified:false};savePractice(local);response={correct:false,completed:true,result:local};}
      }
      if(generation!==run.current.generation)return;
      if(settings.sound)playTone(response.correct);
      setBusy(false);
      if(response.completed){setResult(response.result!);setPhase('result');void cache.invalidateQueries({queryKey:['player']});void cache.invalidateQueries({queryKey:['leaderboard']});window.dispatchEvent(new CustomEvent('dopamine:analytics',{detail:{event:'game_completed',mode:game.id}}));}
      else{setScore(response.score!);setPhase('feedback');timer.current=setTimeout(()=>void loadRound(response.score!),650);}
    }catch(e){if(generation===run.current.generation)fail((e as Error).message,()=>submit(answer,true));}
  };
  const share=async()=>{if(!result)return;const text=`I cleared ${result.score} rounds in ${game.name} on Dopamine Rush. Beat your best!`;try{await navigator.clipboard.writeText(text);setShareMessage('Result copied. Share it wherever you like.');}catch{setShareMessage(text);}};
  const review=async(rating:number,text:string)=>{setReviewError('');const {error}=await supabase.from('game_reviews').insert({user_id:user!.id,game_mode:game.id,score_id:result!.id,rating,review:text||null});if(error){setReviewError('Your review could not be saved. Please try again.');throw new Error('Review failed');}};
  const Renderer=renderers[game.id] as React.ComponentType<RoundProps>;
  return <div className="page arena-page" style={{'--game-accent':game.accent} as CSSProperties}>
    <div className="game-toolbar"><Link to="/game" className="text-link"><ArrowLeft size={16}/> All games</Link><span>{game.skill} / {game.name}</span>{phase==='playing'?<button className="text-link" disabled={busy} onClick={()=>void submit({quit:true})}>Finish run</button>:phase!=='ready'&&phase!=='result'?<button className="text-link" onClick={reset}>Exit run</button>:<span className="tiny">Personal best · {best}</span>}</div>
    {phase==='ready'&&<div className="game-details"><div><span className="eyebrow">{game.skill} training</span><h1>{game.name}<span className="accent-dot">.</span></h1><p className="lead">{game.description}</p><div className="instructions"><h3>Your mission</h3><p>{game.instructions}</p><p className="tiny">{game.keys}</p></div>
      {user&&<div className="segmented" aria-label="Run type"><button aria-pressed={ranked} onClick={()=>setRanked(true)}>Scored run</button><button aria-pressed={!ranked} onClick={()=>setRanked(false)}>Practice</button></div>}
      <button className="button button-large" disabled={authLoading} onClick={()=>void begin()}>{ranked?'Start scored run':'Start practice'}<ArrowUpRight size={20}/></button>
      <p className="tiny muted">{ranked?<><ShieldCheck size={14}/> Server-checked rounds · 20 XP per correct round · up to 2,000 XP per run</>:<>Practice stays on this device. <Link to="/auth">Sign in for XP and leaderboards.</Link></>}</p></div><GameArt id={game.id}/></div>}
    {['playing','feedback'].includes(phase)&&<div className="game-score-strip"><span><small>ROUND</small><strong>{score+1}</strong></span><span><small>CLEARED</small><strong>{score}</strong></span><span><small>{ranked?'SCORED RUN':'PRACTICE BEST'}</small><strong>{ranked?<ShieldCheck/>:best}</strong></span></div>}
    {phase==='countdown'&&<div className="countdown" role="status"><span>Find your focus</span><strong key={countdown}>{countdown}</strong><p>{game.name}</p></div>}
    {phase==='loading'&&<Loading label="Preparing your round…"/>}
    {phase==='playing'&&challenge&&<div className="arena"><Suspense fallback={<Loading label="Loading game…"/>}><Renderer key={challenge.round} challenge={challenge} onAnswer={answer=>void submit(answer)} disabled={busy}/></Suspense>{busy&&<div className="confirming" role="status">Checking your answer…</div>}</div>}
    {phase==='feedback'&&<div className="round-success" role="status"><Check size={48}/><h2>Locked in.</h2><p>Round cleared. Keep going.</p></div>}
    {phase==='error'&&<div className="run-error"><ErrorState message={error} onRetry={()=>{setPhase('loading');void retry.current();}}/><button className="text-link" onClick={reset}>Leave this run</button><p className="tiny">An unconfirmed result will not award XP or enter the leaderboard.</p></div>}
    {phase==='result'&&result&&<section className="result-screen"><span className="result-emblem"><Trophy size={36}/></span><span className="eyebrow">{result.personal_best?'A NEW PERSONAL BEST': 'ONE RUN. A LITTLE MORE FOCUS.'}</span><h1>{result.personal_best?'That’s your new benchmark.':'Good run. Go again?'}</h1><p>{game.name} · {result.verified?'Saved and verified':'Practice · saved on this device'}</p><div className="result-score"><strong>{result.score}</strong><span>rounds cleared</span></div>
      <div className="result-metrics"><div><strong>{result.accuracy}%</strong><span>Round accuracy</span></div><div><strong>{durationLabel(result.duration_ms)}</strong><span>Run duration</span></div><div><strong>{Math.max(result.score,result.previous_best)}</strong><span>Personal best</span></div><div><strong>{result.verified?`+${result.xp_earned}`:'—'}</strong><span>{result.verified?'XP earned':'Practice · no XP'}</span></div></div>
      {result.challenge_bonus>0&&<div className="success-banner"><Zap size={18}/> Daily challenge complete. +150 bonus XP included.</div>}
      {result.verified&&<XpProgress xp={player.data?.xp??result.xp_earned}/>}
      <div className="result-actions"><button className="button" onClick={reset}><RotateCcw size={17}/> Play again</button><Link className="button button-secondary" to={`/game/${games[(games.indexOf(game)+1)%games.length].id}`}>Next challenge<ArrowRight size={17}/></Link><Link className="text-link" to={`/leaderboard?game=${game.id}`}>View leaderboard<ArrowUpRight size={16}/></Link></div>
      <div className="result-links"><button className="text-link" onClick={()=>void share()}><Share2 size={16}/> Copy result</button>{result.verified&&<button className="text-link" onClick={()=>setReviewOpen(true)}><Star size={16}/> Rate this game</button>}</div><p role="status" className="tiny">{shareMessage}</p>
      {!result.verified&&!user&&<p className="tiny">Want to keep your progress across devices? <Link to="/auth">Create an account for your next run.</Link></p>}
      <RatingDialog open={reviewOpen} onClose={()=>setReviewOpen(false)} onSubmit={review} gameName={game.name}/>{reviewError&&<p role="alert" className="error-text">{reviewError}</p>}
    </section>}
  </div>;
}
export default function Game(){const {gameMode}=useParams();const game=gameById(gameMode);return game?<GameRun key={game.id} game={game}/>:<div className="page"><ErrorState message="This game does not exist."/><Link className="button" to="/game">Choose a game</Link></div>;}

