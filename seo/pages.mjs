// Search and link-preview copy for public pages. Used at build time (scripts/prerender.mjs)
// and at the edge (api/). Keep titles under ~60 characters and descriptions under ~155.

export const site = {
  name: 'Dopamine Rush',
  title: 'Dopamine Rush — Quick brain and reflex games you can challenge friends on',
  description: 'Free reaction time, memory and typing tests in your browser. Server-checked scores, a daily challenge and challenge links to send your friends.',
};

/** @type {{mode:string,slug:string,name:string,title:string,description:string,how:string[],faq:[string,string][]}[]} */
export const gamePages = [
  { mode: 'quick-reflex', slug: 'reaction-time-test', name: 'Quick Reflex',
    title: 'Reaction Time Test — measure your reflexes in ms | Dopamine Rush',
    description: 'Test your reaction time in milliseconds. Wait for your colour, tap, and see your best and average. Free, no sign-up, challenge a friend.',
    how: ['Watch the colour target.', 'Tap or press Space the moment it turns to your colour.', 'Each round gets faster. One early or wrong tap ends the run.'],
    faq: [['What is a good reaction time?', 'For a simple visual test in a browser, many people land between 200 and 300 ms. Your device and screen add some delay, so compare yourself with your own past runs first.'],
          ['Why does tapping early end the run?', 'A tap before the colour appears is anticipation, not reaction. Taps under 100 ms are not counted as reactions.']] },
  { mode: 'freeze-frame', slug: 'visual-memory-test', name: 'Freeze Frame',
    title: 'Visual Memory Test — remember the pattern | Dopamine Rush',
    description: 'A grid lights up, then goes dark. Rebuild the pattern from memory. Grids grow and time shrinks as you go. Free browser game.',
    how: ['Memorise the lit cells.', 'Select the same cells once they hide.', 'Press Check pattern. Patterns get bigger each round.'],
    faq: [['How many cells can people remember?', 'It varies a lot. Track your own best and try again tomorrow.']] },
  { mode: 'classic', slug: 'color-memory-test', name: 'Classic Memory',
    title: 'Colour Memory Test — where was that colour? | Dopamine Rush',
    description: 'See a set of coloured tiles for a moment, then find where one of them was. More tiles each round. Free, instant, no download.',
    how: ['Study the coloured tiles.', 'When they flip, choose where the named colour was.', 'More tiles appear as you progress.'], faq: [] },
  { mode: 'reverse-sequence', slug: 'reverse-sequence-memory-test', name: 'Reverse Sequence',
    title: 'Reverse Sequence Memory Test | Dopamine Rush',
    description: 'Watch a sequence of colours, then enter it backwards. A working-memory test that gets longer and faster each round.',
    how: ['Watch each colour in order.', 'Enter the sequence in reverse with taps or keys 1–6.'], faq: [] },
  { mode: 'trail-tracker', slug: 'path-memory-test', name: 'Trail Tracker',
    title: 'Path Memory Test — retrace the trail | Dopamine Rush',
    description: 'A path lights up one cell at a time. Retrace it in the same order. Longer, faster paths each round.',
    how: ['Watch the path appear.', 'Tap the cells in the same order.'], faq: [] },
  { mode: 'palette-recall', slug: 'color-perception-test', name: 'Palette Recall',
    title: 'Colour Perception Test — spot the shade | Dopamine Rush',
    description: 'Memorise a row of close shades, then pick the one that was in a given position. A test of colour perception and memory.',
    how: ['Memorise the numbered shades.', 'Pick the shade that was in the requested position.'], faq: [] },
  { mode: 'speed-typist', slug: 'typing-speed-test', name: 'Speed Typist',
    title: 'Typing Speed Test — type before the timer | Dopamine Rush',
    description: 'Type each word exactly before time runs out. Words get longer and the clock gets tighter. Free typing game in your browser.',
    how: ['Type the word shown, exactly.', 'Each correct word starts a harder round.'], faq: [] },
];

export const staticPages = [
  { path: '/', title: site.title, description: site.description },
  { path: '/game', title: 'All games | Dopamine Rush', description: 'Seven quick games for reaction, memory, attention and typing. Pick one and play instantly.' },
  { path: '/daily', title: 'Daily brain challenge | Dopamine Rush', description: 'One challenge a day, the same rounds for everyone. Your first run counts. Share your result.' },
  { path: '/leaderboard', title: 'Leaderboards | Dopamine Rush', description: 'Verified best runs for every game, by day, week, month and all time.' },
];
