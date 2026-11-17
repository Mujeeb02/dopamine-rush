import { ImageResponse } from '@vercel/og';
import { gamePages } from '../seo/pages.mjs';
import { rpc, type PublicChallenge } from './_supabase.js';
export const config = { runtime: 'edge' };

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

/**
 * Score card, 1200×630 for link previews or 1080×1920 with ?format=story.
 * /api/og?slug=abc1234 for a challenge, or /api/og?game=quick-reflex&value=213%20ms&label=best%20reaction
 */
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const story = url.searchParams.get('format') === 'story';
  let mode = url.searchParams.get('game') ?? 'quick-reflex';
  let value = (url.searchParams.get('value') ?? '').slice(0, 16);
  let label = (url.searchParams.get('label') ?? '').slice(0, 40);
  let byline = 'Can you beat it?';
  const slug = (url.searchParams.get('slug') ?? '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12);
  if (slug) {
    const c = await rpc<PublicChallenge>('get_challenge', { p_slug: slug }).catch(() => null);
    if (c) {
      mode = c.game_mode;
      const timed = c.game_mode === 'quick-reflex' && c.creator.best_ms;
      value = timed ? `${c.creator.best_ms} ms` : String(c.creator.score);
      label = timed ? 'best reaction' : c.creator.score === 1 ? 'round cleared' : 'rounds cleared';
      byline = `${c.creator.username} challenges you`;
    }
  }
  const game = gamePages.find(g => g.mode === mode)?.name ?? 'Dopamine Rush';
  const [w, h] = story ? [1080, 1920] : [1200, 630];
  const card = el('div', { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: story ? 96 : 64, background: '#0b0f1a', color: '#f4f6fb', fontFamily: 'sans-serif' }, [
    el('div', { display: 'flex', alignItems: 'center', gap: 16, fontSize: story ? 40 : 30, letterSpacing: 4, color: '#ff805f' }, '⚡ DOPAMINE RUSH'),
    el('div', { display: 'flex', flexDirection: 'column', gap: 8 }, [
      el('div', { fontSize: story ? 48 : 34, color: '#9aa7bd' }, game),
      el('div', { fontSize: story ? 260 : 180, fontWeight: 800, lineHeight: 1, color: '#80ddd2', letterSpacing: -6 }, value || '⚡'),
      el('div', { fontSize: story ? 44 : 32, color: '#9aa7bd' }, label),
    ]),
    el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: story ? 44 : 30 }, [
      el('div', { color: '#f4f6fb' }, byline),
      el('div', { color: '#9aa7bd', fontSize: story ? 34 : 24 }, slug ? `${url.host}/c/${slug}` : url.host),
    ]),
  ]);
  return new ImageResponse(card as unknown as ConstructorParameters<typeof ImageResponse>[0], { width: w, height: h, headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400' } });
}
