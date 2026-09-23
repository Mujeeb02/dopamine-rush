
-- Base schema for a fresh Supabase project. Existing deployments with these
-- tables can replay this safely when reconciling migration history.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_mode text NOT NULL DEFAULT 'classic',
  score integer NOT NULL,
  streak integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_scores_user_id_idx ON public.game_scores(user_id);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.game_scores TO anon, authenticated;
GRANT INSERT ON public.game_scores TO authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public can view all scores for leaderboard" ON public.game_scores;
CREATE POLICY "Public can view all scores for leaderboard" ON public.game_scores
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.game_scores;
CREATE POLICY "Users can insert their own scores" ON public.game_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
