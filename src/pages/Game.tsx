import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, Trophy, ShieldCheck, RotateCcw, Share2, Star, Check, Zap, Link2, AlertTriangle } from 'lucide-react';
import GameGrid from '@/components/GameGrid';
import { GameArt, ErrorState, Loading, XpProgress } from '@/components/platform/Platform';
import { formatScore, gameById, gameSlugs, games, sprintGames, timedGames, type Answer, type Challenge, type GameResult, type RoundProps } from '@/lib/games';
import { api, GuestUnavailable, type AnswerResponse } from '@/lib/api';
import { freezeCredit, typingStats } from '@/lib/scoring';
import { track } from '@/lib/analytics';
import { answerMatches, practiceHistory, practiceRound, savePractice } from '@/lib/practice';
import { durationLabel } from '@/lib/progression';
import { channelUrl, challengeUrl, compare, dailyUrl, headlineNumber, shareLink, shareText, siteUrl } from '@/lib/share';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { playTone, useSettings } from '@/hooks/useSettings';
import { backendConfigured, supabase } from '@/integrations/supabase/client';
import RatingDialog from '@/components/ui/rating-dialog';
const FreezeFrame=lazy(()=>import('@/components/games/FreezeFrame'));
const ReverseSequence=lazy(()=>import('@/components/games/ReverseSequence'));
const QuickReflex=lazy(()=>import('@/components/games/QuickReflex'));
const TrailTracker=lazy(()=>import('@/components/games/TrailTracker'));
const PaletteRecall=lazy(()=>import('@/components/games/PaletteRecall'));
const SpeedTypist=lazy(()=>import('@/components/games/SpeedTypist'));
const renderers={classic:GameGrid,'freeze-frame':FreezeFrame,'reverse-sequence':ReverseSequence,'quick-reflex':QuickReflex,'trail-tracker':TrailTracker,'palette-recall':PaletteRecall,'speed-typist':SpeedTypist};
type Phase='ready'|'countdown'|'loading'|'playing'|'feedback'|'result'|'error';
type Game=typeof games[number];
export type OnlineKind='standard'|'daily'|'challenge';
export interface Opponent {username:string;score:number;best_ms:number|null}

function headline(r:GameResult,opponent?:Opponent){
  if(opponent){const verdict=compare(r,opponent);return verdict>0?{eyebrow:'CHALLENGE WON',title:`You beat ${opponent.username}.`}:verdict===0?{eyebrow:'DEAD HEAT',title:`You tied ${opponent.username}.`}:{eyebrow:'NOT THIS TIME',title:`${opponent.username} still leads.`};}
  const fmt=(n:number)=>formatScore(r.game_mode,n);
  if(r.personal_best&&r.score>0)return {eyebrow:'NEW PERSONAL BEST',title:r.previous_best>0?`Up from ${fmt(r.previous_best)}. That’s your new benchmark.`:'First benchmark set.'};
  if(r.score===0)return r.game_mode==='speed-typist'?{eyebrow:'NO WORDS COUNTED',title:'Type each word exactly, then press Space.'}
    :r.game_mode==='freeze-frame'?{eyebrow:'NO CELLS SCORED',title:'Shake it off. The first pattern is the hardest to settle into.'}
    :{eyebrow:'OUT ON ROUND 1',title:'Shake it off. Round 1 is the hardest to settle into.'};
  const gap=r.previous_best-r.score;
  if(gap===0)return {eyebrow:'SO CLOSE',title:'Tied with your best.'};
  // "One short" only means something for rounds; cells and WPM move in bigger steps.
  if(gap===1&&!['freeze-frame','speed-typist'].includes(r.game_mode))return {eyebrow:'SO CLOSE',title:'One round short of your best.'};
  return {eyebrow:'RUN COMPLETE',title:`${r.game_mode==='speed-typist'?fmt(r.score):`${fmt(r.score)} ${r.game_mode==='freeze-frame'?'recalled':'cleared'}`}. Your best is ${fmt(r.previous_best)}.`};
}
/** After a Freeze Frame miss: the pattern that was asked for, against what was picked. */
function PatternReveal({size,pattern,picked,final}:{size:number;pattern:number[];picked:number[];final:boolean}){
  const {hit}=freezeCredit(picked,pattern);
  return <div className="pattern-reveal"><span className="eyebrow">{final?'RUN OVER':'LIFE USED'}</span><h2>{hit} of {pattern.length} cells.</h2><p>{final?'Here’s the pattern you were after.':'Here’s the pattern. One more miss ends the run.'}</p>
    <div className="cell-board reveal-board" style={{gridTemplateColumns:`repeat(${size},1fr)`}} aria-hidden="true">{Array.from({length:size*size},(_,i)=>{const want=pattern.includes(i),got=picked.includes(i);return <span key={i} className={`board-cell ${want&&got?'cell-hit':want?'cell-missed':got?'cell-wrong':''}`}/>;})}</div>
    <p className="tiny reveal-legend"><span className="cell-hit"/> right <span className="cell-missed"/> missed <span className="cell-wrong"/> wrong pick</p></div>;
}
const REVIEW_KEY='dopamine-runs-since-review';
function shouldAskForReview(){try{const n=Number(localStorage.getItem(REVIEW_KEY)||'0')+1;localStorage.setItem(REVIEW_KEY,String(n));return n%5===0;}catch{return false;}}

