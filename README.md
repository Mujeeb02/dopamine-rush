# Dopamine Rush - Memory Game

A challenging memory game built with React, TypeScript, and Supabase. Test your memory and concentration skills in this addictive game where one mistake resets everything!

## 🎮 Features

- **Memory Challenge**: Remember the sequence of colored cards
- **Progressive Difficulty**: More cards appear as you advance
- **Global Leaderboard**: Compete with players worldwide
- **User Profiles**: Track your progress and statistics
- **Responsive Design**: Play on desktop or mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
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
Create a `.env` file in the root directory and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

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
5. **Compete**: Sign in to save your scores and compete on the leaderboard

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

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically on every push

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
