import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const db = new PGlite();
const alice='66666666-6666-4666-8666-666666666666', bob='77777777-7777-4777-8777-777777777777', cara='88888888-8888-4888-8888-888888888888', dan='99999999-9999-4999-8999-999999999999';
const modes=['classic','freeze-frame','reverse-sequence','quick-reflex','trail-tracker','palette-recall','speed-typist'];
const today=()=>new Date().toISOString().slice(0,10);
const dailyMode=()=>modes[Math.floor(Date.parse(today()+'T00:00:00Z')/86400000)%7];
type Row=Record<string,unknown>;
async function as(role:'authenticated'|'anon',id:string|null,sql:string,params:unknown[]=[]){
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id??''}',false); SET ROLE ${role};`);
  try{return (await db.query<Row>(sql,params)).rows;}finally{await db.exec('RESET ROLE');}
}
const user=(id:string,sql:string,params:unknown[]=[])=>as('authenticated',id,sql,params);
async function start(id:string,mode:string,kind='standard',slug:string|null=null){
  return (await user(id,'SELECT start_game($1,$2,$3,$4) id',[mode,crypto.randomUUID(),kind,slug]))[0].id as string;
}
async function round(id:string,session:string){return (await user(id,'SELECT get_game_round($1) p',[session]))[0].p as Row;}
async function answer(id:string,session:string,index:number,value:unknown){
  return (await user(id,'SELECT answer_round($1,$2,$3) r',[session,index,JSON.stringify(value)]))[0].r as Row;
}
async function expected<T=unknown>(session:string){return (await db.query<{expected:T}>('SELECT expected FROM game_sessions WHERE id=$1',[session])).rows[0].expected;}
async function age(session:string,ms:number){await db.query(`UPDATE game_sessions SET round_started_at=clock_timestamp()-make_interval(secs=>$2::numeric/1000) WHERE id=$1`,[session,ms]);}

beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${cara}'),('${dan}');`);
  const dir=resolve('supabase/migrations');
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())
    await db.exec(readFileSync(resolve(dir,file),'utf8').replace(/create extension if not exists pgcrypto;/gi,''));
},60000);
afterAll(()=>db.close());

describe('Freeze Frame: cells recalled and one life',()=>{
  /** Answers the current round with the given picks after a realistic recall time. */
  async function play(session:string,pick:(cells:number[],size:number)=>number[]){
    const p=await round(alice,session);const cells=await expected<number[]>(session);
    await age(session,20000);
    return {p,cells,r:await answer(alice,session,Number(p.round),pick(cells,Number(p.size)))};
  }
  it('credits cells, spends the life on the first miss and ends on the second',async()=>{
    const s=await start(alice,'freeze-frame');
    const first=await play(s,c=>c);
    expect(first.r).toMatchObject({correct:true,completed:false,score:1,cells:first.cells.length});
    // One cell missed and one wrong pick: they cancel, so nothing is credited.
    const missed=await play(s,(c,size)=>[...c.slice(1),[...Array(size*size).keys()].find(x=>!c.includes(x))!]);
    expect(missed.r).toMatchObject({correct:false,completed:false,life_used:true,score:1,pattern:missed.cells});
    expect(missed.r.cells).toBe(first.cells.length+missed.cells.length-2);
    // The retry is the same level, a new round number and a fresh pattern.
    const third=await play(s,c=>c.slice(0,2));
    expect(third.p.round).toBe(2);
    expect(third.r).toMatchObject({completed:true,pattern:third.cells});
    const result=third.r.result as {score:number;rounds:number;lives_used:number;xp_earned:number};
    expect(result).toMatchObject({score:Number(missed.r.cells)+2,rounds:1,lives_used:2,xp_earned:20});
  });
  it('gives nothing for selecting every cell',async()=>{
    const s=await start(alice,'freeze-frame');
    const r=(await play(s,(_c,size)=>[...Array(size*size).keys()])).r;
    expect(r).toMatchObject({life_used:true,cells:0});
  });
  it('keeps challenge players on identical rounds after a life',async()=>{
    const s=await start(alice,'freeze-frame');
    await play(s,c=>c);await play(s,()=>[]);
    const done=await play(s,()=>[]);
    const slug=(await user(alice,'SELECT create_challenge($1) s',[(done.r.result as Row).id]))[0].s as string;
    const b=await start(bob,'freeze-frame','challenge',slug);
    const seen:unknown[]=[];
    for(let i=0;i<3;i++){const p=await round(bob,b);seen.push(p.cells);const cells=await expected<number[]>(b);await age(b,20000);await answer(bob,b,Number(p.round),i===0?cells:[]);}
    // Same rounds: the creator's final pattern is the challenger's third.
    expect(seen[2]).toEqual(done.cells);
  });
});