export function GameRun({game,kind='standard',slug,opponent,intro}:{game:Game;kind?:OnlineKind;slug?:string;opponent?:Opponent;intro?:ReactNode}){
  const {user,loading:authLoading}=useAuth();const player=usePlayer();const cache=useQueryClient();const {settings}=useSettings();
  const fixedOnline=kind!=='standard';
  const [online,setOnline]=useState(backendConfigured);
  const [phase,setPhase]=useState<Phase>('ready'),[score,setScore]=useState(0),[countdown,setCountdown]=useState(3),[lastMs,setLastMs]=useState<number|null>(null);
  const [challenge,setChallenge]=useState<Challenge|null>(null),[result,setResult]=useState<GameResult|null>(null);
  const [cells,setCells]=useState(0),[livesUsed,setLivesUsed]=useState(0),[roundKey,setRoundKey]=useState(0),[reveal,setReveal]=useState<{size:number;pattern:number[];picked:number[];final:boolean}|null>(null);
  const [error,setError]=useState(''),[guestBlocked,setGuestBlocked]=useState(false),[busy,setBusy]=useState(false);
  const [link,setLink]=useState(''),[shareMessage,setShareMessage]=useState(''),[reviewOpen,setReviewOpen]=useState(false),[askReview,setAskReview]=useState(false),[reviewError,setReviewError]=useState('');
  const run=useRef({session:'',request:'',generation:0,online:false,start:0,expected:null as Answer|null,locked:false,ms:[] as number[],replays:0,cells:0,misses:0});
  const retry=useRef<()=>Promise<void>>(async()=>{});const timer=useRef<ReturnType<typeof setTimeout>>();
  const timed=timedGames.includes(game.id),sprint=sprintGames.includes(game.id),cellScored=game.id==='freeze-frame';
  // Older practice runs of these two games were scored in rounds, a different unit.
  const storedBest=Math.max(0,...practiceHistory().filter(r=>r.game_mode===game.id&&(r.rounds!=null||!(sprint||cellScored))).map(r=>r.score));
  const record=player.data?.records.find(r=>r.game_mode===game.id);
  const best=online?(record?.best??0):storedBest;
  useEffect(()=>{const state=run.current;return()=>{state.generation++;clearTimeout(timer.current);if(state.session)void api.abandon(state.session);document.body.removeAttribute('data-playing');};},[]);
  useEffect(()=>{document.body.dataset.playing=String(['countdown','loading','playing','feedback'].includes(phase));},[phase]);
  const fail=(message:string,operation:()=>Promise<void>)=>{setError(message);retry.current=operation;setPhase('error');setBusy(false);};
  const loadRound=async(nextScore:number)=>{
    const generation=run.current.generation;setPhase('loading');
    try{let next:Challenge;if(run.current.online)next=await api.round(run.current.session);else{const local=practiceRound(game.id,nextScore);next=local.challenge;run.current.expected=local.expected;}
      if(generation!==run.current.generation)return;run.current.locked=false;setReveal(null);setChallenge(next);setRoundKey(k=>k+1);setPhase('playing');
    }catch(e){if(generation===run.current.generation)fail((e as Error).message,()=>loadRound(nextScore));}
  };
  const begin=async(useOnline=online)=>{
    const generation=++run.current.generation;
    Object.assign(run.current,{locked:false,online:useOnline,ms:[],cells:0,misses:0,session:'',request:run.current.request||crypto.randomUUID()});
    setScore(0);setCells(0);setLivesUsed(0);setReveal(null);setResult(null);setLink('');setShareMessage('');setLastMs(null);setGuestBlocked(false);setPhase('loading');
    try{
      if(useOnline){
        const wasGuest=!user;await api.ensureSession();if(wasGuest)track('guest_session_started',{mode:game.id,kind});
        const id=await api.start(game.id,run.current.request,kind,slug);
        if(generation!==run.current.generation){void api.abandon(id);return;}
        run.current.session=id;
      }
      run.current.start=Date.now();setCountdown(3);setPhase('countdown');
      track(kind==='challenge'?'challenge_started':'game_started',{mode:game.id,kind:useOnline?kind:'practice',replay:run.current.replays>0});
    }catch(e){
      if(generation!==run.current.generation)return;
      if(e instanceof GuestUnavailable&&!fixedOnline){setOnline(false);void begin(false);return;}
      if(e instanceof GuestUnavailable)setGuestBlocked(true);
      fail((e as Error).message,()=>begin(useOnline));
    }
  };
  useEffect(()=>{if(phase!=='countdown')return;const id=setTimeout(()=>{if(countdown>1)setCountdown(n=>n-1);else void loadRound(0);},run.current.replays?450:800);return()=>clearTimeout(id);
    // loadRound reads the current run ref; the countdown owns its single timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,countdown]);
  const reset=()=>{run.current.generation++;clearTimeout(timer.current);if(run.current.session)void api.abandon(run.current.session);Object.assign(run.current,{session:'',request:'',locked:false});setChallenge(null);setResult(null);setScore(0);setBusy(false);setPhase('ready');};
  const playAgain=()=>{track('play_again_clicked',{mode:game.id,previous_score:result?.score??0});run.current.replays++;Object.assign(run.current,{session:'',request:''});void begin(fixedOnline||online);};
  const finish=(finished:GameResult)=>{
    setResult(finished);setPhase('result');setAskReview(finished.verified&&shouldAskForReview());
    void cache.invalidateQueries({queryKey:['player']});void cache.invalidateQueries({queryKey:['leaderboard']});void cache.invalidateQueries({queryKey:['daily']});void cache.invalidateQueries({queryKey:['challenge']});
    track(kind==='challenge'?'challenge_completed':'game_completed',{mode:game.id,kind:finished.verified?kind:'practice',score:finished.score,best_ms:finished.best_ms??null,verified:finished.verified,personal_best:finished.personal_best,duration_ms:finished.duration_ms});
    if(finished.kind==='daily')track('daily_challenge_completed',{mode:game.id,score:finished.score,number:finished.daily_number??null});
    if(finished.verified&&!finished.flagged&&finished.kind!=='daily'&&finished.kind!=='daily_replay')
      void api.createChallenge(finished.id).then(s=>{setLink(challengeUrl(s));track('challenge_created',{mode:game.id,score:finished.score});}).catch(()=>setLink(`${siteUrl}/game/${game.id}`));
  };
  /** Practice mirrors the server's rules (answer_round) so the two never disagree on a score. */
  const practiceAnswer=(answer:Answer):AnswerResponse=>{
    const state=run.current,quit=typeof answer==='object'&&answer!==null&&'quit' in answer;
    const end=(value:number,extra:Partial<GameResult>={}):GameResult=>{const list=state.ms;const local:GameResult={id:crypto.randomUUID(),game_mode:game.id,score:value,duration_ms:Date.now()-state.start,xp_earned:0,challenge_bonus:0,personal_best:value>storedBest,previous_best:storedBest,created_at:new Date().toISOString(),verified:false,best_ms:list.length?Math.min(...list):null,avg_ms:list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length):null,rounds:score,...extra};savePractice(local);return local;};
    if(cellScored){
      const pattern=state.expected as number[];const c=quit?{credited:0,exact:false}:freezeCredit(Array.isArray(answer)?answer as number[]:[],pattern);
      state.cells+=c.credited;
      if(c.exact)return {correct:true,completed:false,score:score+1,cells:state.cells};
      if(!quit&&state.misses===0){state.misses=1;return {correct:false,completed:false,life_used:true,score,cells:state.cells,pattern};}
      if(!quit)state.misses++;
      return {correct:false,completed:true,pattern:quit?undefined:pattern,result:end(state.cells,{lives_used:state.misses})};
    }
    if(sprint){
      const typed=typeof answer==='object'&&answer!==null&&'typed' in answer?answer.typed:'';const st=typingStats(typed,state.expected as string[]);
      return {correct:st.wpm>0,completed:true,wpm:st.wpm,accuracy:st.accuracy,result:end(st.wpm,{rounds:0,accuracy:st.accuracy})};
    }
    const correct=answerMatches(game.id,answer,state.expected!);const ms=typeof answer==='object'&&answer&&'ms' in answer?answer.ms:undefined;
    if(correct&&ms)state.ms.push(ms);
    return correct?{correct:true,completed:false,score:score+1,ms}:{correct:false,completed:true,result:end(score)};
  };
  const submit=async(answer:Answer,retrying=false)=>{
    if(!challenge||(!retrying&&run.current.locked))return;run.current.locked=true;setBusy(true);const generation=run.current.generation;
    try{
      const response=run.current.online?await api.answer(run.current.session,challenge.round,answer):practiceAnswer(answer);
      if(generation!==run.current.generation)return;
      if(settings.sound)playTone(response.correct);
      setBusy(false);setLastMs(response.ms??null);
      if(response.cells!=null)setCells(response.cells);
      track('round_completed',{mode:game.id,round:challenge.round,correct:response.correct,ms:response.ms??null,life_used:!!response.life_used});
      const shown=response.pattern&&challenge.size?{size:challenge.size,pattern:response.pattern,picked:Array.isArray(answer)?answer as number[]:[],final:response.completed}:null;
      setReveal(shown);
      if(response.life_used){setLivesUsed(1);setPhase('feedback');timer.current=setTimeout(()=>void loadRound(response.score??score),2200);}
      // Let the missed pattern sink in before the result screen.
      else if(response.completed&&shown){setPhase('feedback');timer.current=setTimeout(()=>finish(response.result!),2200);}
      else if(response.completed)finish(response.result!);
      else{setScore(response.score!);setPhase('feedback');timer.current=setTimeout(()=>void loadRound(response.score!),timed?700:450);}
    }catch(e){if(generation===run.current.generation)fail((e as Error).message,()=>submit(answer,true));}
  };
  useEffect(()=>{if(phase!=='result')return;const key=(e:KeyboardEvent)=>{if((e.code==='Space'||e.key==='Enter')&&!(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)&&!reviewOpen){e.preventDefault();playAgain();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
    // playAgain reads refs; rebinding on result is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,reviewOpen]);
  const shareTarget=()=>result?.kind==='daily'||result?.kind==='daily_replay'?dailyUrl():link||`${siteUrl}/game/${game.id}`;
  const share=async()=>{if(!result)return;const outcome=await shareLink(shareText(game.id,result,{challenge:!!link}),shareTarget(),{mode:game.id,kind:result.kind??'practice'});
    setShareMessage(outcome==='copied'?'Link copied. Paste it anywhere.':outcome==='failed'?'Could not copy. Long-press the link below instead.':'');};
  const review=async(rating:number,text:string)=>{setReviewError('');const {error}=await supabase.from('game_reviews').insert({user_id:user!.id,game_mode:game.id,score_id:result!.id,rating,review:text||null});if(error){setReviewError('Your review could not be saved. Please try again.');throw new Error('Review failed');}};
  const Renderer=renderers[game.id] as React.ComponentType<RoundProps>;
  const head=result?headlineNumber(game.id,result):null;
  const isDaily=result?.kind==='daily'||result?.kind==='daily_replay';
  const anonymous=!!user?.is_anonymous;
  return <div className="page arena-page" style={{'--game-accent':game.accent} as CSSProperties}>
    <div className="game-toolbar"><Link to="/game" className="text-link"><ArrowLeft size={16}/> All games</Link><span>{game.skill} / {game.name}</span>{phase==='playing'&&!sprint?<button className="text-link" disabled={busy} onClick={()=>void submit({quit:true})}>Finish run</button>:phase!=='ready'&&phase!=='result'?<button className="text-link" onClick={reset}>Exit run</button>:<span className="tiny">Personal best · {timed&&record?.best_ms?`${record.best_ms} ms`:formatScore(game.id,best)}</span>}</div>
    {phase==='ready'&&<div className="game-details"><div>{intro??<><span className="eyebrow">{game.skill} training</span><h1>{game.name}<span className="accent-dot">.</span></h1><p className="lead">{game.description}</p></>}<div className="instructions"><h3>How to play</h3><p>{game.instructions}</p><p className="tiny">{game.keys}</p></div>
      {!fixedOnline&&backendConfigured&&<div className="segmented" aria-label="Run type"><button aria-pressed={online} onClick={()=>setOnline(true)}>Scored run</button><button aria-pressed={!online} onClick={()=>setOnline(false)}>Practice</button></div>}
      <button className="button button-large" autoFocus disabled={authLoading} onClick={()=>void begin()}>{kind==='daily'?'Start today’s run':kind==='challenge'?'Accept the challenge':online?'Start scored run':'Start practice'}<ArrowUpRight size={20}/></button>
      <p className="tiny muted">{fixedOnline||online?<><ShieldCheck size={14}/> Server-checked rounds{user&&!anonymous?' · 20 XP per round':' · no sign-up needed'}{kind==='daily'?' · your first run today is the one that counts':''}</>:<>Practice stays on this device and is not ranked.</>}</p></div><GameArt id={game.id}/></div>}
    {['playing','feedback'].includes(phase)&&!sprint&&<div className="game-score-strip"><span><small>ROUND</small><strong>{score+1}</strong></span>{cellScored?<><span><small>CELLS</small><strong>{cells}</strong></span><span><small>LIFE</small><strong aria-label={livesUsed?'No lives left':'One life left'}>{livesUsed?'0':'1'}</strong></span></>:<span><small>CLEARED</small><strong>{score}</strong></span>}<span><small>{run.current.online?'VERIFIED':'PRACTICE BEST'}</small><strong>{run.current.online?<ShieldCheck/>:best}</strong></span></div>}
    {phase==='countdown'&&<div className="countdown" role="status"><span>{game.name}</span><strong key={countdown}>{countdown}</strong><p>{kind==='challenge'&&opponent?`Beat ${opponent.username}: ${headlineNumber(game.id,opponent).value}`:'Get ready'}</p></div>}
    {phase==='loading'&&<Loading label="Preparing your round…"/>}
    {phase==='playing'&&challenge&&<div className="arena"><Suspense fallback={<Loading label="Loading game…"/>}><Renderer key={roundKey} challenge={challenge} onAnswer={answer=>void submit(answer)} disabled={busy}/></Suspense>{busy&&<div className="confirming" role="status">Checking…</div>}</div>}
    {phase==='feedback'&&<div className="round-success" role="status">{reveal?<PatternReveal {...reveal}/>:lastMs?<><strong className="round-ms">{lastMs}<small> ms</small></strong><p>Round {score} cleared.</p></>:<><Check size={48}/><h2>Round {score} cleared.</h2></>}</div>}
    {phase==='error'&&<div className="run-error"><ErrorState message={error} onRetry={()=>{setPhase('loading');void retry.current();}}/>{guestBlocked&&<Link className="button button-secondary" to="/auth">Sign in to play</Link>}<button className="text-link" onClick={reset}>Leave this run</button><p className="tiny">An unconfirmed result will not award XP or enter the leaderboard.</p></div>}
    {phase==='result'&&result&&head&&<section className="result-screen">
      <span className="eyebrow">{headline(result,opponent).eyebrow}</span><h1>{headline(result,opponent).title}</h1>
      <div className="result-score"><strong>{head.value}</strong><span>{head.label} · {game.name}{isDaily&&result.daily_number!=null?` · Daily #${result.daily_number}`:''}</span></div>
      {opponent&&<div className="versus"><div><small>YOU</small><strong>{headlineNumber(game.id,result).value}</strong></div><span>vs</span><div><small>{opponent.username.toUpperCase()}</small><strong>{headlineNumber(game.id,opponent).value}</strong></div></div>}
      {result.flagged&&<p className="notice-inline"><AlertTriangle size={16}/> Some answers came in faster than our checks allow, so this run is saved but kept off leaderboards.</p>}
      <div className="result-actions">
        {result.verified&&!isDaily?<button className="button" onClick={()=>void share()} disabled={!link&&!result.flagged}><Zap size={17}/>{link?'Challenge a friend':'Preparing link…'}</button>
          :<button className="button" onClick={()=>void share()}><Share2 size={17}/>{isDaily?'Share today’s result':'Share'}</button>}
        <button className="button button-secondary" onClick={playAgain}><RotateCcw size={17}/> Play again <kbd>Space</kbd></button>
      </div>
      <div className="share-row" aria-label="Share to">
        <a className="text-link" href={channelUrl('whatsapp',shareText(game.id,result,{challenge:!!link}),shareTarget())} target="_blank" rel="noreferrer" onClick={()=>track('share_clicked',{channel:'whatsapp',mode:game.id})}>WhatsApp</a>
        <a className="text-link" href={channelUrl('x',shareText(game.id,result,{challenge:!!link}),shareTarget())} target="_blank" rel="noreferrer" onClick={()=>track('share_clicked',{channel:'x',mode:game.id})}>X</a>
        {link&&<button className="text-link" onClick={()=>void navigator.clipboard?.writeText(link).then(()=>setShareMessage('Challenge link copied.'))}><Link2 size={15}/> Copy link</button>}
      </div>
      <p role="status" className="tiny">{shareMessage}</p>
      <div className="result-metrics">
        {timed&&<div><strong>{result.score}</strong><span>Rounds cleared</span></div>}
        {timed&&result.avg_ms?<div><strong>{result.avg_ms} ms</strong><span>Average reaction</span></div>:null}
        {cellScored&&<div><strong>{result.rounds??0}</strong><span>Perfect rounds</span></div>}
        {sprint&&<div><strong>{result.accuracy!=null?`${result.accuracy}%`:'—'}</strong><span>Accuracy</span></div>}
        {!sprint&&<div><strong>{durationLabel(result.duration_ms)}</strong><span>Run time</span></div>}
        <div><strong>{timed&&result.best_ms?`${Math.min(result.best_ms,result.previous_best_ms??Infinity)} ms`:headlineNumber(game.id,{score:Math.max(result.score,result.previous_best),best_ms:null}).value}</strong><span>Personal best</span></div>
        <div><strong>{result.verified&&!anonymous?`+${result.xp_earned}`:'—'}</strong><span>{result.verified?(anonymous?'XP needs an account':'XP earned'):'Practice · no XP'}</span></div>
      </div>
      {result.challenge_bonus>0&&<div className="success-banner"><Zap size={18}/> Daily challenge complete. +150 bonus XP included.</div>}
      {result.verified&&!anonymous&&<XpProgress xp={player.data?.xp??result.xp_earned}/>}
      {anonymous&&result.verified&&<div className="notice"><p>Your run is verified and saved to this browser. Add an email to keep it, earn XP and protect your streak.</p><Link className="button button-small" to="/auth?upgrade=1" onClick={()=>track('signup_prompt_shown',{trigger:'result'})}>Save my progress<ArrowUpRight size={16}/></Link></div>}
      {!result.verified&&backendConfigured&&<p className="tiny">Practice runs aren’t ranked. <button className="text-link" onClick={()=>{setOnline(true);playAgain();}}>Play a scored run</button></p>}
      <div className="result-links"><Link className="text-link" to={`/game/${games[(games.indexOf(game)+1)%games.length].id}`}>Next game<ArrowRight size={16}/></Link><Link className="text-link" to={isDaily?'/daily':`/leaderboard?game=${game.id}`}><Trophy size={15}/>{isDaily?'Today’s board':'Leaderboard'}</Link>{askReview&&user&&!anonymous&&<button className="text-link" onClick={()=>setReviewOpen(true)}><Star size={16}/> Rate this game</button>}</div>
      <RatingDialog open={reviewOpen} onClose={()=>setReviewOpen(false)} onSubmit={review} gameName={game.name}/>{reviewError&&<p role="alert" className="error-text">{reviewError}</p>}
    </section>}
  </div>;
}
export default function Game(){const {gameMode,slug}=useParams();const game=gameById(gameMode)??games.find(g=>gameSlugs[g.id]===slug);useEffect(()=>{if(game)document.title=`${game.name} · Dopamine Rush`;},[game]);return game?<GameRun key={game.id} game={game}/>:<div className="page"><ErrorState message="This game does not exist."/><Link className="button" to="/game">Choose a game</Link></div>;}
