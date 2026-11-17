-- Seeded rounds, challenge links, a numbered daily challenge, measured reaction
-- times, plausibility flags and housekeeping. Additive: existing runs stay valid.

-- ── Schema ─────────────────────────────────────────────────────────────────
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS seed bigint,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS challenge_id uuid,
  ADD COLUMN IF NOT EXISTS daily_day date,
  ADD COLUMN IF NOT EXISTS metric jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_kind;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_kind CHECK (kind IN ('standard','daily','daily_replay','challenge'));
-- One counted daily attempt per player per day.
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_one_daily ON public.game_sessions(user_id,daily_day) WHERE kind='daily';

ALTER TABLE public.round_receipts
  ADD COLUMN IF NOT EXISTS elapsed_ms integer,
  ADD COLUMN IF NOT EXISTS client_ms integer;

ALTER TABLE public.game_scores
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS challenge_id uuid,
  ADD COLUMN IF NOT EXISTS daily_day date,
  ADD COLUMN IF NOT EXISTS best_ms integer,
  ADD COLUMN IF NOT EXISTS avg_ms integer,
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_score_id uuid NOT NULL UNIQUE REFERENCES public.game_scores(id) ON DELETE CASCADE,
  game_mode text NOT NULL,
  seed bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenges FROM PUBLIC, anon, authenticated;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_challenge_fk FOREIGN KEY(challenge_id) REFERENCES public.challenges(id) ON DELETE SET NULL;
ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_challenge_fk FOREIGN KEY(challenge_id) REFERENCES public.challenges(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS game_scores_by_challenge ON public.game_scores(challenge_id,user_id,created_at) WHERE challenge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS game_scores_by_daily ON public.game_scores(daily_day,score DESC) WHERE kind='daily';

-- ── Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._daily_mode(d date) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public
AS $$ SELECT (public._game_modes())[1+mod(d-date '1970-01-01',7)] $$;
-- Daily #1 is the first day this feature ships.
CREATE OR REPLACE FUNCTION public._daily_number(d date) RETURNS integer LANGUAGE sql IMMUTABLE
AS $$ SELECT d-date '2026-11-17' $$;
CREATE OR REPLACE FUNCTION public._unit_hash(t text) RETURNS double precision LANGUAGE sql IMMUTABLE
AS $$ SELECT (hashtextextended(t,0)::numeric/9223372036854775808.0)::double precision $$;

-- Same seed and round number give the same round for every player.
CREATE OR REPLACE FUNCTION public._seeded_challenge(mode text,n integer,seed bigint) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE payload jsonb;
BEGIN
  PERFORM setseed(public._unit_hash(seed::text||':'||n));
  payload:=public._make_challenge(mode,n);
  -- Return this connection's random stream to an unpredictable state.
  PERFORM setseed(public._unit_hash(gen_random_uuid()::text));
  RETURN payload;
END $$;

-- ── Runs ───────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.start_game(text,uuid);
CREATE FUNCTION public.start_game(p_mode text,p_request uuid,p_kind text DEFAULT 'standard',p_challenge text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid; c challenges; k text:=coalesce(p_kind,'standard'); sd bigint; dday date; old_id uuid;
  today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_mode IS NULL OR NOT p_mode=ANY(public._game_modes()) OR p_request IS NULL OR k NOT IN ('standard','daily','challenge') THEN RAISE EXCEPTION 'Invalid game'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT id INTO sid FROM game_sessions WHERE user_id=uid AND request_id=p_request;
  IF sid IS NOT NULL THEN RETURN sid; END IF;
  IF (SELECT count(*) FROM game_sessions WHERE user_id=uid AND started_at>clock_timestamp()-interval '15 minutes')>=60 THEN RAISE EXCEPTION 'Please wait before starting another run'; END IF;
  sd:=hashtextextended(gen_random_uuid()::text,0);
  IF k='challenge' THEN
    SELECT * INTO c FROM challenges WHERE slug=p_challenge;
    IF NOT FOUND OR c.expires_at<now() THEN RAISE EXCEPTION 'Challenge not found'; END IF;
    IF c.game_mode<>p_mode THEN RAISE EXCEPTION 'Invalid game'; END IF;
    sd:=c.seed;
  ELSIF k='daily' THEN
    IF p_mode<>public._daily_mode(today) THEN RAISE EXCEPTION 'Not today''s challenge'; END IF;
    sd:=hashtextextended('daily:'||today::text,0);
    IF EXISTS(SELECT 1 FROM game_sessions WHERE user_id=uid AND kind='daily' AND daily_day=today) THEN k:='daily_replay'; ELSE dday:=today; END IF;
  END IF;
  -- New and guest players get a distinguishable default name until they choose one.
  INSERT INTO profiles(id,username) VALUES(uid,'Player-'||substr(replace(uid::text,'-',''),1,4)) ON CONFLICT(id) DO NOTHING;
  -- A counted daily attempt keeps its score even if the player leaves it.
  FOR old_id IN SELECT id FROM game_sessions WHERE user_id=uid AND status='active' AND kind='daily' LOOP PERFORM public._finish_game(old_id); END LOOP;
  UPDATE game_sessions SET status='abandoned',challenge=NULL,expected=NULL WHERE user_id=uid AND status='active';
  INSERT INTO game_sessions(user_id,game_mode,request_id,seed,kind,challenge_id,daily_day)
    VALUES(uid,p_mode,p_request,sd,k,c.id,dday) RETURNING id INTO sid;
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.get_game_round(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; payload jsonb;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR s.status<>'active' THEN RAISE EXCEPTION 'Run is not active'; END IF;
  IF clock_timestamp()-s.started_at>interval '30 minutes' THEN RAISE EXCEPTION 'Run expired'; END IF;
  IF s.challenge IS NOT NULL THEN RETURN s.challenge; END IF;
  payload:=CASE WHEN s.seed IS NULL THEN public._make_challenge(s.game_mode,s.score) ELSE public._seeded_challenge(s.game_mode,s.score,s.seed) END;
  UPDATE game_sessions SET challenge=payload->'public',expected=payload->'expected',round_started_at=clock_timestamp() WHERE id=s.id;
  RETURN payload->'public';
END $$;

CREATE OR REPLACE FUNCTION public._finish_game(sid uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s game_sessions; prior integer; prior_ms integer; earned integer; bonus integer:=0; score_id uuid; output jsonb;
  today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date; ms integer; inserted integer; best integer; avg_v integer; samples integer; flag boolean;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=sid;
  SELECT coalesce(max(score),0),min(best_ms) INTO prior,prior_ms FROM game_scores WHERE user_id=s.user_id AND game_mode=s.game_mode AND verified;
  IF s.score>=5 AND s.game_mode=public._daily_mode(today) AND (s.started_at AT TIME ZONE 'UTC')::date=today THEN
    INSERT INTO daily_challenge_completions(user_id,challenge_day,session_id) VALUES(s.user_id,today,s.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=1 THEN bonus:=150; END IF;
  END IF;
  earned:=least(s.score*20,2000)+bonus;
  ms:=least(1800000,greatest(0,extract(epoch FROM clock_timestamp()-s.started_at)*1000))::int;
  SELECT min(v::int),round(avg(v::int))::int,count(*) INTO best,avg_v,samples FROM jsonb_array_elements_text(coalesce(s.metric->'ms','[]'::jsonb)) v;
  -- Hidden from rankings, never deleted: two inhumanly fast rounds, or a reflex average no person sustains.
  flag:=coalesce((s.metric->>'suspicious')::int,0)>=2 OR (samples>=3 AND avg_v<140);
  INSERT INTO game_scores(user_id,game_mode,score,streak,session_id,verified,duration_ms,xp_earned,kind,challenge_id,daily_day,best_ms,avg_ms,flagged)
    VALUES(s.user_id,s.game_mode,s.score,s.score,s.id,true,ms,earned,s.kind,s.challenge_id,s.daily_day,best,avg_v,flag) RETURNING id INTO score_id;
  output:=jsonb_build_object('id',score_id,'game_mode',s.game_mode,'score',s.score,'duration_ms',ms,
    'xp_earned',earned,'challenge_bonus',bonus,'personal_best',s.score>prior,'previous_best',prior,
    'best_ms',best,'avg_ms',avg_v,'previous_best_ms',prior_ms,'kind',s.kind,'flagged',flag,
    'daily_number',CASE WHEN s.daily_day IS NOT NULL THEN public._daily_number(s.daily_day) END,
    'created_at',clock_timestamp(),'verified',true);
  UPDATE game_sessions SET status='completed',result=output,challenge=NULL,expected=NULL WHERE id=sid;
  RETURN output;
END $$;

CREATE OR REPLACE FUNCTION public.answer_round(p_session uuid,p_round integer,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; old round_receipts; elapsed numeric; correct boolean; response jsonb; normalized jsonb;
  client_ms integer; since_target numeric; recall numeric; steps integer; suspicious boolean:=false; m jsonb;
BEGIN
  IF p_answer IS NULL OR p_round IS NULL OR octet_length(p_answer::text)>2048 THEN RAISE EXCEPTION 'Invalid answer'; END IF;
  SELECT * INTO s FROM game_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Run not found'; END IF;
  SELECT * INTO old FROM round_receipts WHERE session_id=s.id AND round_index=p_round;
  IF FOUND THEN
    IF old.answer<>p_answer THEN RAISE EXCEPTION 'Round already answered'; END IF;
    RETURN old.response;
  END IF;
  IF s.status<>'active' OR p_round<>s.round_index OR s.challenge IS NULL THEN RAISE EXCEPTION 'Invalid round'; END IF;
  elapsed:=extract(epoch FROM clock_timestamp()-s.round_started_at)*1000;
  normalized:=p_answer;
  IF s.game_mode='freeze-frame' AND jsonb_typeof(p_answer)='array' THEN
    SELECT jsonb_agg(v::int ORDER BY v::int) INTO normalized FROM jsonb_array_elements_text(p_answer)v;
  END IF;
  IF s.game_mode='quick-reflex' AND jsonb_typeof(p_answer)='object' AND p_answer ? 'pick' THEN
    normalized:=p_answer->'pick';
    IF jsonb_typeof(p_answer->'ms')='number' THEN client_ms:=least(greatest((p_answer->>'ms')::numeric,0),60000)::int; END IF;
  END IF;
  IF elapsed<(s.challenge->>'reveal_ms')::int AND p_answer NOT IN ('{"quit":true}'::jsonb,'{"timeout":true}'::jsonb) THEN RAISE EXCEPTION 'Answer arrived before recall began'; END IF;
  correct:=normalized=s.expected AND elapsed<=(s.challenge->>'limit_ms')::int+1500
    AND clock_timestamp()-s.started_at<=interval '30 minutes';
  IF s.game_mode='quick-reflex' THEN
    since_target:=elapsed-(s.expected::text)::int*(s.challenge->>'interval_ms')::int;
    correct:=correct AND since_target>=0;
    -- The client's clock starts after the server's, so its reaction time can only
    -- trail the server's view. Under 100 ms is anticipation, not reaction.
    IF client_ms IS NOT NULL THEN
      correct:=correct AND client_ms BETWEEN 100 AND least((s.challenge->>'interval_ms')::int+100,since_target+150);
    END IF;
  END IF;
  IF s.game_mode='speed-typist' THEN correct:=correct AND elapsed>=250; END IF;
  correct:=coalesce(correct,false);
  IF correct THEN
    recall:=elapsed-(s.challenge->>'reveal_ms')::int;
    steps:=CASE WHEN jsonb_typeof(s.expected)='array' THEN jsonb_array_length(s.expected)
      WHEN s.game_mode='speed-typist' THEN length(s.expected#>>'{}') ELSE 1 END;
    suspicious:=CASE s.game_mode WHEN 'quick-reflex' THEN false
      WHEN 'speed-typist' THEN elapsed<steps*45
      ELSE recall<80*steps+150 END;
  END IF;
  m:=s.metric;
  IF suspicious THEN m:=jsonb_set(m,'{suspicious}',to_jsonb(coalesce((m->>'suspicious')::int,0)+1)); END IF;
  IF correct AND client_ms IS NOT NULL THEN m:=jsonb_set(m,'{ms}',coalesce(m->'ms','[]'::jsonb)||to_jsonb(client_ms)); END IF;
  UPDATE game_sessions SET metric=m WHERE id=s.id;
  IF correct AND s.score<999 THEN
    UPDATE game_sessions SET score=score+1,round_index=round_index+1,challenge=NULL,expected=NULL WHERE id=s.id;
    response:=jsonb_build_object('correct',true,'score',s.score+1,'completed',false,'ms',client_ms);
  ELSE
    IF correct THEN UPDATE game_sessions SET score=score+1 WHERE id=s.id; END IF;
    response:=jsonb_build_object('correct',correct,'completed',true,'ms',client_ms,'result',public._finish_game(s.id));
  END IF;
  INSERT INTO round_receipts(session_id,round_index,answer,response,elapsed_ms,client_ms) VALUES(s.id,p_round,p_answer,response,elapsed::int,client_ms);
  RETURN response;
END $$;

CREATE OR REPLACE FUNCTION public.abandon_game(p_session uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=p_session AND user_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF s.kind='daily' THEN PERFORM public._finish_game(s.id);
  ELSE UPDATE game_sessions SET status='abandoned',challenge=NULL,expected=NULL WHERE id=s.id; END IF;
END $$;

-- ── Challenges ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_challenge(p_score uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT g.id,g.game_mode,s.seed INTO r FROM game_scores g JOIN game_sessions s ON s.id=g.session_id
    WHERE g.id=p_score AND g.user_id=auth.uid() AND g.verified;
  IF NOT FOUND OR r.seed IS NULL THEN RAISE EXCEPTION 'This run cannot be shared as a challenge'; END IF;
  SELECT slug INTO v_slug FROM challenges WHERE source_score_id=p_score;
  IF v_slug IS NOT NULL THEN RETURN v_slug; END IF;
  IF (SELECT count(*) FROM challenges WHERE creator_id=auth.uid() AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Please wait before creating more challenges'; END IF;
  LOOP
    SELECT string_agg(substr('23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',1+floor(random()*55)::int,1),'') INTO v_slug FROM generate_series(1,7);
    EXIT WHEN NOT EXISTS(SELECT 1 FROM challenges WHERE slug=v_slug);
  END LOOP;
  INSERT INTO challenges(slug,creator_id,source_score_id,game_mode,seed) VALUES(v_slug,auth.uid(),p_score,r.game_mode,r.seed);
  RETURN v_slug;
END $$;

CREATE OR REPLACE FUNCTION public.get_challenge(p_slug text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c challenges; src game_scores; output jsonb;
BEGIN
  SELECT * INTO c FROM challenges WHERE slug=p_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  SELECT * INTO src FROM game_scores WHERE id=c.source_score_id;
  WITH attempts AS (
    SELECT DISTINCT ON (g.user_id) g.user_id,g.score,g.best_ms,g.created_at FROM game_scores g
    WHERE g.challenge_id=c.id AND g.verified AND NOT g.flagged AND g.user_id<>c.creator_id ORDER BY g.user_id,g.created_at
  ), everyone AS (
    SELECT user_id,score,best_ms,created_at,false AS creator FROM attempts
    UNION ALL SELECT src.user_id,src.score,src.best_ms,src.created_at,true
  )
  SELECT jsonb_build_object('slug',c.slug,'game_mode',c.game_mode,'expired',c.expires_at<now(),'created_at',c.created_at,
    'creator',jsonb_build_object('user_id',c.creator_id,'username',(SELECT coalesce(username,'Player') FROM profiles WHERE id=c.creator_id),'score',src.score,'best_ms',src.best_ms),
    'attempts',(SELECT count(*) FROM attempts),
    'mine',(SELECT jsonb_build_object('score',a.score,'best_ms',a.best_ms) FROM attempts a WHERE a.user_id=auth.uid()),
    'entries',coalesce((SELECT jsonb_agg(r) FROM (SELECT e.user_id,coalesce(p.username,'Player') username,e.score,e.best_ms,e.creator
      FROM everyone e JOIN profiles p ON p.id=e.user_id ORDER BY e.score DESC,e.best_ms NULLS LAST,e.created_at LIMIT 20) r),'[]'::jsonb)
  ) INTO output;
  RETURN output;
END $$;

-- ── Daily challenge ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE today date:=(now() AT TIME ZONE 'UTC')::date; output jsonb;
BEGIN
  IF p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
  WITH ranked AS (
    SELECT g.user_id,g.score,g.best_ms,g.created_at,coalesce(p.username,'Player') username,
      rank() OVER(ORDER BY g.score DESC,g.best_ms NULLS LAST) place
    FROM game_scores g JOIN profiles p ON p.id=g.user_id
    WHERE g.kind='daily' AND g.daily_day=today AND g.verified AND NOT g.flagged
  )
  SELECT jsonb_build_object('day',today,'number',public._daily_number(today),'game_mode',public._daily_mode(today),
    'players',(SELECT count(*) FROM ranked),
    'attempted',EXISTS(SELECT 1 FROM game_sessions WHERE user_id=auth.uid() AND kind='daily' AND daily_day=today),
    'mine',(SELECT jsonb_build_object('score',score,'best_ms',best_ms,'place',place) FROM ranked WHERE user_id=auth.uid()),
    'entries',coalesce((SELECT jsonb_agg(r) FROM (SELECT user_id,username,score,best_ms,place FROM ranked ORDER BY place,created_at LIMIT 25 OFFSET p_offset) r),'[]'::jsonb)
  ) INTO output;
  RETURN output;
END $$;

-- ── Leaderboard: flagged runs hidden, reaction time breaks ties ────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_mode text,p_period text DEFAULT 'all',p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE since timestamptz; output jsonb;
BEGIN
  IF p_mode IS NULL OR NOT p_mode=ANY(public._game_modes()) OR p_period IS NULL OR p_period NOT IN ('all','day','week','month') OR p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
  since:=CASE WHEN p_period='all' THEN '-infinity'::timestamptz ELSE date_trunc(p_period,now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' END;
  WITH best AS (
    SELECT DISTINCT ON (user_id) user_id,score,best_ms,created_at FROM game_scores
    WHERE verified AND NOT flagged AND game_mode=p_mode AND created_at>=since ORDER BY user_id,score DESC,best_ms NULLS LAST,created_at
  ), ranked AS (
    SELECT b.*,rank() OVER(ORDER BY score DESC,best_ms NULLS LAST) place,coalesce(p.username,'Player') username FROM best b JOIN profiles p ON p.id=b.user_id
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM ranked),'my_rank',(SELECT place FROM ranked WHERE user_id=auth.uid()),
    'entries',coalesce((SELECT jsonb_agg(r) FROM (SELECT * FROM ranked ORDER BY place,created_at,user_id LIMIT 25 OFFSET p_offset)r),'[]'::jsonb)) INTO output;
  RETURN output;
END $$;

CREATE OR REPLACE FUNCTION public.player_summary(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE output jsonb; current_run integer:=0; longest integer:=0; today date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user) THEN
    IF p_user=auth.uid() THEN INSERT INTO profiles(id,username) VALUES(p_user,'Player') ON CONFLICT DO NOTHING;
    ELSE RAISE EXCEPTION 'Player not found'; END IF;
  END IF;
  WITH days AS (SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date d FROM game_scores WHERE user_id=p_user AND verified AND score>0),
  islands AS (SELECT d,d+row_number() OVER(ORDER BY d DESC)::int grp FROM days),
  runs AS (SELECT max(d) latest,count(*)::int n FROM islands GROUP BY grp)
  SELECT coalesce(max(n) FILTER(WHERE latest>=today-1),0),coalesce(max(n),0) INTO current_run,longest FROM runs;
  SELECT jsonb_build_object('id',p.id,'username',coalesce(p.username,'Player'),'joined',p.created_at,
    'onboarded',CASE WHEN p.id=auth.uid() THEN p.onboarded ELSE true END,
    'games',count(s.id),'best',coalesce(max(s.score),0),'xp',coalesce(sum(s.xp_earned),0),
    'play_ms',coalesce(sum(s.duration_ms),0),'modes',count(DISTINCT s.game_mode),
    'current_streak',current_run,'longest_streak',longest,
    'legacy_games',(SELECT count(*) FROM game_scores WHERE user_id=p_user AND NOT verified),
    'daily_completed',EXISTS(SELECT 1 FROM daily_challenge_completions WHERE user_id=p_user AND challenge_day=today),
    'daily_progress',coalesce((SELECT max(score) FROM game_scores WHERE user_id=p_user AND verified AND created_at>=today::timestamp AT TIME ZONE 'UTC' AND game_mode=public._daily_mode(today)),0)
  ) INTO output FROM profiles p LEFT JOIN game_scores s ON s.user_id=p.id AND s.verified WHERE p.id=p_user GROUP BY p.id;
  RETURN output||jsonb_build_object(
    'records',coalesce((SELECT jsonb_agg(r) FROM (SELECT game_mode,max(score) best,min(best_ms) best_ms,count(*) games,round(avg(score),1) average FROM game_scores WHERE user_id=p_user AND verified GROUP BY game_mode)r),'[]'::jsonb),
    'recent',coalesce((SELECT jsonb_agg(r) FROM (SELECT id,game_mode,score,created_at,duration_ms,xp_earned,verified,best_ms,kind FROM game_scores WHERE user_id=p_user ORDER BY created_at DESC LIMIT 20)r),'[]'::jsonb),
    'activity',coalesce((SELECT jsonb_agg(r) FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS "day",count(*) games FROM game_scores WHERE user_id=p_user AND verified AND created_at>=now()-interval '14 days' GROUP BY 1 ORDER BY 1)r),'[]'::jsonb),
    'challenges',coalesce((SELECT jsonb_agg(r) FROM (SELECT challenge_day,reward FROM daily_challenge_completions WHERE user_id=p_user ORDER BY challenge_day DESC LIMIT 14)r),'[]'::jsonb)
  );
END $$;

-- ── Housekeeping ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_game_data() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE game_sessions SET status='abandoned',challenge=NULL,expected=NULL WHERE status='active' AND started_at<now()-interval '1 day';
  DELETE FROM round_receipts r USING game_sessions s WHERE s.id=r.session_id AND s.status<>'active' AND s.started_at<now()-interval '30 days';
  DELETE FROM game_sessions s WHERE s.status='abandoned' AND s.started_at<now()-interval '30 days'
    AND NOT EXISTS(SELECT 1 FROM game_scores g WHERE g.session_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM daily_challenge_completions d WHERE d.session_id=s.id);
$$;
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule('dopamine-cleanup','17 3 * * *','SELECT public.cleanup_game_data()');
  END IF;
END $do$;

-- ── Grants: only the checked entry points are callable ─────────────────────
REVOKE ALL ON FUNCTION public._daily_mode(date),public._daily_number(date),public._unit_hash(text),public._seeded_challenge(text,integer,bigint),public.cleanup_game_data() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.start_game(text,uuid,text,text),public.create_challenge(uuid),public.get_challenge(text),public.get_daily(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_game(text,uuid,text,text),public.create_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge(text),public.get_daily(integer) TO anon,authenticated;
