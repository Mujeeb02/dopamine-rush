import { describe, expect, it } from 'vitest';
import { freezeCredit, typingStats } from '../src/lib/scoring';
import { headlineNumber, shareText } from '../src/lib/share';
import { formatScore } from '../src/lib/games';
import { practiceRound } from '../src/lib/practice';

describe('Freeze Frame credit',()=>{
  it('counts right cells, cancels them with wrong picks and needs the exact pattern to clear',()=>{
    expect(freezeCredit([1,2,3],[1,2,3])).toEqual({hit:3,wrong:0,credited:3,exact:true});
    expect(freezeCredit([1,2,9],[1,2,3])).toEqual({hit:2,wrong:1,credited:1,exact:false});
    expect(freezeCredit([0,1,2,3,4,5,6,7],[1,2,3])).toMatchObject({credited:0,exact:false});
    expect(freezeCredit([1,1,2,2,3],[1,2,3]).exact).toBe(true);
  });
});

describe('Speed Typist sprint',()=>{
  const words=['the','quick','brain','focus','again'];
  it('scores exact words with their space, five characters to a word, over 30 seconds',()=>{
    // "the " + "quick " = 10 characters = 2 words in half a minute = 4 WPM.
    expect(typingStats('the quick',words)).toMatchObject({goodWords:2,goodChars:10,wpm:4,accuracy:100});
  });
  it('ignores a word cut off by the clock but counts a finished wrong one',()=>{
    expect(typingStats('the quack bra',words)).toMatchObject({goodWords:1,typedWords:2,accuracy:50});
    expect(typingStats('',words)).toMatchObject({wpm:0,accuracy:null});
  });
  it('practises on a long enough list of words',()=>{
    const {challenge,expected}=practiceRound('speed-typist',0);
    expect(challenge.words).toHaveLength(150);expect(expected).toEqual(challenge.words);expect(challenge.duration_ms).toBe(30000);
  });
});

describe('scores carry their own unit',()=>{
  it('labels cells, words per minute and rounds',()=>{
    expect(formatScore('freeze-frame',1)).toBe('1 cell');
    expect(formatScore('speed-typist',62)).toBe('62 WPM');
    expect(formatScore('classic',4)).toBe('4 rounds');
    expect(headlineNumber('freeze-frame',{score:42,best_ms:null})).toEqual({value:'42 cells',label:'recalled'});
  });
  it('shares a daily sprint without a round grid',()=>{
    expect(shareText('speed-typist',{score:61,best_ms:null,daily_number:3,accuracy:96})).toBe('Dopamine Rush #3 ⚡ Speed Typist\n⌨️ 61 WPM · 96% accuracy');
    expect(shareText('freeze-frame',{score:40,best_ms:null,daily_number:3,rounds:2})).toBe('Dopamine Rush #3 ⚡ Freeze Frame\n🟩🟩🟥 2 rounds · 40 cells');
  });
});
