
-- Create RLS policies for game_scores
DROP POLICY IF EXISTS "Public can view all scores for leaderboard" ON public.game_scores;
CREATE POLICY "Public can view all scores for leaderboard" 
  ON public.game_scores 
  FOR SELECT 
  TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own scores" ON public.game_scores;
CREATE POLICY "Users can insert their own scores" 
  ON public.game_scores 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
