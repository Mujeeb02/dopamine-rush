-- Fix RLS policy for game_scores to allow public read access for leaderboard
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Public can view all scores for leaderboard" ON public.game_scores;

-- Create new policy that allows public read access
CREATE POLICY "Public can view all scores for leaderboard" 
  ON public.game_scores 
  FOR SELECT 
  TO anon, authenticated
  USING (true); 