import { Brain, Scan, RotateCcw, Crosshair, Route, Palette, Keyboard } from 'lucide-react';

export const games = [
  { id: 'classic', name: 'Classic Memory', skill: 'Memory', difficulty: 'Easy to start', accent: '#80ddd2', icon: Brain, description: 'A flash of color. A test of recall.', instructions: 'Memorize the colored tiles. When they turn over, choose the position of the requested color.', keys: 'Use Tab and Enter, or tap a tile.' },
  { id: 'freeze-frame', name: 'Freeze Frame', skill: 'Attention', difficulty: 'Builds with you', accent: '#a8a1ff', icon: Scan, description: 'Capture the pattern. Rebuild the moment.', instructions: 'Remember the highlighted cells, then select the same cells and check your pattern. Every right cell scores; a wrong pick cancels one out. You have one life: the first miss shows you the pattern and the run goes on.', keys: 'Use Tab and Space to select cells. Press Check pattern when ready.' },
  { id: 'reverse-sequence', name: 'Reverse Sequence', skill: 'Memory', difficulty: 'A mental twist', accent: '#f4b773', icon: RotateCcw, description: 'Follow the rhythm. Think backwards.', instructions: 'Watch the color sequence, then repeat it in reverse order.', keys: 'Tap colors or use number keys 1–6.' },
  { id: 'quick-reflex', name: 'Quick Reflex', skill: 'Reaction', difficulty: 'Fast and focused', accent: '#ff805f', icon: Crosshair, description: 'Wait for your color. Make your move.', instructions: 'Wait until the large target matches the named color, then tap. A tap on another color ends the run.', keys: 'Press Space or tap the target.' },
  { id: 'trail-tracker', name: 'Trail Tracker', skill: 'Coordination', difficulty: 'Find your flow', accent: '#8cbaff', icon: Route, description: 'One path. Keep it in your mind.', instructions: 'Watch the path appear one cell at a time. Retrace it in the same order.', keys: 'Use Tab and Enter, or tap cells in order.' },
  { id: 'palette-recall', name: 'Palette Recall', skill: 'Accuracy', difficulty: 'Look a little closer', accent: '#e8a6ce', icon: Palette, description: 'Small differences. Sharp observation.', instructions: 'Memorize the numbered colors, then choose the color that occupied the requested position.', keys: 'Use number keys 1–4 or tap a color. This game relies on color perception.' },
  { id: 'speed-typist', name: 'Speed Typist', skill: 'Speed', difficulty: 'Quick fingers', accent: '#b9d88a', icon: Keyboard, description: 'Thirty seconds. Every word counts.', instructions: 'Type the words in order for 30 seconds. Press Space after each word. Only correctly typed words count toward your words per minute.', keys: 'Use your keyboard or the on-screen keyboard on your phone. Pasting is turned off.' },
] as const;
export type GameMode = typeof games[number]['id'];
export const gameById = (id?: string) => games.find(game => game.id === id);
export const colorNames = ['Coral', 'Mint', 'Gold', 'Blue', 'Violet', 'Rose', 'Lime', 'Orange'];
export const colors = ['#ff805f', '#80ddd2', '#f4cf75', '#8cbaff', '#a8a1ff', '#e8a6ce', '#b9d88a', '#eeaa71'];
export interface Challenge {
  round: number; mode: GameMode; reveal_ms: number; limit_ms: number;
  size?: number; cells?: number[]; sequence?: number[]; cards?: number[];
  target?: number; options?: string[]; palette?: string[]; word?: string; interval_ms?: number;
  words?: string[]; duration_ms?: number;
}
export type ReflexAnswer = { pick: number; ms?: number };
export type TypingAnswer = { typed: string };
export type Answer = number | number[] | string | string[] | ReflexAnswer | TypingAnswer | { timeout?: boolean; quit?: boolean };
export type RunKind = 'practice' | 'standard' | 'daily' | 'challenge';
export interface GameResult {
  id: string; game_mode: GameMode; score: number; duration_ms: number;
  xp_earned: number; challenge_bonus: number; personal_best: boolean;
  previous_best: number; created_at: string; verified: boolean;
  best_ms?: number | null; avg_ms?: number | null; previous_best_ms?: number | null;
  kind?: 'standard' | 'daily' | 'daily_replay' | 'challenge'; daily_number?: number | null; flagged?: boolean;
  /** Rounds cleared. The score itself is cells for Freeze Frame and words per minute for Speed Typist. */
  rounds?: number | null; accuracy?: number | null; lives_used?: number;
}
/** Games whose headline number is a reaction time rather than rounds cleared. */
export const timedGames: readonly string[] = ['quick-reflex'];
/** Games played as one timed sprint instead of round after round. */
export const sprintGames: readonly string[] = ['speed-typist'];
/** What a game's score counts. Reaction time, when there is one, takes over in headlineNumber. */
export function scoreUnit(mode: string, n: number) {
  if (mode === 'freeze-frame') return n === 1 ? 'cell' : 'cells';
  if (mode === 'speed-typist') return 'WPM';
  return n === 1 ? 'round' : 'rounds';
}
/** A score with its unit, e.g. "42 cells", "61 WPM", "9 rounds". */
export const formatScore = (mode: string, n: number) => `${n} ${scoreUnit(mode, n)}`;
export const gameSlugs: Record<GameMode, string> = {
  'classic': 'color-memory-test', 'freeze-frame': 'visual-memory-test', 'reverse-sequence': 'reverse-sequence-memory-test',
  'quick-reflex': 'reaction-time-test', 'trail-tracker': 'path-memory-test', 'palette-recall': 'color-perception-test', 'speed-typist': 'typing-speed-test',
};
export interface RoundProps { challenge: Challenge; onAnswer: (answer: Answer) => void; disabled?: boolean }
