import { type RoundProps } from '@/lib/games';
import { RoundFrame,useRoundClock,useNumberKeys } from './RoundSupport';
export default function PaletteRecall(props:RoundProps){const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);useNumberKeys(4,!clock.revealing&&!disabled,onAnswer);
return <RoundFrame title={clock.revealing?'Remember these shades.':`Which color was in position ${c.target!+1}?`} hint={clock.revealing?'Match each shade to its number.':'Use keys 1–4 or choose a shade.'} remaining={clock.remaining}><div className="palette-board">{(clock.revealing?c.palette:c.options)?.map((color,i)=>clock.revealing?<div className="palette-swatch" key={i} style={{background:color}}><span>{i+1}</span></div>:<button className="palette-swatch" key={i} style={{background:color}} aria-label={`Color option ${i+1}`} disabled={disabled} onClick={()=>onAnswer(i)}><span>{i+1}</span></button>)}</div></RoundFrame>;}

