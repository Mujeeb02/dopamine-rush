import { useEffect, useRef, useState } from 'react';
import type { RoundProps } from '@/lib/games';
import { typingStats } from '@/lib/scoring';

/**
 * A 30-second sprint. Words are typed in order, Space moves on, and only exact
 * words count. The clock starts with the round, as the server's does, and the
 * text goes in by itself when time is up.
 */
export default function SpeedTypist({challenge:c,onAnswer,disabled}:RoundProps){
  const words=c.words??[];const duration=c.duration_ms??30000;
  const [done,setDone]=useState<string[]>([]),[current,setCurrent]=useState(''),[left,setLeft]=useState(duration);
  const typed=useRef('');typed.current=[...done,current].join(' ');
  const send=useRef(onAnswer);send.current=onAnswer;const sent=useRef(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const start=performance.now();
    const id=setInterval(()=>{const ms=duration-(performance.now()-start);setLeft(Math.max(0,ms));
      if(ms<=0&&!sent.current){sent.current=true;clearInterval(id);send.current({typed:typed.current});}},100);
    return()=>clearInterval(id);
  },[duration]);
  const elapsed=duration-left;
  const live=typingStats(done.join(' '),words,Math.max(elapsed,3000));
  const finished=left<=0||!!disabled;
  const change=(value:string)=>{
    if(finished)return;
    // Space (or a pasted-in gap) commits the word before it.
    const parts=value.split(/\s+/);
    if(parts.length>1){const full=parts.slice(0,-1).filter(Boolean);if(full.length)setDone(d=>[...d,...full]);setCurrent(parts[parts.length-1]);}
    else setCurrent(value);
  };
  const from=Math.max(0,done.length-4);
  return <div className="round-frame sprint-frame">
    <div className="sprint-head"><div><span className="eyebrow">30-SECOND SPRINT</span><h2 aria-live="polite">{finished?'Time.':'Type the words in order.'}</h2></div>
      <div className="sprint-stats"><span><strong>{Math.ceil(left/1000)}</strong><small>seconds</small></span><span><strong>{live.wpm}</strong><small>WPM</small></span></div></div>
    <div className="sprint-bar" role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(left)}><span style={{width:`${left/duration*100}%`}}/></div>
    <div className="sprint-words" aria-hidden="true" onClick={()=>input.current?.focus()}>{words.slice(from,from+24).map((w,k)=>{const i=from+k;
      if(i<done.length)return <span key={i} className={done[i]===w?'word-done':'word-wrong'}>{w}</span>;
      if(i===done.length)return <span key={i} className="word-current">{w.split('').map((ch,j)=><span key={j} className={j<current.length?(current[j]===ch?'letter-correct':'letter-wrong'):''}>{ch}</span>)}{current.length>w.length&&<span className="letter-wrong">{current.slice(w.length)}</span>}</span>;
      return <span key={i}>{w}</span>;})}</div>
    <label className="field-label sr-only" htmlFor="typing-answer">Type the next word: {words[done.length]}</label>
    <input id="typing-answer" ref={input} className="text-input typing-input" value={current} disabled={finished} autoFocus autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={40} enterKeyHint="next"
      onPaste={e=>e.preventDefault()} onDrop={e=>e.preventDefault()} onChange={e=>change(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();change(current+' ');}}}/>
    <p className="tiny muted sprint-hint">{done.length?`${live.goodWords} of ${done.length} words right`:'The clock is running. Press Space after each word.'}</p>
  </div>;
}
