import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const db = new PGlite();
const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222';
async function asUser(id:string,sql:string,params:unknown[]=[]){
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`);
  try{return await db.query(sql,params);}finally{await db.exec('RESET ROLE');}
}
async function start(mode='classic',user=alice){
  const r=await asUser(user,'SELECT start_game($1,$2) id',[mode,crypto.randomUUID()]);return (r.rows[0] as {id:string}).id;
}
async function round(id:string,user=alice){return asUser(user,'SELECT get_game_round($1) payload',[id]);}
async function answer(id:string,index:number,value:unknown,user=alice){return asUser(user,'SELECT answer_round($1,$2,$3) response',[id,index,JSON.stringify(value)]);}
async function pass(id:string,index:number){
  await round(id);
  const r=await db.query<{expected:unknown}>('SELECT expected FROM game_sessions WHERE id=$1',[id]);
  await db.query("UPDATE game_sessions SET round_started_at=clock_timestamp()-interval '20 seconds' WHERE id=$1",[id]);
  return answer(id,index,r.rows[0].expected);
}
beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}');`);
  const dir=resolve('supabase/migrations');
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(resolve(dir,file),'utf8').replace(/create extension if not exists pgcrypto;/gi,''));
  }
},60000);
afterAll(()=>db.close());
describe('server scoring and authorization',()=>{
  it('rejects direct score writes and private session reads',async()=>{
    await expect(asUser(alice,"INSERT INTO game_scores(user_id,score) VALUES($1,999)",[alice])).rejects.toThrow(/permission denied/);
    await expect(asUser(alice,'SELECT expected FROM game_sessions')).rejects.toThrow(/permission denied/);
    await expect(asUser(alice,'SELECT email FROM profiles')).rejects.toThrow(/permission denied/);
  });
  it('generates all seven modes without exposing expected answers',async()=>{
    for(const mode of ['classic','freeze-frame','reverse-sequence','quick-reflex','trail-tracker','palette-recall','speed-typist']){
      const id=await start(mode);const r=await round(id);const p=(r.rows[0] as {payload:Record<string,unknown>}).payload;
      expect(p.mode).toBe(mode);expect(p.expected).toBeUndefined();expect(p.limit_ms).toBeGreaterThan(0);
    }
  });
  it('rejects answers before the reveal ends and cross-user access',async()=>{
    const id=await start();await round(id);
    await expect(answer(id,0,0)).rejects.toThrow(/before recall/);
    await expect(round(id,bob)).rejects.toThrow(/not active/);
    await expect(answer(id,0,{quit:true},bob)).rejects.toThrow(/not found/);
  });
  it('retries identical submissions without awarding twice and rejects changed replays',async()=>{
    const id=await start();await pass(id,0);await round(id);
    const first=await answer(id,1,{quit:true});const repeated=await answer(id,1,{quit:true});
    expect(repeated.rows).toEqual(first.rows);
    await expect(answer(id,1,42)).rejects.toThrow(/already answered/);
    const saved=await db.query<{score:number;xp_earned:number}>('SELECT score,xp_earned FROM game_scores WHERE session_id=$1',[id]);
    expect(saved.rows).toEqual([{score:1,xp_earned:20}]);
  });
  it('rejects guessed round indexes and expired correct answers',async()=>{
    const id=await start();await round(id);
    await expect(answer(id,10,{quit:true})).rejects.toThrow(/Invalid round/);
    const r=await db.query<{expected:unknown}>('SELECT expected FROM game_sessions WHERE id=$1',[id]);
    await db.query("UPDATE game_sessions SET round_started_at=clock_timestamp()-interval '10 minutes' WHERE id=$1",[id]);
    const result=await answer(id,0,r.rows[0].expected);
    expect((result.rows[0] as {response:{result:{score:number}}}).response.result.score).toBe(0);
  });
  it('ranks only verified personal bests, with a stable rank across pagination',async()=>{
    await db.query("INSERT INTO game_scores(user_id,game_mode,score,streak,verified) VALUES($1,'classic',900,900,false)",[alice]);
    const board=await asUser(alice,"SELECT get_leaderboard('classic','all',0) data");
    const data=(board.rows[0] as {data:{entries:{score:number}[];my_rank:number}}).data;
    expect(data.entries.every(e=>e.score<900)).toBe(true);expect(data.my_rank).toBe(1);
  });
  it('aggregates progression and keeps private fields out of public profiles',async()=>{
    const result=await asUser(bob,'SELECT player_summary($1) data',[alice]);
    const data=(result.rows[0] as {data:Record<string,unknown>}).data;
    expect(data.email).toBeUndefined();expect(data.xp).toBe(20);expect(data.legacy_games).toBe(1);
  });
});
