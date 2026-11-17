# Dopamine Rush

Quick, server-verified brain and reflex games you can challenge friends on. React 18 + Vite + TypeScript on the front end, Supabase (Postgres RPCs, Auth) on the back end, deployed on Vercel.

Live: https://dopamine-rush.vercel.app

## What's in it

- **7 games**: Quick Reflex (reaction time in ms), Classic Memory, Freeze Frame, Reverse Sequence, Trail Tracker, Palette Recall, Speed Typist.
- **Server-verified runs**: every round is generated and checked in the database (`start_game`, `get_game_round`, `answer_round`). The client never sees the answer, cannot write scores, and implausibly fast runs are flagged and kept off leaderboards.
- **Guest play that counts**: guests get a Supabase anonymous session, so their runs are verified too. Adding an email later keeps every run.
- **Challenge links** (`/c/:slug`): every verified run can be sent as a link that replays the exact same rounds. Link previews show a generated score card.
- **Daily challenge** (`/daily`): numbered, same rounds for everyone, first attempt counts, shareable result grid.
- **Progression**: XP and levels, day streaks, achievements, personal bests, period leaderboards.
- **SEO**: pre-rendered landing pages per game (`/play/reaction-time-test`, …), sitemap, per-page titles and social tags.
- **Analytics**: one event layer (`src/lib/analytics.ts`) sending to PostHog when a key is configured.

## Getting started

Requirements: Node.js 22+.

```bash
npm install
cp .env.example .env   # add your Supabase URL and publishable key
npm run dev            # http://localhost:8080
```

Practice mode works without any backend. Scored runs, challenges and the daily challenge need Supabase.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client + edge functions | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + edge functions | Public (anon/publishable) key |
| `VITE_SITE_URL` | client + build | Canonical URL used in share links and the sitemap |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | client | Optional analytics and error reporting; empty disables it |

## Scripts

- `npm run dev` – development server
- `npm run build` – Vite build, then `scripts/prerender.mjs` writes landing pages, `404.html` and `sitemap.xml`
- `npm run typecheck` – app and edge-function types
- `npm run lint` – ESLint
- `npm test` – unit, UI and database tests (the database suite runs every migration in PGlite)

## Project layout

```
api/            Vercel edge functions: og.ts (score-card images), challenge.ts (challenge link previews)
seo/            Page titles/descriptions and the meta injector shared by the build and the edge
scripts/        prerender.mjs (post-build static pages)
src/
  components/   game renderers (games/), platform shell, a few UI primitives
  hooks/        auth, player, settings
  lib/          api (RPC client), analytics, share, games, practice, progression
  pages/        routes: Index, Library, Game, Daily, ChallengeLink, Leaderboard, Profile, …
supabase/migrations/   schema and RPCs, applied in order
tests/          vitest suites
```

## Deploying

1. Apply new migrations in `supabase/migrations` to the Supabase project (`supabase db push`, or paste them into the SQL editor in order).
2. In Supabase → Authentication → Providers, enable **Anonymous sign-ins** (guest scored play), and add your site URL to the redirect allow list.
3. Set the environment variables above in Vercel for Production and Preview.
4. Push; CI runs typecheck, lint, tests and build.

Leaderboards are server-checked with plausibility flags, but a determined script can still read a memory round it is shown. Don't attach prizes to these boards.
