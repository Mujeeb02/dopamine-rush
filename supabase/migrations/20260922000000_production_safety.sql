-- Public player pages only need a public name and join date. Keep email
-- available to the owner through auth.users, not through a public profile row.
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, username, created_at) ON TABLE public.profiles TO anon, authenticated;

-- Reject malformed score submissions even though a trusted, server-side
-- challenge verifier is still required for competitive rankings.
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_valid_attempt CHECK (
    score BETWEEN 1 AND 10000
    AND streak BETWEEN 0 AND score
    AND game_mode IN (
      'classic', 'freeze-frame', 'reverse-sequence', 'quick-reflex',
      'trail-tracker', 'palette-recall', 'speed-typist'
    )
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS game_scores_mode_score_user_idx
  ON public.game_scores (game_mode, score DESC, user_id);

-- A review may refer only to the author's own completed score.
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.game_reviews;
CREATE POLICY "Users can insert their own reviews" ON public.game_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND score_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.game_scores s
      WHERE s.id = score_id AND s.user_id = auth.uid()
        AND s.game_mode = game_reviews.game_mode
    )
  );
