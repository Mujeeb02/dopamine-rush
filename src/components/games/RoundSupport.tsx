import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoundProps } from '@/lib/games';
export function useRoundClock({challenge,onAnswer,disabled}:RoundProps){
  const [elapsed,setElapsed]=useState(0);const callback=useRef(onAnswer);callback.current=onAnswer;const stopped=useRef(disabled);stopped.current=disabled;
  useEffect(()=>{const start=Date.now();let finished=false;const tick=()=>{const ms=Date.now()-start;setElapsed(ms);if(ms>=challenge.limit_ms&&!finished&&!stopped.current){finished=true;callback.current({timeout:true});}};const timer=setInterval(tick,50);return()=>clearInterval(timer);},[challenge]);
  return {elapsed,revealing:elapsed<challenge.reveal_ms,remaining:Math.max(0,challenge.limit_ms-elapsed)};
}
export function useNumberKeys(count:number,enabled:boolean,onChoose:(index:number)=>void){
  const callback=useRef(onChoose);callback.current=onChoose;
  useEffect(()=>{if(!enabled)return;const listener=(e:KeyboardEvent)=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target instanceof HTMLInputElement)return;const n=Number(e.key)-1;if(n>=0&&n<count){e.preventDefault();callback.current(n);}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[count,enabled]);
}
export function RoundFrame({title,hint,remaining,children}:{title:string;hint:string;remaining:number;children:ReactNode}){
  return <div className="round-frame"><div className="round-prompt"><span className="eyebrow">Stay in the moment</span><h2 aria-live="polite">{title}</h2><p>{hint}</p></div>{children}<div className="round-clock" aria-label={`${Math.ceil(remaining/1000)} seconds remaining`}><span className="clock-dot"/>{Math.ceil(remaining/1000)}s <span>remaining</span></div></div>;
}

