-- Real per-game metrics, a forgiving Freeze Frame, and streaks built on the daily
-- challenge. Additive: earlier runs stay in history.
--   Freeze Frame: scored in cells recalled. One life per run: the first imperfect
--     round reveals the pattern and the run continues at the same level.
--   Speed Typist: a 30-second sprint scored in words per minute, with accuracy.
--   Streaks: one day per counted daily attempt. Every 7 streak days earn a freeze
--     (hold at most one) that covers a single missed day automatically.

-- ── Schema ─────────────────────────────────────────────────────────────────
-- rounds is NULL on runs saved before this release. For Freeze Frame and Speed
-- Typist those older scores were rounds, a different unit, so they stay out of
-- records and rankings for those two games.
ALTER TABLE public.game_scores
  ADD COLUMN IF NOT EXISTS rounds integer,
  ADD COLUMN IF NOT EXISTS accuracy smallint;

CREATE OR REPLACE FUNCTION public._current_metric(mode text,rounds integer) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT rounds IS NOT NULL OR mode NOT IN ('freeze-frame','speed-typist') $$;

-- ── Rounds ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._make_challenge(mode text, n integer) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p jsonb; expected jsonb; reveal integer:=0; lim integer:=60000; sz integer; cnt integer;
  vals integer[]; target integer; step integer; i integer; at_cell integer; candidate integer; tries integer;
  palette text[]; opts text[]; hue integer; target_color text; words text[];
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
    -- One 30-second sprint over common words: more than anyone can type in the time.
    opts:=ARRAY['the','be','to','of','and','in','that','have','it','for','not','on','with','he','as','you','do','at',
      'this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there',
      'their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no',
      'just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then',
      'now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first',
      'well','way','even','new','want','because','any','these','give','day','most','us','great','small','light','fast',
      'quick','brain','focus','sharp','move','play','game','score','round','again','never','always','right','left'];
    SELECT array_agg(opts[1+floor(random()*cardinality(opts))::int] ORDER BY g) INTO words FROM generate_series(1,150) g;
    expected:=to_jsonb(words);lim:=30000;p:=jsonb_build_object('words',words,'duration_ms',30000);
  ELSE RAISE EXCEPTION 'Invalid game'; END IF;
  RETURN jsonb_build_object('public',p||jsonb_build_object('mode',mode,'round',n,'reveal_ms',reveal,'limit_ms',lim+reveal),'expected',expected);
END $$;

