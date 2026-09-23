-- Additive upgrade. Legacy scores remain in history but do not enter ranked play.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS session_id uuid UNIQUE;
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0;
ALTER TABLE public.game_scores ADD COLUMN IF NOT EXISTS xp_earned integer NOT NULL DEFAULT 0;
ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_valid_attempt;
ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_valid_attempt CHECK (
  score BETWEEN 0 AND 1000 AND streak BETWEEN 0 AND score AND game_mode IN
  ('classic','freeze-frame','reverse-sequence','quick-reflex','trail-tracker','palette-recall','speed-typist')
) NOT VALID;

CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, game_mode text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  score integer NOT NULL DEFAULT 0, round_index integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(), round_started_at timestamptz,
  challenge jsonb, expected jsonb, result jsonb, UNIQUE(user_id,request_id)
);
CREATE INDEX game_sessions_user_started ON public.game_sessions(user_id,started_at DESC);
ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_session_fk FOREIGN KEY(session_id) REFERENCES public.game_sessions(id);
CREATE TABLE public.round_receipts (
  session_id uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_index integer NOT NULL, answer jsonb NOT NULL, response jsonb NOT NULL,
  PRIMARY KEY(session_id,round_index)
);
CREATE TABLE public.daily_challenge_completions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, challenge_day date NOT NULL,
  session_id uuid REFERENCES public.game_sessions(id), reward integer NOT NULL DEFAULT 150,
  PRIMARY KEY(user_id,challenge_day)
);
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_sessions, public.round_receipts, public.daily_challenge_completions FROM PUBLIC, anon, authenticated;
-- No client, including an authenticated client, may mint or edit scores or XP.
REVOKE INSERT, UPDATE, DELETE ON public.game_scores FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.game_scores;
CREATE INDEX game_scores_ranked ON public.game_scores(game_mode,score DESC,created_at,user_id) WHERE verified;
CREATE INDEX game_scores_progress ON public.game_scores(user_id,created_at DESC) WHERE verified;

CREATE FUNCTION public._game_modes() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=public
AS $$ SELECT ARRAY['classic','freeze-frame','reverse-sequence','quick-reflex','trail-tracker','palette-recall','speed-typist']::text[] $$;

CREATE FUNCTION public._make_challenge(mode text, n integer) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p jsonb; expected jsonb; reveal integer:=0; lim integer:=60000; sz integer; cnt integer;
  vals integer[]; target integer; step integer; i integer; at_cell integer; candidate integer; tries integer;
  palette text[]; opts text[]; hue integer; target_color text; word text;
