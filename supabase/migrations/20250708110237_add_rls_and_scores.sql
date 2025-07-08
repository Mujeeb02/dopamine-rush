
-- Create RLS policies for game_scores
CREATE POLICY "Public can view all scores for leaderboard" 
  ON public.game_scores 
  FOR SELECT 
  TO authenticated;

CREATE POLICY "Users can insert their own scores" 
  ON public.game_scores 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);