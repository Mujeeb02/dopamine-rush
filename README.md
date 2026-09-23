# Dopamine Rush - Memory Game

A challenging memory game built with React, TypeScript, and Supabase. Test your memory and concentration skills in this addictive game where one mistake resets everything!

## 🎮 Features

- **Memory Challenge**: Remember the sequence of colored cards
- **Progressive Difficulty**: More cards appear as you advance
- **Top Scores**: See each player's best score per game mode
- **User Profiles**: Track your progress and statistics
- **Responsive Design**: Play on desktop or mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js 22 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd dopamine-rush-remastered
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Copy `.env.example` to `.env` and add your Supabase project URL and publishable key:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser at the URL printed by Vite (port 8080 by default).

## 🛠️ Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Animations**: Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Deployment**: Vercel/Netlify ready

## 🎯 How to Play

1. **Start the Game**: Click "Start Game" to begin
2. **Memorize**: Watch the cards flash in sequence
3. **Recall**: Click the cards in the same order
4. **Advance**: Each correct answer adds a point and increases difficulty
5. **Compare**: Sign in to save your scores and view top attempts

## 📊 Game Mechanics

- **Scoring**: 1 point per correct answer
- **Streaks**: Build up streaks for bonus points
- **Difficulty**: More cards appear as your score increases
- **Memory Time**: Time to memorize decreases with difficulty

## 🔧 Development

### Project Structure
```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom React hooks
├── integrations/  # External service integrations
└── lib/          # Utility functions
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Check TypeScript

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel environment
4. Apply pending migrations in `supabase/migrations` to the intended Supabase project, review grants and RLS, and test a signed-in save and anonymous leaderboard load
5. Deploy after `npm run typecheck`, `npm run lint`, and `npm run build` pass

Score submissions still come from the browser. The SQL constraints reject malformed values, but they cannot prove a player completed a game. Do not use these scores for prizes or other competitive decisions until challenge generation and scoring are verified by a trusted server.

### Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🎉 Acknowledgments

- Built with React and TypeScript
- Styled with Tailwind CSS
- Powered by Supabase
- Icons from Lucide React
