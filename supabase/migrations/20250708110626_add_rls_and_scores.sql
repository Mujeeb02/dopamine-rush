-- Allow anonymous users to view scores (e.g., for leaderboard)
CREATE POLICY "Public can view all scores for leaderboard" 
  ON public.game_scores 
  FOR SELECT 
  TO anon;

-- Allow authenticated users to insert their own scores
CREATE POLICY "Users can insert their own scores" 
  ON public.game_scores 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