BEGIN
  IF mode='classic' THEN
    cnt:=least(4+n/3,8); SELECT array_agg(x ORDER BY random()) INTO vals FROM generate_series(0,cnt-1) x;
    target:=floor(random()*cnt)::int; expected:=to_jsonb(target); reveal:=2700;
    p:=jsonb_build_object('cards',vals,'target',vals[target+1]);
  ELSIF mode='freeze-frame' THEN
    sz:=least(4+n/5,6);cnt:=least(3+n/3,12);
    SELECT array_agg(x ORDER BY x) INTO vals FROM (SELECT x FROM generate_series(0,sz*sz-1)x ORDER BY random() LIMIT cnt)t;
    reveal:=greatest(1500,4000-n*100);expected:=to_jsonb(vals);p:=jsonb_build_object('size',sz,'cells',vals);
  ELSIF mode='reverse-sequence' THEN
    cnt:=least(3+n/3,8);step:=greatest(500,1000-n*30);
    SELECT array_agg(floor(random()*6)::int) INTO vals FROM generate_series(1,cnt);
    SELECT jsonb_agg(v ORDER BY ord DESC) INTO expected FROM unnest(vals) WITH ORDINALITY a(v,ord);
    reveal:=cnt*step+500;p:=jsonb_build_object('sequence',vals,'interval_ms',step);
  ELSIF mode='trail-tracker' THEN
    sz:=5;cnt:=least(4+n/3,15);step:=greatest(350,750-n*15);
    FOR tries IN 1..50 LOOP
      vals:=ARRAY[floor(random()*25)::int];
      WHILE cardinality(vals)<cnt LOOP
        at_cell:=vals[cardinality(vals)];
        SELECT x INTO candidate FROM generate_series(0,24)x
          WHERE NOT x=ANY(vals) AND abs(x%5-at_cell%5)+abs(x/5-at_cell/5)=1 ORDER BY random() LIMIT 1;
        EXIT WHEN candidate IS NULL; vals:=array_append(vals,candidate);
      END LOOP;
      EXIT WHEN cardinality(vals)=cnt;
    END LOOP;
    IF cardinality(vals)<cnt THEN vals:=ARRAY[0,1,2,3,4,9,8,7,6,5,10,11,12,13,14];vals:=vals[1:cnt]; END IF;
    reveal:=cnt*step+500;expected:=to_jsonb(vals);p:=jsonb_build_object('size',sz,'sequence',vals,'interval_ms',step);
  ELSIF mode='palette-recall' THEN
    cnt:=least(3+n/5,5);hue:=floor(random()*360)::int;palette:=ARRAY[]::text[];
    FOR i IN 0..cnt-1 LOOP palette:=array_append(palette,format('hsl(%s, 68%%, 62%%)',(hue+i*greatest(15,70-n))%360)); END LOOP;
    target:=floor(random()*cnt)::int;target_color:=palette[target+1];
    opts:=ARRAY[target_color,format('hsl(%s, 68%%, 62%%)',(hue+target*greatest(15,70-n)+20)%360),format('hsl(%s, 68%%, 62%%)',(hue+target*greatest(15,70-n)+340)%360),format('hsl(%s, 68%%, 62%%)',(hue+target*greatest(15,70-n)+45)%360)];
    SELECT array_agg(v ORDER BY random()) INTO opts FROM unnest(opts)v;
    expected:=to_jsonb(array_position(opts,target_color)-1);reveal:=greatest(2000,5000-n*100);
    p:=jsonb_build_object('palette',palette,'target',target,'options',opts);
  ELSIF mode='quick-reflex' THEN
    target:=floor(random()*6)::int;cnt:=2+floor(random()*5)::int;step:=greatest(450,1000-n*25);vals:=ARRAY[]::int[];
    FOR i IN 1..cnt LOOP candidate:=floor(random()*5)::int; IF candidate>=target THEN candidate:=candidate+1; END IF; vals:=array_append(vals,candidate); END LOOP;
    vals:=array_append(vals,target);lim:=(cnt+1)*step;expected:=to_jsonb(cnt);
    p:=jsonb_build_object('sequence',vals,'target',target,'interval_ms',step);
  ELSIF mode='speed-typist' THEN
    IF n<5 THEN opts:=ARRAY['focus','drift','spark','pulse','quiet','clear','light','frame','trail','mind','wave','shift'];
    ELSIF n<15 THEN opts:=ARRAY['pattern','rhythm','balance','capture','moment','observe','purpose','journey','precise','resolve'];
    ELSE opts:=ARRAY['concentration','perspective','coordination','consistency','recognition','acceleration','imagination','determination']; END IF;
    word:=opts[1+floor(random()*cardinality(opts))::int];expected:=to_jsonb(word);lim:=greatest(2200,length(word)*600-n*80);p:=jsonb_build_object('word',word);
  ELSE RAISE EXCEPTION 'Invalid game'; END IF;
  RETURN jsonb_build_object('public',p||jsonb_build_object('mode',mode,'round',n,'reveal_ms',reveal,'limit_ms',lim+reveal),'expected',expected);
END $$;

