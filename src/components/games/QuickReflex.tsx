import { useEffect, useRef } from 'react';
import { colors,colorNames,type RoundProps } from '@/lib/games';
import { RoundFrame,useRoundClock } from './RoundSupport';
export default function QuickReflex(props:RoundProps){const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);const index=Math.min(Math.floor(clock.elapsed/c.interval_ms!),c.sequence!.length-1);const current=c.sequence![index];const choose=useRef(()=>{});choose.current=()=>{if(!disabled)onAnswer(index);};
useEffect(()=>{const press=(e:KeyboardEvent)=>{if(e.code==='Space'&&!e.repeat&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();choose.current();}};window.addEventListener('keydown',press);return()=>window.removeEventListener('keydown',press);},[]);
return <RoundFrame title={`Wait for ${colorNames[c.target!]}.`} hint="Tap the target or press Space when the colors match." remaining={clock.remaining}><span className="target-label"><i style={{background:colors[c.target!]}}/>{colorNames[c.target!]}</span><button className="reflex-target" aria-label={`Target is ${colorNames[current]}. Tap when ${colorNames[c.target!]}.`} style={{background:colors[current]}} disabled={disabled} onClick={()=>choose.current()}><span>+</span><strong>{colorNames[current]}</strong></button></RoundFrame>;}

