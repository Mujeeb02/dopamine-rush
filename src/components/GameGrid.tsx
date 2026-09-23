import { colorNames, colors, type RoundProps } from '@/lib/games';
import { RoundFrame, useRoundClock } from './games/RoundSupport';
export default function GameGrid(props:RoundProps){const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);
return <RoundFrame title={clock.revealing?'Take a good look.':`Where was ${colorNames[c.target!]}?`} hint={clock.revealing?'Remember each color’s position.':'Choose the tile you remember.'} remaining={clock.remaining}><div className="memory-board">{c.cards?.map((color,i)=><button key={i} aria-label={clock.revealing?`${colorNames[color]}, position ${i+1}`:`Position ${i+1}`} className={`memory-tile ${clock.revealing?'revealed':''}`} style={clock.revealing?{background:colors[color],color:'#101728'}:{}} disabled={clock.revealing||disabled} onClick={()=>onAnswer(i)}><span>{clock.revealing?colorNames[color]:i+1}</span></button>)}</div></RoundFrame>;}

