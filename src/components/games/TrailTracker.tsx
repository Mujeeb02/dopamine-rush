import { useState } from 'react';
import type { RoundProps } from '@/lib/games';
import { RoundFrame,useRoundClock } from './RoundSupport';
export default function TrailTracker(props:RoundProps){const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);const [input,setInput]=useState<number[]>([]);const step=Math.floor(clock.elapsed/c.interval_ms!);const active=clock.revealing?c.sequence?.[step]:null;
const choose=(i:number)=>{const next=[...input,i];setInput(next);if(next.length===c.sequence!.length)onAnswer(next);};
return <RoundFrame title={clock.revealing?'Watch the path.':'Retrace your steps.'} hint={clock.revealing?'Remember the order of the glowing cells.':`${input.length} of ${c.sequence!.length} steps · tap in the same order`} remaining={clock.remaining}><div className="cell-board" style={{gridTemplateColumns:`repeat(${c.size},1fr)`}}>{Array.from({length:c.size!**2},(_,i)=><button key={i} aria-label={`Row ${Math.floor(i/c.size!)+1}, column ${i%c.size!+1}`} disabled={clock.revealing||disabled||input.includes(i)||input.length>=c.sequence!.length} className={`board-cell ${active===i||input.includes(i)?'cell-active':''}`} onClick={()=>choose(i)}>{input.includes(i)?input.indexOf(i)+1:active===i?'●':''}</button>)}</div></RoundFrame>;}

