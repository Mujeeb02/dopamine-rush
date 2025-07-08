-- Fix Leaderboard Access - Run this in Supabase SQL Editor
-- This will allow public read access to the leaderboard

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Public can view all scores for leaderboard" ON public.game_scores;

-- Create new policy that allows public read access
CREATE POLICY "Public can view all scores for leaderboard" 
  ON public.game_scores 
  FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'game_scores'; 