CREATE FUNCTION public.start_game(p_mode text,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT p_mode=ANY(public._game_modes()) OR p_mode IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Invalid game'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT id INTO sid FROM game_sessions WHERE user_id=uid AND request_id=p_request;
  IF sid IS NOT NULL THEN RETURN sid; END IF;
  IF (SELECT count(*) FROM game_sessions WHERE user_id=uid AND started_at>clock_timestamp()-interval '15 minutes')>=30 THEN RAISE EXCEPTION 'Please wait before starting another run'; END IF;
  INSERT INTO profiles(id,username) VALUES(uid,'Player') ON CONFLICT(id) DO NOTHING;
  UPDATE game_sessions SET status='abandoned' WHERE user_id=uid AND status='active';
  INSERT INTO game_sessions(user_id,game_mode,request_id) VALUES(uid,p_mode,p_request) RETURNING id INTO sid;
  RETURN sid;
END $$;

CREATE FUNCTION public.get_game_round(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; payload jsonb;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR s.status<>'active' THEN RAISE EXCEPTION 'Run is not active'; END IF;
  IF clock_timestamp()-s.started_at>interval '30 minutes' THEN RAISE EXCEPTION 'Run expired'; END IF;
  IF s.challenge IS NOT NULL THEN RETURN s.challenge; END IF;
  payload:=public._make_challenge(s.game_mode,s.score);
  UPDATE game_sessions SET challenge=payload->'public',expected=payload->'expected',round_started_at=clock_timestamp() WHERE id=s.id;
  RETURN payload->'public';
END $$;

CREATE FUNCTION public._finish_game(sid uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s game_sessions; prior integer; earned integer; bonus integer:=0; score_id uuid; output jsonb;
  today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date; daily_mode text; ms integer; inserted integer;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=sid;
  SELECT coalesce(max(score),0) INTO prior FROM game_scores WHERE user_id=s.user_id AND game_mode=s.game_mode AND verified;
  daily_mode:=(public._game_modes())[1+mod(today-date '1970-01-01',7)];
  IF s.score>=5 AND s.game_mode=daily_mode AND (s.started_at AT TIME ZONE 'UTC')::date=today THEN
    INSERT INTO daily_challenge_completions(user_id,challenge_day,session_id) VALUES(s.user_id,today,s.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=1 THEN bonus:=150; END IF;
  END IF;
  earned:=least(s.score*20,2000)+bonus;
  ms:=least(1800000,greatest(0,extract(epoch FROM clock_timestamp()-s.started_at)*1000))::int;
  INSERT INTO game_scores(user_id,game_mode,score,streak,session_id,verified,duration_ms,xp_earned)
    VALUES(s.user_id,s.game_mode,s.score,s.score,s.id,true,ms,earned) RETURNING id INTO score_id;
  output:=jsonb_build_object('id',score_id,'game_mode',s.game_mode,'score',s.score,'duration_ms',ms,
    'accuracy',round(s.score::numeric/(s.score+1)*100),'xp_earned',earned,'challenge_bonus',bonus,
    'personal_best',s.score>prior,'previous_best',prior,'created_at',clock_timestamp(),'verified',true);
  UPDATE game_sessions SET status='completed',result=output,challenge=NULL,expected=NULL WHERE id=sid;
  RETURN output;
END $$;

CREATE FUNCTION public.answer_round(p_session uuid,p_round integer,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; old round_receipts; elapsed numeric; correct boolean; response jsonb; normalized jsonb;
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
    -- Normalize without converting the numbers to strings.
    SELECT jsonb_agg(v::int ORDER BY v::int) INTO normalized FROM jsonb_array_elements_text(p_answer)v;
  END IF;
  IF elapsed<(s.challenge->>'reveal_ms')::int AND p_answer NOT IN ('{"quit":true}'::jsonb,'{"timeout":true}'::jsonb) THEN RAISE EXCEPTION 'Answer arrived before recall began'; END IF;
  correct:=normalized=s.expected AND elapsed<=(s.challenge->>'limit_ms')::int+1500
    AND clock_timestamp()-s.started_at<=interval '30 minutes';
  IF s.game_mode='quick-reflex' THEN correct:=correct AND elapsed>=((s.expected::text)::int*(s.challenge->>'interval_ms')::int); END IF;
  IF s.game_mode='speed-typist' THEN correct:=correct AND elapsed>=250; END IF;
  IF correct AND s.score<999 THEN
    UPDATE game_sessions SET score=score+1,round_index=round_index+1,challenge=NULL,expected=NULL WHERE id=s.id;
    response:=jsonb_build_object('correct',true,'score',s.score+1,'completed',false);
  ELSE
    IF correct THEN UPDATE game_sessions SET score=score+1 WHERE id=s.id; END IF;
    response:=jsonb_build_object('correct',coalesce(correct,false),'completed',true,'result',public._finish_game(s.id));
  END IF;
  INSERT INTO round_receipts VALUES(s.id,p_round,p_answer,response);
  RETURN response;
END $$;

CREATE FUNCTION public.abandon_game(p_session uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE game_sessions SET status='abandoned',challenge=NULL,expected=NULL WHERE id=p_session AND user_id=auth.uid() AND status='active';
$$;

CREATE FUNCTION public.update_player(p_username text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_username IS NULL OR trim(p_username) !~ '^[A-Za-z0-9_ -]{3,24}$' THEN RAISE EXCEPTION 'Use 3 to 24 letters, numbers, spaces, underscores or hyphens'; END IF;
  INSERT INTO profiles(id,username,onboarded) VALUES(auth.uid(),trim(p_username),true)
  ON CONFLICT(id) DO UPDATE SET username=trim(p_username),onboarded=true,updated_at=now();
END $$;

CREATE FUNCTION public.player_summary(p_user uuid) RETURNS jsonb
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
    'daily_progress',coalesce((SELECT max(score) FROM game_scores WHERE user_id=p_user AND verified AND created_at>=today::timestamp AT TIME ZONE 'UTC' AND game_mode=(public._game_modes())[1+mod(today-date '1970-01-01',7)]),0)
  ) INTO output FROM profiles p LEFT JOIN game_scores s ON s.user_id=p.id AND s.verified WHERE p.id=p_user GROUP BY p.id;
  RETURN output||jsonb_build_object(
    'records',coalesce((SELECT jsonb_agg(r) FROM (SELECT game_mode,max(score) best,count(*) games,round(avg(score),1) average FROM game_scores WHERE user_id=p_user AND verified GROUP BY game_mode)r),'[]'::jsonb),
    'recent',coalesce((SELECT jsonb_agg(r) FROM (SELECT id,game_mode,score,created_at,duration_ms,xp_earned,verified FROM game_scores WHERE user_id=p_user ORDER BY created_at DESC LIMIT 20)r),'[]'::jsonb),
    'activity',coalesce((SELECT jsonb_agg(r) FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS "day",count(*) games FROM game_scores WHERE user_id=p_user AND verified AND created_at>=now()-interval '14 days' GROUP BY 1 ORDER BY 1)r),'[]'::jsonb),
    'challenges',coalesce((SELECT jsonb_agg(r) FROM (SELECT challenge_day,reward FROM daily_challenge_completions WHERE user_id=p_user ORDER BY challenge_day DESC LIMIT 14)r),'[]'::jsonb)
  );
END $$;

CREATE FUNCTION public.get_leaderboard(p_mode text,p_period text DEFAULT 'all',p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE since timestamptz; output jsonb;
BEGIN
  IF p_mode IS NULL OR NOT p_mode=ANY(public._game_modes()) OR p_period IS NULL OR p_period NOT IN ('all','day','week','month') OR p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
  since:=CASE WHEN p_period='all' THEN '-infinity'::timestamptz ELSE date_trunc(p_period,now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' END;
  WITH best AS (
    SELECT DISTINCT ON (user_id) user_id,score,created_at FROM game_scores WHERE verified AND game_mode=p_mode AND created_at>=since ORDER BY user_id,score DESC,created_at
  ), ranked AS (
    SELECT b.*,rank() OVER(ORDER BY score DESC) place,coalesce(p.username,'Player') username FROM best b JOIN profiles p ON p.id=b.user_id
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM ranked),'my_rank',(SELECT place FROM ranked WHERE user_id=auth.uid()),
    'entries',coalesce((SELECT jsonb_agg(r) FROM (SELECT * FROM ranked ORDER BY place,created_at,user_id LIMIT 25 OFFSET p_offset)r),'[]'::jsonb)) INTO output;
  RETURN output;
END $$;

-- Expose only the checked entry points. Definer functions never trust a user ID from the client.
REVOKE ALL ON FUNCTION public._make_challenge(text,integer),public._finish_game(uuid),public._game_modes() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.start_game(text,uuid),public.get_game_round(uuid),public.answer_round(uuid,integer,jsonb),public.abandon_game(uuid),public.update_player(text),public.player_summary(uuid),public.get_leaderboard(text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_game(text,uuid),public.get_game_round(uuid),public.answer_round(uuid,integer,jsonb),public.abandon_game(uuid),public.update_player(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_summary(uuid),public.get_leaderboard(text,text,integer) TO anon,authenticated;
-- Reviews cannot be moved onto someone else's score through an UPDATE either.
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.game_reviews;
CREATE POLICY "Users can update their own reviews" ON public.game_reviews FOR UPDATE TO authenticated
USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id AND EXISTS(SELECT 1 FROM game_scores s WHERE s.id=score_id AND s.user_id=auth.uid() AND s.game_mode=game_reviews.game_mode));
ALTER TABLE public.game_reviews ADD CONSTRAINT review_length CHECK (char_length(review)<=500) NOT VALID;

