import { useState } from 'react';
import type { RoundProps } from '@/lib/games';
import { RoundFrame,useRoundClock } from './RoundSupport';
export default function SpeedTypist(props:RoundProps){const {challenge:c,onAnswer,disabled}=props;const clock=useRoundClock(props);const [value,setValue]=useState('');
return <RoundFrame title="Find your typing rhythm." hint="Type the word exactly before time runs out." remaining={clock.remaining}><div className="typing-word" aria-hidden="true">{c.word?.split('').map((char,i)=><span key={i} className={i<value.length?(value[i]===char?'letter-correct':'letter-wrong'):''}>{char}</span>)}</div><label className="field-label" htmlFor="typing-answer">Type: {c.word}</label><input id="typing-answer" className="text-input typing-input" value={value} disabled={disabled} autoFocus autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={64} onPaste={e=>e.preventDefault()} onChange={e=>{setValue(e.target.value);if(e.target.value===c.word)onAnswer(e.target.value);}}/></RoundFrame>;}

