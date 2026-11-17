import { formatScore, gameById, timedGames, type GameMode, type GameResult } from './games';
import { track } from './analytics';

export const siteUrl = ((import.meta.env.VITE_SITE_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : 'https://dopamine-rush.vercel.app')).replace(/\/$/, '');
export const challengeUrl = (slug: string) => `${siteUrl}/c/${slug}`;
export const dailyUrl = () => `${siteUrl}/daily`;

/** The one number a result is about: reaction time, cells, words per minute or rounds. */
export function headlineNumber(mode: GameMode, r: Pick<GameResult, 'score' | 'best_ms'>) {
  if (timedGames.includes(mode) && r.best_ms) return { value: `${r.best_ms} ms`, label: 'best reaction' };
  if (mode === 'freeze-frame') return { value: formatScore(mode, r.score), label: 'recalled' };
  if (mode === 'speed-typist') return { value: formatScore(mode, r.score), label: 'typing speed' };
  return { value: String(r.score), label: r.score === 1 ? 'round cleared' : 'rounds cleared' };
}

/** A spoiler-free result grid in the Wordle tradition: one square per cleared round, red for the miss. */
export function resultGrid(score: number) {
  const shown = Math.min(score, 10);
  return '🟩'.repeat(shown) + (score > shown ? ` +${score - shown}` : '') + '🟥';
}

export function shareText(mode: GameMode, r: Pick<GameResult, 'score' | 'best_ms' | 'daily_number'> & Partial<Pick<GameResult, 'rounds' | 'accuracy'>>, opts: { challenge?: boolean; against?: string } = {}) {
  const game = gameById(mode)?.name ?? 'Dopamine Rush';
  const head = headlineNumber(mode, r);
  if (r.daily_number != null) {
    // A sprint has no rounds to draw, so it shares its number on its own.
    if (mode === 'speed-typist') return `Dopamine Rush #${r.daily_number} ⚡ ${game}\n⌨️ ${head.value}${r.accuracy != null ? ` · ${r.accuracy}% accuracy` : ''}`;
    const rounds = r.rounds ?? r.score;
    const extra = mode === 'freeze-frame' ? ` · ${head.value}` : r.best_ms ? ` · ${r.best_ms} ms` : '';
    return `Dopamine Rush #${r.daily_number} ⚡ ${game}\n${resultGrid(rounds)} ${rounds} ${rounds === 1 ? 'round' : 'rounds'}${extra}`;
  }
  if (opts.against) return `I just took on ${opts.against} in ${game}: ${head.value} ${head.label}. Your turn ⚡`;
  return opts.challenge ? `${head.value} ${head.label} in ${game}. Think you can beat me? ⚡` : `${head.value} ${head.label} in ${game} on Dopamine Rush ⚡`;
}

export type Channel = 'native' | 'whatsapp' | 'x' | 'copy';
export const channelUrl = (channel: 'whatsapp' | 'x', text: string, url: string) =>
  channel === 'whatsapp' ? `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` : `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

/** Shares through the system sheet when there is one, otherwise copies. Returns what happened. */
export async function shareLink(text: string, url: string, context: Record<string, string | number | boolean>): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  track('share_clicked', { channel: 'native', ...context });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share && window.matchMedia?.('(pointer: coarse)').matches) {
    try { await nav.share({ text, url }); track('share_completed', { channel: 'native', ...context }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  try { await nav!.clipboard.writeText(`${text}\n${url}`); track('share_completed', { channel: 'copy', ...context }); return 'copied'; }
  catch { return 'failed'; }
}

/** Positive when the result beats the opponent: more rounds first, then a faster best reaction. */
export function compare(r:{score:number;best_ms?:number|null},o:{score:number;best_ms?:number|null}){
  if(r.score!==o.score)return r.score-o.score;
  if(r.best_ms&&o.best_ms)return o.best_ms-r.best_ms;
  return 0;
}
