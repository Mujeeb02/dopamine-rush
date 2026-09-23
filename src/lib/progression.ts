import { games } from './games';

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safe / 100)) + 1;
  const floor = (level - 1) ** 2 * 100;
  const next = level ** 2 * 100;
  return { level, current: safe - floor, needed: next - floor, percent: (safe - floor) / (next - floor) * 100 };
}
export function dailyChallenge(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  return { day, game: games[((ordinal % games.length) + games.length) % games.length], target: 5, reward: 150 };
}
export function streaks(dates: string[], now = new Date()) {
  const days = [...new Set(dates.map(date => Math.floor(Date.parse(date.slice(0, 10) + 'T00:00:00Z') / 86400000)))].sort((a,b) => b-a);
  const today = Math.floor(Date.parse(now.toISOString().slice(0,10) + 'T00:00:00Z') / 86400000);
  let longest = 0, run = 0, current = 0;
  days.forEach((day, index) => { run = index && days[index-1] === day+1 ? run+1 : 1; longest = Math.max(longest,run); });
  if (days[0] >= today-1) { current = 1; while (days[current] === days[current-1]-1) current++; }
  return { current, longest };
}
export const achievementRules = [
  { id: 'first', name: 'First spark', detail: 'Finish a scored run', target: 1, field: 'games' },
  { id: 'five', name: 'In the zone', detail: 'Clear 5 rounds in one run', target: 5, field: 'best' },
  { id: 'ten', name: 'Double digits', detail: 'Clear 10 rounds in one run', target: 10, field: 'best' },
  { id: 'explorer', name: 'All-rounder', detail: 'Complete all 7 games', target: 7, field: 'modes' },
  { id: 'streak', name: 'Keep the flame', detail: 'Play on 3 consecutive UTC days', target: 3, field: 'longest_streak' },
  { id: 'regular', name: 'Making a habit', detail: 'Finish 25 scored runs', target: 25, field: 'games' },
] as const;
export function achievements(stats: Record<string, number>) {
  return achievementRules.map(rule => ({ ...rule, value: stats[rule.field] ?? 0, unlocked: (stats[rule.field] ?? 0) >= rule.target }));
}
export const durationLabel = (ms: number) => ms >= 60000 ? `${Math.floor(ms/60000)}m ${Math.floor(ms/1000)%60}s` : `${Math.floor(ms/1000)}s`;
