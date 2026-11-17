import { injectMeta } from '../seo/meta.mjs';
import { gamePages } from '../seo/pages.mjs';
import { rpc, type PublicChallenge } from './_supabase';
export const config = { runtime: 'edge' };

/** Serves the app shell for /c/:slug with link-preview tags, so WhatsApp, X and Discord show the challenge. */
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') ?? '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12);
  const shell = await fetch(new URL('/app.html', url.origin)).then(r => r.text());
  const c = slug ? await rpc<PublicChallenge>('get_challenge', { p_slug: slug }).catch(() => null) : null;
  const page = gamePages.find(g => g.mode === c?.game_mode);
  if (!c || !page) return new Response(shell, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  const value = c.game_mode === 'quick-reflex' && c.creator.best_ms ? `${c.creator.best_ms} ms` : `${c.creator.score} ${c.creator.score === 1 ? 'round' : 'rounds'}`;
  const html = injectMeta(shell, {
    title: `Can you beat ${c.creator.username}? ${value} in ${page.name}`,
    description: `${c.creator.username} challenged you on Dopamine Rush. Same rounds, no sign-up. Takes under a minute.`,
    url: `${url.origin}/c/${slug}`,
    image: `${url.origin}/api/og?slug=${slug}`,
    noindex: true,
  });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