describe('Speed Typist: a 30-second sprint in words per minute',()=>{
  async function sprint(id:string,typed:(words:string[])=>string,ms=30200){
    const s=await start(id,'speed-typist');const p=await round(id,s);
    await age(s,ms);
    return {words:p.words as string[],r:await answer(id,s,0,{typed:typed(p.words as string[])})};
  }
  it('scores correct words only and ignores a word cut off by the clock',async()=>{
    const {words,r}=await sprint(cara,w=>[...w.slice(0,20),'zzz',w[21],w[22].slice(0,1)].join(' '));
    const chars=words.slice(0,20).reduce((n,w)=>n+w.length+1,0)+words[21].length+1;
    expect(r).toMatchObject({correct:true,completed:true,wpm:Math.round(chars*2/5),accuracy:Math.round(21*100/22)});
    expect(r.result).toMatchObject({score:Math.round(chars*2/5),rounds:0,flagged:false});
  });
  it('scores nothing for a late submission and flags impossible speed',async()=>{
    expect((await sprint(cara,w=>w.slice(0,10).join(' '),40000)).r).toMatchObject({wpm:0,correct:false});
    const fast=await sprint(cara,w=>w.join(' '));
    expect((fast.r.result as Row).flagged).toBe(true);
  });
});

describe('streaks built on the daily challenge',()=>{
  const day=(offset:number)=>{const d=new Date(Date.parse(today()+'T00:00:00Z')+offset*86400000);return d.toISOString().slice(0,10);};
  async function days(id:string,offsets:number[]){
    await db.query('DELETE FROM daily_challenge_completions WHERE user_id=$1',[id]);
    for(const o of offsets)await db.query('INSERT INTO daily_challenge_completions(user_id,challenge_day) VALUES($1,$2)',[id,day(o)]);
    return (await db.query<{s:{current:number;longest:number;freezes:number;frozen_days:string[]}}>('SELECT _streaks($1,$2::date) s',[id,today()])).rows[0].s;
  }
  it('counts consecutive days and forgives one missed day after seven',async()=>{
    expect(await days(dan,[-2,-1,0])).toMatchObject({current:3,longest:3,freezes:0});
    // Seven days earn a freeze, which covers day -3. A frozen day protects the
    // streak but doesn't add to it.
    expect(await days(dan,[-10,-9,-8,-7,-6,-5,-4,-2,-1])).toMatchObject({current:9,freezes:0,frozen_days:[day(-3)]});
    // Without a freeze, a missed day resets the streak.
    expect(await days(dan,[-5,-4,-2,-1])).toMatchObject({current:2,longest:2});
    // Two missed days in a row are more than one freeze covers.
    expect(await days(dan,[-10,-9,-8,-7,-6,-5,-4,-1])).toMatchObject({current:1,longest:7});
  });
  it('keeps a streak alive while a freeze covers yesterday',async()=>{
    expect(await days(dan,[-8,-7,-6,-5,-4,-3,-2])).toMatchObject({current:7,freezes:0,frozen_days:[day(-1)]});
    expect(await days(dan,[-9,-8,-7,-6,-5,-4,-3])).toMatchObject({current:0,longest:7});
  });
  it('records every counted daily attempt and pays the bonus only for a score',async()=>{
    await db.query('DELETE FROM daily_challenge_completions WHERE user_id=$1',[dan]);
    const s=await start(dan,dailyMode(),'daily');
    await user(dan,'SELECT abandon_game($1)',[s]);
    const rows=(await db.query<{reward:number}>('SELECT reward FROM daily_challenge_completions WHERE user_id=$1 AND challenge_day=$2',[dan,today()])).rows;
    expect(rows).toEqual([{reward:0}]);
    const summary=(await user(dan,'SELECT player_summary($1) d',[dan]))[0].d as Row;
    expect(summary).toMatchObject({current_streak:1,daily_completed:true});
  });
});

describe('one unit per game on the boards',()=>{
  it('keeps older round-based typing scores out of words-per-minute rankings',async()=>{
    await db.query("INSERT INTO game_scores(user_id,game_mode,score,streak,verified) VALUES($1,'speed-typist',990,990,true)",[bob]);
    const board=(await as('anon',null,"SELECT get_leaderboard('speed-typist','all',0) b"))[0].b as {entries:{user_id:string;score:number}[]};
    expect(board.entries.some(e=>e.score===990)).toBe(false);
    expect(board.entries.length).toBeGreaterThan(0);
  });
});