-- A Freeze Frame life replays the same difficulty, so the round counter, not the
-- level, picks the pattern: the retry is a fresh pattern, never the one just shown.
DROP FUNCTION IF EXISTS public._seeded_challenge(text,integer,bigint);
CREATE FUNCTION public._seeded_challenge(mode text,n integer,seed bigint,variant integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE payload jsonb;
BEGIN
  PERFORM setseed(public._unit_hash(seed::text||':'||n||coalesce('.'||variant,'')));
  payload:=public._make_challenge(mode,n);
  PERFORM setseed(public._unit_hash(gen_random_uuid()::text));
  RETURN payload;
END $$;

CREATE OR REPLACE FUNCTION public.get_game_round(p_session uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; payload jsonb;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR s.status<>'active' THEN RAISE EXCEPTION 'Run is not active'; END IF;
  IF clock_timestamp()-s.started_at>interval '30 minutes' THEN RAISE EXCEPTION 'Run expired'; END IF;
  IF s.challenge IS NOT NULL THEN RETURN s.challenge; END IF;
  payload:=CASE WHEN s.seed IS NULL THEN public._make_challenge(s.game_mode,s.score)
    ELSE public._seeded_challenge(s.game_mode,s.score,s.seed,CASE WHEN s.round_index<>s.score THEN s.round_index END) END;
  -- The client answers by round number, which runs ahead of the level after a life.
  payload:=jsonb_set(payload,'{public,round}',to_jsonb(s.round_index));
  UPDATE game_sessions SET challenge=payload->'public',expected=payload->'expected',round_started_at=clock_timestamp() WHERE id=s.id;
  RETURN payload->'public';
END $$;

-- ── Answers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.answer_round(p_session uuid,p_round integer,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions; old round_receipts; elapsed numeric; correct boolean; response jsonb; normalized jsonb;
  client_ms integer; since_target numeric; recall numeric; steps integer; suspicious boolean:=false; m jsonb;
  is_quit boolean:=p_answer='{"quit":true}'::jsonb; is_timeout boolean:=p_answer='{"timeout":true}'::jsonb; in_time boolean;
  hit integer:=0; wrong integer:=0; life boolean:=false;
  typed text; tokens text[]; words text[]; i integer; good_chars integer:=0; good_words integer:=0; typed_words integer:=0; wpm integer; acc integer;
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
  IF elapsed<(s.challenge->>'reveal_ms')::int AND NOT (is_quit OR is_timeout) THEN RAISE EXCEPTION 'Answer arrived before recall began'; END IF;
  in_time:=elapsed<=(s.challenge->>'limit_ms')::int+1500 AND clock_timestamp()-s.started_at<=interval '30 minutes';
  m:=s.metric;

  -- Speed Typist: the whole run is one sprint, scored once.
  IF s.game_mode='speed-typist' THEN
    typed:=CASE WHEN jsonb_typeof(p_answer->'typed')='string' THEN left(p_answer->>'typed',1500) ELSE '' END;
    SELECT array_agg(x ORDER BY o) INTO words FROM jsonb_array_elements_text(s.expected) WITH ORDINALITY t(x,o);
    tokens:=CASE WHEN btrim(typed)='' THEN ARRAY[]::text[] ELSE regexp_split_to_array(btrim(typed),'\s+') END;
    typed_words:=cardinality(tokens);
    FOR i IN 1..least(typed_words,cardinality(words)) LOOP
      IF tokens[i]=words[i] THEN good_words:=good_words+1; good_chars:=good_chars+length(words[i])+1; END IF;
    END LOOP;
    -- A word the clock cut off mid-way counts neither for nor against accuracy.
    IF typed_words BETWEEN 1 AND cardinality(words) AND tokens[typed_words]<>words[typed_words]
       AND left(words[typed_words],length(tokens[typed_words]))=tokens[typed_words] THEN typed_words:=typed_words-1; END IF;
    -- Five characters (spaces included) make a word; the sprint is half a minute. The
    -- window allows for network delay either side of the client's 30-second stop.
    wpm:=CASE WHEN elapsed<=35000 AND clock_timestamp()-s.started_at<=interval '30 minutes' AND NOT is_timeout THEN round(good_chars*2/5.0)::int ELSE 0 END;
    acc:=CASE WHEN typed_words>0 THEN least(100,round(good_words*100.0/typed_words))::int END;
    m:=m||jsonb_build_object('wpm',wpm,'accuracy',acc,'words',good_words);
    -- Sustained 200+ WPM is beyond world-record pace.
    IF wpm>200 THEN m:=jsonb_set(m,'{suspicious}',to_jsonb(coalesce((m->>'suspicious')::int,0)+2)); END IF;
    UPDATE game_sessions SET metric=m WHERE id=s.id;
    response:=jsonb_build_object('correct',wpm>0,'completed',true,'wpm',wpm,'accuracy',acc,'result',public._finish_game(s.id));
    INSERT INTO round_receipts(session_id,round_index,answer,response,elapsed_ms) VALUES(s.id,p_round,p_answer,response,elapsed::int);
    RETURN response;
  END IF;

  IF s.game_mode='freeze-frame' THEN
    -- Cells are credited one by one; a wrong pick cancels a right one, so selecting
    -- everything earns nothing.
    IF in_time AND jsonb_typeof(p_answer)='array' THEN
      SELECT count(*) FILTER (WHERE s.expected @> to_jsonb(v)),count(*) FILTER (WHERE NOT s.expected @> to_jsonb(v)) INTO hit,wrong
        FROM (SELECT DISTINCT x::int v FROM jsonb_array_elements_text(p_answer) x) t;
    END IF;
    correct:=in_time AND hit=jsonb_array_length(s.expected) AND wrong=0;
  ELSE
    normalized:=p_answer;
    IF s.game_mode='quick-reflex' AND jsonb_typeof(p_answer)='object' AND p_answer ? 'pick' THEN
      normalized:=p_answer->'pick';
      IF jsonb_typeof(p_answer->'ms')='number' THEN client_ms:=least(greatest((p_answer->>'ms')::numeric,0),60000)::int; END IF;
    END IF;
    correct:=normalized=s.expected AND in_time;
    IF s.game_mode='quick-reflex' THEN
      since_target:=elapsed-(s.expected::text)::int*(s.challenge->>'interval_ms')::int;
      correct:=correct AND since_target>=0;
      -- The client's clock starts after the server's, so its reaction time can only
      -- trail the server's view. Under 100 ms is anticipation, not reaction.
      IF client_ms IS NOT NULL THEN
        correct:=correct AND client_ms BETWEEN 100 AND least((s.challenge->>'interval_ms')::int+100,since_target+150);
      END IF;
    END IF;
  END IF;
  correct:=coalesce(correct,false);
  IF correct THEN
    recall:=elapsed-(s.challenge->>'reveal_ms')::int;
    steps:=CASE WHEN jsonb_typeof(s.expected)='array' THEN jsonb_array_length(s.expected) ELSE 1 END;
    suspicious:=s.game_mode<>'quick-reflex' AND recall<80*steps+150;
  END IF;
  IF suspicious THEN m:=jsonb_set(m,'{suspicious}',to_jsonb(coalesce((m->>'suspicious')::int,0)+1)); END IF;
  IF correct AND client_ms IS NOT NULL THEN m:=jsonb_set(m,'{ms}',coalesce(m->'ms','[]'::jsonb)||to_jsonb(client_ms)); END IF;
  IF s.game_mode='freeze-frame' THEN
    m:=jsonb_set(m,'{cells}',to_jsonb(coalesce((m->>'cells')::int,0)+greatest(0,hit-wrong)));
    IF NOT correct AND NOT is_quit THEN
      life:=coalesce((m->>'misses')::int,0)=0;
      m:=jsonb_set(m,'{misses}',to_jsonb(coalesce((m->>'misses')::int,0)+1));
    END IF;
  END IF;
  UPDATE game_sessions SET metric=m WHERE id=s.id;
  IF correct AND s.score<999 THEN
    UPDATE game_sessions SET score=score+1,round_index=round_index+1,challenge=NULL,expected=NULL WHERE id=s.id;
    response:=jsonb_build_object('correct',true,'score',s.score+1,'completed',false,'ms',client_ms,'cells',m->'cells');
  ELSIF life THEN
    -- First miss: show what the pattern was, then a fresh one at the same level.
    UPDATE game_sessions SET round_index=round_index+1,challenge=NULL,expected=NULL WHERE id=s.id;
    response:=jsonb_build_object('correct',false,'completed',false,'life_used',true,'score',s.score,'cells',m->'cells',
      'hit',hit,'wrong',wrong,'pattern',s.expected);
  ELSE
    IF correct THEN UPDATE game_sessions SET score=score+1 WHERE id=s.id; END IF;
    response:=jsonb_build_object('correct',correct,'completed',true,'ms',client_ms,'result',public._finish_game(s.id));
    IF s.game_mode='freeze-frame' AND NOT is_quit THEN response:=response||jsonb_build_object('pattern',s.expected,'hit',hit,'wrong',wrong); END IF;
  END IF;
  INSERT INTO round_receipts(session_id,round_index,answer,response,elapsed_ms,client_ms) VALUES(s.id,p_round,p_answer,response,elapsed::int,client_ms);
  RETURN response;
END $$;

-- ── Results ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._finish_game(sid uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s game_sessions; prior integer; prior_ms integer; earned integer; bonus integer:=0; score_id uuid; output jsonb;
  ms integer; inserted integer; best integer; avg_v integer; samples integer; flag boolean; final integer; v_rounds integer; acc integer;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id=sid;
  final:=least(1000,CASE s.game_mode WHEN 'freeze-frame' THEN coalesce((s.metric->>'cells')::int,0)
    WHEN 'speed-typist' THEN coalesce((s.metric->>'wpm')::int,0) ELSE s.score END);
  v_rounds:=CASE WHEN s.game_mode='speed-typist' THEN 0 ELSE s.score END;
  acc:=(s.metric->>'accuracy')::int;
  SELECT coalesce(max(score),0),min(best_ms) INTO prior,prior_ms FROM game_scores
    WHERE user_id=s.user_id AND game_mode=s.game_mode AND verified AND public._current_metric(game_mode,rounds);
  -- The counted daily attempt is what keeps a streak alive, whatever the score.
  -- Bonus XP needs a score above zero.
  IF s.kind='daily' AND s.daily_day IS NOT NULL THEN
    INSERT INTO daily_challenge_completions(user_id,challenge_day,session_id,reward)
      VALUES(s.user_id,s.daily_day,s.id,CASE WHEN final>0 THEN 150 ELSE 0 END) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=1 AND final>0 THEN bonus:=150; END IF;
  END IF;
  earned:=least(CASE WHEN s.game_mode='speed-typist' THEN final*4 ELSE s.score*20 END,2000)+bonus;
  ms:=least(1800000,greatest(0,extract(epoch FROM clock_timestamp()-s.started_at)*1000))::int;
  SELECT min(v::int),round(avg(v::int))::int,count(*) INTO best,avg_v,samples FROM jsonb_array_elements_text(coalesce(s.metric->'ms','[]'::jsonb)) v;
  -- Hidden from rankings, never deleted: two inhumanly fast rounds, or a reflex average no person sustains.
  flag:=coalesce((s.metric->>'suspicious')::int,0)>=2 OR (samples>=3 AND avg_v<140);
  INSERT INTO game_scores(user_id,game_mode,score,streak,session_id,verified,duration_ms,xp_earned,kind,challenge_id,daily_day,best_ms,avg_ms,flagged,rounds,accuracy)
    VALUES(s.user_id,s.game_mode,final,final,s.id,true,ms,earned,s.kind,s.challenge_id,s.daily_day,best,avg_v,flag,v_rounds,acc) RETURNING id INTO score_id;
  output:=jsonb_build_object('id',score_id,'game_mode',s.game_mode,'score',final,'rounds',v_rounds,'accuracy',acc,
    'lives_used',coalesce((s.metric->>'misses')::int,0),'duration_ms',ms,
    'xp_earned',earned,'challenge_bonus',bonus,'personal_best',final>prior,'previous_best',prior,
    'best_ms',best,'avg_ms',avg_v,'previous_best_ms',prior_ms,'kind',s.kind,'flagged',flag,
    'daily_number',CASE WHEN s.daily_day IS NOT NULL THEN public._daily_number(s.daily_day) END,
    'created_at',clock_timestamp(),'verified',true);
  UPDATE game_sessions SET status='completed',result=output,challenge=NULL,expected=NULL WHERE id=sid;
  RETURN output;
END $$;

-- ── Streaks ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._streaks(p_user uuid,today date) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE d date; prev date; run integer:=0; longest integer:=0; freezes integer:=0; frozen date[]:=ARRAY[]::date[]; cur integer:=0; held integer:=0;
BEGIN
  FOR d IN SELECT challenge_day FROM daily_challenge_completions WHERE user_id=p_user AND challenge_day<=today ORDER BY challenge_day LOOP
    IF prev IS NOT NULL AND d-prev=1 THEN run:=run+1;
    ELSIF prev IS NOT NULL AND d-prev=2 AND freezes>0 THEN freezes:=freezes-1; frozen:=frozen||(d-1); run:=run+1;
    ELSE run:=1; freezes:=0; END IF;
    -- Every 7 days of streak earns a freeze; one can be held at a time.
    IF run%7=0 THEN freezes:=1; END IF;
    longest:=greatest(longest,run); prev:=d;
  END LOOP;
  IF prev>=today-1 THEN cur:=run; held:=freezes;
  ELSIF prev=today-2 AND freezes>0 THEN cur:=run; frozen:=frozen||(today-1);  -- yesterday is covered
  END IF;
  RETURN jsonb_build_object('current',cur,'longest',longest,'freezes',held,
    'frozen_days',(SELECT coalesce(jsonb_agg(f ORDER BY f),'[]'::jsonb) FROM unnest(frozen) f WHERE f>=today-30),
    'played_today',prev=today);
END $$;

CREATE OR REPLACE FUNCTION public.player_summary(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE output jsonb; today date:=(now() AT TIME ZONE 'UTC')::date; st jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user) THEN
    IF p_user=auth.uid() THEN INSERT INTO profiles(id,username) VALUES(p_user,'Player') ON CONFLICT DO NOTHING;
    ELSE RAISE EXCEPTION 'Player not found'; END IF;
  END IF;
  st:=public._streaks(p_user,today);
  SELECT jsonb_build_object('id',p.id,'username',coalesce(p.username,'Player'),'joined',p.created_at,
    'onboarded',CASE WHEN p.id=auth.uid() THEN p.onboarded ELSE true END,
    -- best counts rounds cleared, so words per minute and cells never stand in for it.
    'games',count(s.id),'best',coalesce(max(coalesce(s.rounds,s.score)),0),'xp',coalesce(sum(s.xp_earned),0),
    'play_ms',coalesce(sum(s.duration_ms),0),'modes',count(DISTINCT s.game_mode),
    'current_streak',(st->>'current')::int,'longest_streak',(st->>'longest')::int,
    'streak_freezes',(st->>'freezes')::int,'frozen_days',st->'frozen_days',
    'legacy_games',(SELECT count(*) FROM game_scores WHERE user_id=p_user AND NOT verified),
    'daily_completed',EXISTS(SELECT 1 FROM daily_challenge_completions WHERE user_id=p_user AND challenge_day=today),
    'daily_progress',coalesce((SELECT max(score) FROM game_scores WHERE user_id=p_user AND verified AND kind='daily' AND daily_day=today),0)
  ) INTO output FROM profiles p LEFT JOIN game_scores s ON s.user_id=p.id AND s.verified WHERE p.id=p_user GROUP BY p.id;
  RETURN output||jsonb_build_object(
    'records',coalesce((SELECT jsonb_agg(r) FROM (SELECT game_mode,max(score) best,min(best_ms) best_ms,max(accuracy) FILTER (WHERE game_mode='speed-typist') accuracy,count(*) games,round(avg(score),1) average
      FROM game_scores WHERE user_id=p_user AND verified AND public._current_metric(game_mode,rounds) GROUP BY game_mode)r),'[]'::jsonb),
    'recent',coalesce((SELECT jsonb_agg(r) FROM (SELECT id,game_mode,score,created_at,duration_ms,xp_earned,verified,best_ms,kind,rounds,accuracy FROM game_scores WHERE user_id=p_user ORDER BY created_at DESC LIMIT 20)r),'[]'::jsonb),
    'activity',coalesce((SELECT jsonb_agg(r) FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS "day",count(*) games FROM game_scores WHERE user_id=p_user AND verified AND created_at>=now()-interval '14 days' GROUP BY 1 ORDER BY 1)r),'[]'::jsonb),
    'challenges',coalesce((SELECT jsonb_agg(r) FROM (SELECT challenge_day,reward FROM daily_challenge_completions WHERE user_id=p_user ORDER BY challenge_day DESC LIMIT 14)r),'[]'::jsonb)
  );
END $$;

-- ── Leaderboard: one unit per game ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_mode text,p_period text DEFAULT 'all',p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE since timestamptz; output jsonb;
BEGIN
  IF p_mode IS NULL OR NOT p_mode=ANY(public._game_modes()) OR p_period IS NULL OR p_period NOT IN ('all','day','week','month') OR p_offset IS NULL OR p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid filter'; END IF;
  since:=CASE WHEN p_period='all' THEN '-infinity'::timestamptz ELSE date_trunc(p_period,now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' END;
  WITH best AS (
    SELECT DISTINCT ON (user_id) user_id,score,best_ms,accuracy,created_at FROM game_scores
    WHERE verified AND NOT flagged AND game_mode=p_mode AND created_at>=since AND public._current_metric(game_mode,rounds)
    ORDER BY user_id,score DESC,best_ms NULLS LAST,accuracy DESC NULLS LAST,created_at
  ), ranked AS (
    SELECT b.*,rank() OVER(ORDER BY score DESC,best_ms NULLS LAST) place,coalesce(p.username,'Player') username FROM best b JOIN profiles p ON p.id=b.user_id
  ) SELECT jsonb_build_object('total',(SELECT count(*) FROM ranked),'my_rank',(SELECT place FROM ranked WHERE user_id=auth.uid()),
    'entries',coalesce((SELECT jsonb_agg(r) FROM (SELECT * FROM ranked ORDER BY place,created_at,user_id LIMIT 25 OFFSET p_offset)r),'[]'::jsonb)) INTO output;
  RETURN output;
END $$;

-- ── Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public._current_metric(text,integer),public._seeded_challenge(text,integer,bigint,integer),public._streaks(uuid,date) FROM PUBLIC,anon,authenticated;
