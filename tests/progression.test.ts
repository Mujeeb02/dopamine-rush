import { beforeAll, describe, expect, it, vi } from 'vitest';
import { levelFromXp, streaks, achievements, dailyChallenge } from '../src/lib/progression';
import { practiceRound, answerMatches } from '../src/lib/practice';
import { PatternGenerator } from '../src/lib/game-logic/PatternGenerator';
import { games } from '../src/lib/games';

describe('progression from recorded play',()=>{
  it('computes exact level thresholds without negative progress',()=>{
    expect(levelFromXp(-50)).toMatchObject({level:1,current:0,needed:100});
    expect(levelFromXp(99)).toMatchObject({level:1,current:99});
    expect(levelFromXp(100)).toMatchObject({level:2,current:0,needed:300});
    expect(levelFromXp(400)).toMatchObject({level:3,current:0,needed:500});
  });
  it('deduplicates UTC days and permits yesterday to keep a streak alive',()=>{
    const now=new Date('2026-09-23T00:01:00Z');
    expect(streaks(['2026-09-22','2026-09-22','2026-09-21','2026-09-18'],now)).toEqual({current:2,longest:2});
    expect(streaks(['2026-09-21','2026-09-20','2026-09-19'],now)).toEqual({current:0,longest:3});
    expect(streaks([],now)).toEqual({current:0,longest:0});
  });
  it('rotates seven challenges at UTC midnight and repeats after seven days',()=>{
    const before=dailyChallenge(new Date('2026-09-22T23:59:59Z'));
    const after=dailyChallenge(new Date('2026-09-23T00:00:00Z'));
    expect(before.game.id).not.toBe(after.game.id);
    expect(dailyChallenge(new Date('2026-09-30T00:00:00Z')).game.id).toBe(after.game.id);
  });
  it('unlocks only earned achievements',()=>{
    expect(achievements({}).some(a=>a.unlocked)).toBe(false);
    const earned=achievements({games:1,best:5,modes:1,longest_streak:1});
    expect(earned.filter(a=>a.unlocked).map(a=>a.id)).toEqual(['first','five']);
  });
});
describe('practice engine preserves seven game mechanics',()=>{
  it('generates valid answers and rejects incorrect answers at every difficulty',()=>{
    for(const game of games)for(const score of [0,5,25,100]){
      const {challenge,expected}=practiceRound(game.id,score);
      expect(challenge.limit_ms).toBeGreaterThan(challenge.reveal_ms);
      expect(answerMatches(game.id,expected,expected)).toBe(true);
      expect(answerMatches(game.id,{timeout:true},expected)).toBe(false);
      if(challenge.sequence&&game.id==='trail-tracker')expect(new Set(challenge.sequence).size).toBe(challenge.sequence.length);
    }
    expect(answerMatches('freeze-frame',[3,1],[1,3])).toBe(true);
    expect(answerMatches('freeze-frame',[1,1],[1,3])).toBe(false);
  });
  it('bounds path regeneration even with a pathological random source',()=>{
    const random=vi.spyOn(Math,'random').mockReturnValue(.51);
    try{const path=new PatternGenerator().generateTrail(5,25,'easy');
      expect(path).toHaveLength(25);expect(new Set(path.map(p=>p.id)).size).toBe(25);
      path.slice(1).forEach((p,i)=>expect(Math.abs(p.x-path[i].x)+Math.abs(p.y-path[i].y)).toBe(1));
    }finally{random.mockRestore();}
  });
});
