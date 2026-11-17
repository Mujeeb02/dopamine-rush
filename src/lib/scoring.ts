// The same scoring rules the server applies in answer_round, for practice runs
// and for live feedback while playing. Keep the two in step.

/** Freeze Frame: right picks score, each wrong pick cancels one, and only an exact pattern clears the round. */
export function freezeCredit(picked: number[], pattern: number[]) {
  const unique = [...new Set(picked)];
  const hit = unique.filter(c => pattern.includes(c)).length;
  const wrong = unique.length - hit;
  return { hit, wrong, credited: Math.max(0, hit - wrong), exact: hit === pattern.length && wrong === 0 };
}

/**
 * Speed Typist: words count only when typed exactly, in order. Five characters
 * (with the space after the word) make one word. A last word the clock cut off
 * part-way counts neither for nor against accuracy.
 */
export function typingStats(typed: string, words: string[], durationMs = 30000) {
  const trimmed = typed.trim();
  const tokens = trimmed ? trimmed.split(/\s+/) : [];
  let goodWords = 0, goodChars = 0, typedWords = tokens.length;
  for (let i = 0; i < Math.min(tokens.length, words.length); i++) {
    if (tokens[i] === words[i]) { goodWords++; goodChars += words[i].length + 1; }
  }
  const last = typedWords - 1;
  if (typedWords > 0 && typedWords <= words.length && tokens[last] !== words[last] && words[last].startsWith(tokens[last])) typedWords--;
  return {
    goodWords, goodChars, typedWords,
    wpm: Math.round(goodChars / 5 / (durationMs / 60000)),
    accuracy: typedWords > 0 ? Math.min(100, Math.round(goodWords * 100 / typedWords)) : null,
  };
}
