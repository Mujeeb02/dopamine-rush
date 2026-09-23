-- Ensure UUID generation is available
create extension if not exists pgcrypto;

-- Create table for game reviews/ratings
create table if not exists public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_mode text not null,
  score_id uuid references public.game_scores(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  review text
);

-- Useful indexes
create index if not exists idx_game_reviews_game_mode on public.game_reviews (game_mode);
create index if not exists idx_game_reviews_user_id on public.game_reviews (user_id);
create index if not exists idx_game_reviews_score_id on public.game_reviews (score_id);

-- One review per score per user
create unique index if not exists uniq_game_reviews_user_score on public.game_reviews (user_id, score_id);

-- Enable RLS
alter table public.game_reviews enable row level security;
grant select on public.game_reviews to anon, authenticated;
grant insert, update on public.game_reviews to authenticated;

-- Anyone can read reviews (Postgres doesn't support IF NOT EXISTS for policies on older versions)
drop policy if exists "Public can read game reviews" on public.game_reviews;
create policy "Public can read game reviews"
  on public.game_reviews for select
  to anon, authenticated
  using (true);

-- Only the authenticated user can insert their own review
drop policy if exists "Users can insert their own reviews" on public.game_reviews;
create policy "Users can insert their own reviews"
  on public.game_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own reviews (optional)
drop policy if exists "Users can update their own reviews" on public.game_reviews;
create policy "Users can update their own reviews"
  on public.game_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


