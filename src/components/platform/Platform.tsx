import { Component, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Zap, Gamepad2, LayoutDashboard, Trophy, CalendarDays, Settings, Sparkles, Flame, Medal, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { games, gameById } from '@/lib/games';
import { achievements, dailyChallenge, durationLabel, levelFromXp } from '@/lib/progression';
import type { PlayerSummary } from '@/lib/api';
import { reportError } from '@/lib/analytics';

export function Shell({children}:{children:ReactNode}){
  const {user}=useAuth();
  return <div className="app-shell"><a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header"><Link to="/" className="brand" aria-label="Dopamine Rush home"><span className="brand-mark"><Zap size={23} fill="currentColor"/></span><span>DOPAMINE<span className="brand-sub">RUSH</span></span></Link>
    <nav className="desktop-nav" aria-label="Main navigation"><NavLink to="/game">Play</NavLink><NavLink to="/dashboard">My progress</NavLink><NavLink to="/daily">Daily challenge</NavLink><NavLink to="/leaderboard">Leaderboard</NavLink></nav>
    <div className="header-actions"><Link className="icon-button" to="/settings" aria-label="Settings"><Settings size={19}/></Link><Link className="button button-small" to={user&&!user.is_anonymous?'/profile':user?'/auth?upgrade=1':'/auth'}>{user&&!user.is_anonymous?'My profile':user?'Save progress':'Sign in'}<ArrowUpRight size={15}/></Link></div></header>
    <main id="main">{children}</main>
    <footer className="site-footer"><Link to="/" className="wordmark">Dopamine Rush<span>®</span></Link><p>Small challenges. A little more focus.</p><span>Play for your next personal best.</span></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation">{[[Gamepad2,'Play','/game'],[LayoutDashboard,'Progress','/dashboard'],[CalendarDays,'Daily','/daily'],[Trophy,'Ranks','/leaderboard']].map(([Icon,label,path])=>{const I=Icon as typeof Gamepad2;return <NavLink key={String(path)} to={String(path)}><I size={20}/><span>{String(label)}</span></NavLink>;})}</nav>
  </div>;
}
export function PageIntro({eyebrow,title,description,children}:{eyebrow:string;title:string;description?:string;children?:ReactNode}){
  return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</div>;
}
export function GameArt({id,small=false}:{id:string;small?:boolean}){
  const game=gameById(id)??games[0];
  return <div aria-hidden="true" className={`game-art art-${id} ${small?'art-small':''}`} style={{'--game-accent':game.accent} as CSSProperties}>
    {id==='speed-typist'?<div className="type-art">f<span>o</span>cus<span className="type-cursor">_</span></div>
    :id==='quick-reflex'?<div className="target-art"><div><div><Zap/></div></div></div>
    :id==='palette-recall'?<div className="palette-art">{['#e8a6ce','#ce8dbd','#b880b1','#a46fac'].map(c=><span key={c} style={{background:c}}/>)}</div>
    :<div className={`tile-art ${id==='reverse-sequence'?'sequence-art':''}`}>{Array.from({length:9},(_,i)=><span className={[0,2,4,7].includes(i)?'lit':''} key={i}>{id==='reverse-sequence'&&[0,2,4].includes(i)?[3,2,1][[0,2,4].indexOf(i)]:null}</span>)}</div>}
    <span className="art-orbit"/><span className="art-cross">+</span>
  </div>;
}
export function GameCard({game,best}:{game:typeof games[number];best?:number}){
  const Icon=game.icon;
  return <Link to={`/game/${game.id}`} className="game-card" style={{'--game-accent':game.accent} as CSSProperties}><GameArt id={game.id}/><div className="game-card-body"><div className="game-card-meta"><span><Icon size={14}/>{game.skill}</span><ArrowUpRight size={19}/></div><h3>{game.name}</h3><p>{game.description}</p><div className="game-card-foot"><span>{best!==undefined?`Best · ${best} rounds`:game.difficulty}</span><strong>Play <ArrowRight size={14}/></strong></div></div></Link>;
}
export function Loading({label='Loading your next move…'}:{label?:string}){return <div role="status" className="loading-state"><span className="loading-orbit"/><p>{label}</p></div>;}
export function Empty({title,detail,action}:{title:string;detail:string;action?:ReactNode}){return <div className="empty-state"><Sparkles size={30}/><h3>{title}</h3><p>{detail}</p>{action}</div>;}
export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}){return <div role="alert" className="error-state"><h3>Let's try that again.</h3><p>{message}</p>{onRetry&&<button className="button button-secondary" onClick={onRetry}>Retry</button>}</div>;}
export function XpProgress({xp}:{xp:number}){const level=levelFromXp(xp);return <div className="xp-block"><div className="xp-heading"><span className="level-badge">LVL {level.level}</span><span>{level.current.toLocaleString()} / {level.needed.toLocaleString()} XP</span></div><div className="progress-track" role="progressbar" aria-label="Level progress" aria-valuenow={level.current} aria-valuemax={level.needed}><span style={{width:`${level.percent}%`}}/></div></div>;}
export function DailyCard({player}:{player?:PlayerSummary}){
  const daily=dailyChallenge();
  return <section className="daily-card"><div><span className="eyebrow"><CalendarDays size={14}/> Your daily focus</span><h2>{daily.game.name}</h2><p>Same rounds for everyone. Your first run counts.<br/>Clear {daily.target} rounds for bonus XP. New challenge at 05:30 IST (midnight UTC).</p>
    <div className="daily-progress"><span>{player?.daily_completed?<><Check size={16}/> Completed · reward earned</>:`${Math.min(player?.daily_progress??0,5)} / 5 rounds`}</span><strong>+{daily.reward} XP</strong></div>
    <Link className="button" to="/daily">{player?.daily_completed?'See today’s board':'Take the challenge'}<ArrowUpRight size={17}/></Link></div><GameArt id={daily.game.id}/></section>;
}
export function AchievementGrid({player}:{player:PlayerSummary}){
  return <div className="achievement-grid">{achievements(player as unknown as Record<string,number>).map(a=><div className={`achievement ${a.unlocked?'unlocked':''}`} key={a.id}><span className="achievement-medal"><Medal size={24}/></span><strong>{a.name}</strong><p>{a.detail}</p><span className="tiny">{a.unlocked?'Unlocked':`${Math.min(a.value,a.target)} / ${a.target}`}</span></div>)}</div>;
}
export function SessionList({player}:{player:PlayerSummary}){return player.recent.length?<div className="session-list">{player.recent.map(row=>{const game=gameById(row.game_mode);return <div className="session-row" key={row.id}><span className="session-icon" style={{color:game?.accent}}>{game&&<game.icon size={21}/>}</span><div><Link to={`/game/${row.game_mode}`}>{game?.name??row.game_mode}</Link><small>{new Date(row.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {row.verified?durationLabel(row.duration_ms):'Previous version'}</small></div><strong>{row.score}<small>rounds</small></strong><span className="session-xp">{row.verified?`+${row.xp_earned} XP`:'Legacy'}</span></div>;})}</div>:<Empty title="Your story starts with a run." detail="Finish a scored game to see your session history here." action={<Link className="button" to="/game">Find a game <ArrowRight size={16}/></Link>}/>;}
export function Activity({player}:{player:PlayerSummary}){const now=new Date();const dates=Array.from({length:14},(_,i)=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()-13+i);return d.toISOString().slice(0,10);});const maximum=Math.max(1,...player.activity.map(a=>a.games));return <div><div className="activity-chart" role="img" aria-label={`Last 14 days: ${player.activity.reduce((n,a)=>n+a.games,0)} completed runs`}>{dates.map(day=>{const n=player.activity.find(a=>a.day===day)?.games??0;return <div key={day} title={`${day}: ${n} runs`}><span style={{height:`${Math.max(4,n/maximum*100)}%`}} className={n?'has-activity':''}/><small>{new Date(day+'T00:00:00Z').getUTCDate()}</small></div>;})}</div><p className="tiny muted">Completed runs · last 14 days · UTC</p></div>;}
export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){reportError(error,{source:'render'});}
  render(){return this.state.failed?<div className="page"><Empty title="Something interrupted your session." detail="Reload the page to get back to your games." action={<button className="button" onClick={()=>window.location.reload()}>Reload</button>}/></div>:this.props.children;}
}

