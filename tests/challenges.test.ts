import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const db = new PGlite();
const alice='33333333-3333-4333-8333-333333333333', bob='44444444-4444-4444-8444-444444444444', cara='55555555-5555-4555-8555-555555555555';
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
async function expected(session:string){return (await db.query<{expected:unknown}>('SELECT expected FROM game_sessions WHERE id=$1',[session])).rows[0].expected;}
async function age(session:string,ms:number){await db.query(`UPDATE game_sessions SET round_started_at=clock_timestamp()-make_interval(secs=>$2::numeric/1000) WHERE id=$1`,[session,ms]);}
/** Clears one round with a realistic recall time. */
async function clear(id:string,session:string,index:number){await round(id,session);await age(session,20000);return answer(id,session,index,await expected(session));}
async function quit(id:string,session:string,index:number){await round(id,session);await age(session,20000);return answer(id,session,index,{quit:true});}

beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${cara}');`);
  const dir=resolve('supabase/migrations');
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())
    await db.exec(readFileSync(resolve(dir,file),'utf8').replace(/create extension if not exists pgcrypto;/gi,''));
},60000);
afterAll(()=>db.close());

describe('seeded rounds and the daily challenge',()=>{
  it('gives every player the same daily rounds and counts only the first attempt',async()=>{
    const mode=dailyMode();
    const a=await start(alice,mode,'daily'),b=await start(bob,mode,'daily');
    const ra=await round(alice,a),rb=await round(bob,b);
    expect(ra).toEqual(rb);
    await expect(start(alice,modes[(modes.indexOf(mode)+1)%7],'daily')).rejects.toThrow(/today/);
    // Leaving a counted attempt still records its score.
    await user(alice,'SELECT abandon_game($1)',[a]);
    const replay=await start(alice,mode,'daily');
    const kinds=await db.query<{kind:string}>('SELECT kind FROM game_sessions WHERE id=$1',[replay]);
    expect(kinds.rows[0].kind).toBe('daily_replay');
    await quit(bob,b,0);
    const daily=(await as('anon',null,'SELECT get_daily() d'))[0].d as {number:number;game_mode:string;players:number;entries:unknown[]};
    expect(daily.game_mode).toBe(mode);expect(daily.players).toBe(2);expect(daily.number).toBeGreaterThanOrEqual(0);
  });
  it('keeps standard runs unpredictable',async()=>{
    const a=await start(alice,'freeze-frame'),b=await start(bob,'freeze-frame');
    const ra=await round(alice,a),rb=await round(bob,b);
    expect(JSON.stringify(ra.cells)===JSON.stringify(rb.cells)&&JSON.stringify(ra)===JSON.stringify(rb)).toBe(false);
  });
});

describe('challenge links',()=>{
  it('replays the creator\'s exact rounds and ranks first attempts',async()=>{
    const s=await start(alice,'trail-tracker');const first=await round(alice,s);
    await clear(alice,s,0);await clear(alice,s,1);const done=await quit(alice,s,2);
    const scoreId=(done.result as Row).id as string;
    await expect(user(bob,'SELECT create_challenge($1)',[scoreId])).rejects.toThrow(/cannot be shared/);
    const slug=(await user(alice,'SELECT create_challenge($1) s',[scoreId]))[0].s as string;
    expect(slug).toMatch(/^[2-9a-zA-Z]{7}$/);
    expect((await user(alice,'SELECT create_challenge($1) s',[scoreId]))[0].s).toBe(slug);
    const b=await start(bob,'trail-tracker','challenge',slug);
    expect(await round(bob,b)).toEqual(first);
    await clear(bob,b,0);await clear(bob,b,1);await clear(bob,b,2);await quit(bob,b,3);
    // A second attempt by the same player does not replace the first.
    const again=await start(bob,'trail-tracker','challenge',slug);await quit(bob,again,0);
    const view=(await as('anon',null,'SELECT get_challenge($1) c',[slug]))[0].c as {attempts:number;creator:{score:number};entries:{username:string;score:number;creator:boolean}[]};
    expect(view.attempts).toBe(1);expect(view.creator.score).toBe(2);
    expect(view.entries.map(e=>[e.score,e.creator])).toEqual([[3,false],[2,true]]);
    await expect(start(cara,'classic','challenge',slug)).rejects.toThrow(/Invalid game/);
    await expect(as('anon',null,'SELECT create_challenge($1)',[scoreId])).rejects.toThrow(/permission denied/);
  });
});

describe('reaction time and plausibility',()=>{
  async function reflexRound(session:string,index:number,ms:number){
    const p=await round(bob,session);const pick=Number(await expected(session));
    await age(session,pick*Number(p.interval_ms)+300);
    return answer(bob,session,index,{pick,ms});
  }
  it('records measured reaction times and rejects anticipation',async()=>{
    const s=await start(bob,'quick-reflex');
    expect((await reflexRound(s,0,240)).correct).toBe(true);
    expect((await reflexRound(s,1,210)).correct).toBe(true);
    const end=await reflexRound(s,2,60);
    expect(end.correct).toBe(false);
    const result=end.result as {score:number;best_ms:number;avg_ms:number;flagged:boolean};
    expect(result).toMatchObject({score:2,best_ms:210,avg_ms:225,flagged:false});
  });
  it('hides runs with inhumanly fast answers from the leaderboard',async()=>{
    const s=await start(cara,'classic');
    for(let i=0;i<3;i++){await round(cara,s);const p=await round(cara,s);await age(s,Number(p.reveal_ms)+10);await answer(cara,s,i,await expected(s));}
    const done=await quit(cara,s,3);
    expect((done.result as Row).flagged).toBe(true);
    const board=(await as('anon',null,"SELECT get_leaderboard('classic','all',0) b"))[0].b as {entries:{user_id:string}[]};
    expect(board.entries.some(e=>e.user_id===cara)).toBe(false);
  });
});
