import { patternGenerator } from './game-logic/PatternGenerator';
import { colorTheory } from './game-logic/ColorTheory';
import type { Answer, Challenge, GameMode, GameResult } from './games';

/** The same common words the server draws Speed Typist sprints from (_make_challenge). */
export const sprintWords = ['the','be','to','of','and','in','that','have','it','for','not','on','with','he','as','you','do','at',
  'this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there',
  'their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no',
  'just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then',
  'now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first',
  'well','way','even','new','want','because','any','these','give','day','most','us','great','small','light','fast',
  'quick','brain','focus','sharp','move','play','game','score','round','again','never','always','right','left'];

const shuffle = <T,>(items:T[]) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
export function practiceRound(mode: GameMode, score: number): { challenge: Challenge; expected: Answer } {
  const challenge: Challenge = { mode, round: score, reveal_ms: 0, limit_ms: 60000 };
  let expected: Answer;
  switch(mode) {
    case 'classic': {
      challenge.cards = shuffle(Array.from({length:Math.min(4+Math.floor(score/3),8)},(_,i)=>i));
      challenge.target = challenge.cards[Math.floor(Math.random()*challenge.cards.length)];
      challenge.reveal_ms=2700; expected=challenge.cards.indexOf(challenge.target); break;
    }
    case 'freeze-frame': {
      challenge.size=Math.min(4+Math.floor(score/5),6);
      challenge.cells=patternGenerator.generateGridPattern(challenge.size,Math.min(3+Math.floor(score/3),12)).map(p=>p.id);
      challenge.reveal_ms=Math.max(1500,4000-score*100); expected=challenge.cells; break;
    }
    case 'reverse-sequence': {
      challenge.sequence=Array.from({length:Math.min(3+Math.floor(score/3),8)},()=>Math.floor(Math.random()*6));
      challenge.interval_ms=Math.max(500,1000-score*30); challenge.reveal_ms=challenge.sequence.length*challenge.interval_ms+500;
      expected=[...challenge.sequence].reverse(); break;
    }
    case 'trail-tracker': {
      challenge.size=5; challenge.sequence=patternGenerator.generateTrail(5,Math.min(4+Math.floor(score/3),15),score<5?'easy':'medium').map(p=>p.id);
      challenge.interval_ms=Math.max(350,750-score*15); challenge.reveal_ms=challenge.sequence.length*challenge.interval_ms+500;
      expected=challenge.sequence; break;
    }
    case 'palette-recall': {
      challenge.palette=colorTheory.generatePalette(Math.min(3+Math.floor(score/5),5),Math.min(score*2,100));
      challenge.target=Math.floor(Math.random()*challenge.palette.length);
      const color=challenge.palette[challenge.target];
      challenge.options=shuffle([color,...colorTheory.generateDistractors(color,3,Math.min(score*2,100))]);
      challenge.reveal_ms=Math.max(2000,5000-score*100); expected=challenge.options.indexOf(color); break;
    }
    case 'quick-reflex': {
      challenge.target=Math.floor(Math.random()*6); const targetAt=2+Math.floor(Math.random()*5);
      challenge.sequence=Array.from({length:targetAt},()=>{let c=Math.floor(Math.random()*5);if(c>=challenge.target)c++;return c;});
      challenge.sequence.push(challenge.target); challenge.interval_ms=Math.max(450,1000-score*25);
      challenge.limit_ms=(targetAt+1)*challenge.interval_ms; expected=targetAt; break;
    }
    case 'speed-typist': challenge.words=Array.from({length:150},()=>sprintWords[Math.floor(Math.random()*sprintWords.length)]); challenge.duration_ms=30000; challenge.limit_ms=30000; expected=challenge.words; break;
  }
  if(mode!=='quick-reflex' && mode!=='speed-typist') challenge.limit_ms+=challenge.reveal_ms;
  return {challenge,expected};
}
export function answerMatches(mode:GameMode, answer:Answer, expected:Answer) {
  if(mode==='quick-reflex' && answer && typeof answer==='object' && 'pick' in answer) return answer.pick===expected && (answer.ms===undefined || answer.ms>=100);
  if(mode==='freeze-frame' && Array.isArray(answer) && Array.isArray(expected)) return JSON.stringify([...answer as number[]].sort((a,b)=>a-b))===JSON.stringify([...expected as number[]].sort((a,b)=>a-b));
  return JSON.stringify(answer)===JSON.stringify(expected);
}
const key='dopamine-practice-history';
export function practiceHistory():GameResult[] { try { const data=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(data)?data.filter(r=>r && typeof r.score==='number' && typeof r.game_mode==='string').slice(0,100):[]; } catch {return [];} }
export function savePractice(result:GameResult) {try{localStorage.setItem(key,JSON.stringify([result,...practiceHistory()].slice(0,100)));}catch{/* Private browsing can disable storage. */}}
