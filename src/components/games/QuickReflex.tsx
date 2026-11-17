import { useEffect, useRef } from 'react';
import { colors,colorNames,type RoundProps } from '@/lib/games';
import { RoundFrame,useRoundClock } from './RoundSupport';
/** Wait for the target colour, then tap. Reaction time is measured from the moment the target is painted. */
export default function QuickReflex(props:RoundProps){
  const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);
  const targetIndex=c.sequence!.length-1;
  const index=Math.min(Math.floor(clock.elapsed/c.interval_ms!),targetIndex);const current=c.sequence![index];
  const shownAt=useRef<number|null>(null);
  useEffect(()=>{if(index!==targetIndex||shownAt.current!==null)return;const frame=requestAnimationFrame(()=>{shownAt.current=performance.now();});return()=>cancelAnimationFrame(frame);},[index,targetIndex]);
  const choose=useRef(()=>{});
  choose.current=()=>{if(disabled)return;const ms=index===targetIndex&&shownAt.current!==null?Math.round(performance.now()-shownAt.current):undefined;onAnswer(ms===undefined?{pick:index}:{pick:index,ms});};
  useEffect(()=>{const press=(e:KeyboardEvent)=>{if(e.code==='Space'&&!e.repeat&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();choose.current();}};window.addEventListener('keydown',press);return()=>window.removeEventListener('keydown',press);},[]);
  return <RoundFrame title={`Wait for ${colorNames[c.target!]}.`} hint="Tap the target or press Space the moment it matches." remaining={clock.remaining}><span className="target-label"><i style={{background:colors[c.target!]}}/>{colorNames[c.target!]}</span><button className="reflex-target" aria-label={`Target is ${colorNames[current]}. Tap when ${colorNames[c.target!]}.`} style={{background:colors[current]}} disabled={disabled} onPointerDown={e=>{e.preventDefault();choose.current();}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();choose.current();}}}><span>+</span><strong>{colorNames[current]}</strong></button></RoundFrame>;
}
