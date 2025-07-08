
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Trophy, Zap, Target, Brain } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import GameGrid from "@/components/GameGrid";
import ScoreBar from "@/components/ScoreBar";
import LoginPopup from "@/components/LoginPopup";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type GameState = 'waiting' | 'showing' | 'question' | 'correct' | 'wrong' | 'gameOver';

export interface Card {
  id: number;
  color: string;
  name: string;
  position: number;
}

// Particle component for effects
const Particle = ({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full pointer-events-none"
    style={{ left: x, top: y, backgroundColor: color }}
    initial={{ scale: 0, opacity: 1 }}
    animate={{ 
      scale: [0, 1, 0],
      opacity: [1, 1, 0],
      x: [0, (Math.random() - 0.5) * 100],
      y: [0, (Math.random() - 0.5) * 100 - 50]
    }}
    transition={{ 
      duration: 1.5, 
      delay,
      ease: "easeOut"
    }}
  />
);

// Floating particles background
const FloatingParticles = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-white/20 rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{
          y: [0, -100, 0],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          delay: Math.random() * 2,
        }}
      />
    ))}
  </div>
);

const Game = () => {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [cards, setCards] = useState<Card[]>([]);
  const [targetCard, setTargetCard] = useState<Card | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [particles, setParticles] = useState<Array<{x: number; y: number; color: string; id: number}>>([]);
  const [showStreakEffect, setShowStreakEffect] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const titleAnimation = useAnimation();

  const colors = ['#7FDBFF', '#FFDC00', '#FF4136', '#B10DC9', '#2ECC40', '#FF851B', '#01FF70', '#F012BE'];
  const colorNames = ['Cyan', 'Yellow', 'Red', 'Purple', 'Green', 'Orange', 'Lime', 'Magenta'];

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateCards = useCallback((level: number) => {
    const cardCount = Math.min(4 + Math.floor(level / 3), 8);
    const selectedColors = colors.slice(0, cardCount);
    const selectedNames = colorNames.slice(0, cardCount);
    
    const baseCards = selectedColors.map((color, index) => ({
      id: index,
      color,
      name: selectedNames[index],
      position: index
    }));

    // Shuffle positions for each round
    const shuffledPositions = shuffleArray([...Array(cardCount)].map((_, i) => i));
    
    return baseCards.map((card, index) => ({
      ...card,
      position: shuffledPositions[index]
    })).sort((a, b) => a.position - b.position);
  }, []);

  // Create particle explosion effect
  const createParticleExplosion = (x: number, y: number, color: string) => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      x,
      y,
      color,
      id: Date.now() + i
    }));
    setParticles(prev => [...prev, ...newParticles]);
    
    // Clean up particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 2000);
  };

  // Streak effect animation
  const triggerStreakEffect = () => {
    setShowStreakEffect(true);
    setTimeout(() => setShowStreakEffect(false), 1000);
  };

  const saveScore = async (finalScore: number, finalStreak: number) => {
    if (!isAuthenticated || !user?.id || finalScore === 0) return;

    try {
      console.log('Saving score:', { finalScore, finalStreak, userId: user.id });
      
      // Ensure profile exists before saving score
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            username: user.user_metadata?.username || user.email?.split('@')[0]
          });
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
      }

      const { error } = await supabase
        .from('game_scores')
        .insert({
          user_id: user.id,
          score: finalScore,
          streak: finalStreak,
          game_mode: 'classic'
        });

      if (error) {
        console.error('Error saving score:', error);
        throw error;
      }

      console.log('Score saved successfully');
      toast({
        title: "Score Saved!",
        description: `Your score of ${finalScore} has been saved to the leaderboard.`,
      });
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Score not saved",
        description: "There was an error saving your score.",
        variant: "destructive",
      });
    }
  };

  // Calculate memory time based on number of cards (minimum 2 seconds, increases by 0.5s per card)
  const getMemoryTime = (cardCount: number) => {
    return Math.max(2000, 1500 + (cardCount * 300));
  };

  const startNewRound = useCallback(() => {
    const newCards = generateCards(score);
    setCards(newCards);
    setGameState('showing');
    
    const memoryTime = getMemoryTime(newCards.length);
    console.log(`Showing ${newCards.length} cards for ${memoryTime}ms`);
    
    // Animate title when starting new round
    titleAnimation.start({
      scale: [1, 1.1, 1],
      rotate: [0, 2, -2, 0],
      transition: { duration: 0.5 }
    });
    
    setTimeout(() => {
      const randomCard = newCards[Math.floor(Math.random() * newCards.length)];
      setTargetCard(randomCard);
      setGameState('question');
    }, memoryTime);
  }, [score, generateCards, titleAnimation]);

  const handleCardClick = (clickedCard: Card) => {
    if (gameState !== 'question') return;

    if (clickedCard.id === targetCard?.id) {
      setGameState('correct');
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
      
      // Create particle effect for correct answer
      createParticleExplosion(clickedCard.position * 100, 200, clickedCard.color);
      
      // Trigger streak effect for streaks of 3 or more
      if (streak + 1 >= 3) {
        triggerStreakEffect();
      }
      
      setTimeout(() => {
        startNewRound();
      }, 1500);
    } else {
      setGameState('wrong');
      
      // Create explosion effect for wrong answer
      createParticleExplosion(clickedCard.position * 100, 200, '#FF4136');
      
      // Only save score if it's greater than 0
      if (score > 0) {
        if (isAuthenticated) {
          saveScore(score, streak);
        } else {
          // Show login popup for unauthenticated users with score > 0
          setShowLoginPopup(true);
        }
      }
      
      if (score > highScore) {
        setHighScore(score);
      }
      
      setTimeout(() => {
        setGameState('gameOver');
      }, 2000);
    }
  };

  const resetGame = () => {
    setScore(0);
    setStreak(0);
    setGameState('waiting');
    setTargetCard(null);
    setShowLoginPopup(false);
    setParticles([]);
  };

  useEffect(() => {
    const saved = localStorage.getItem('dopamine-rush-high-score');
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  useEffect(() => {
    if (score > highScore) {
      localStorage.setItem('dopamine-rush-high-score', score.toString());
    }
  }, [score, highScore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white relative overflow-hidden">
      {/* Floating particles background */}
      <FloatingParticles />
      
      {/* Particle effects */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          x={particle.x}
          y={particle.y}
          color={particle.color}
          delay={0}
        />
      ))}

      {/* Streak effect overlay */}
      <AnimatePresence>
        {showStreakEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 2 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-8xl animate-pulse">🔥</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center p-6 relative z-10">
        <Link to="/">
          <Button variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        
        <motion.div 
          className="text-center"
          animate={titleAnimation}
        >
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Brain className="w-6 h-6" />
            Dopamine Rush
            <Brain className="w-6 h-6" />
          </h1>
        </motion.div>

        <Button 
          onClick={resetGame}
          variant="ghost" 
          className="text-white hover:bg-white/10"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Score Bar */}
      <ScoreBar score={score} highScore={highScore} streak={streak} />

      {/* Game Area */}
      <div className="container mx-auto px-6 py-8 relative z-10">
        <AnimatePresence mode="wait">
          {gameState === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 1, -1, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-8"
              >
                <Brain className="w-24 h-24 mx-auto text-cyan-400" />
              </motion.div>
              
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Ready to Challenge Your Brain?
              </h2>
              
              {!isAuthenticated && (
                <motion.p 
                  className="text-yellow-400 mb-4"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🏆 Sign in to save your scores and compete on the leaderboard!
                </motion.p>
              )}
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={startNewRound}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-xl font-bold rounded-full shadow-lg"
                >
                  <Zap className="w-6 h-6 mr-2" />
                  Start Game
                </Button>
              </motion.div>
            </motion.div>
          )}

          {(gameState === 'showing' || gameState === 'question') && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              {gameState === 'showing' && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <motion.h2
                    animate={{ 
                      scale: [1, 1.1, 1],
                      color: ['#FFDC00', '#FF4136', '#FFDC00']
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-2xl font-bold"
                  >
                    Memorize the colors... ({getMemoryTime(cards.length) / 1000}s)
                  </motion.h2>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="text-4xl mt-4"
                  >
                    🧠
                  </motion.div>
                </motion.div>
              )}
              
              {gameState === 'question' && targetCard && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8"
                >
                  <motion.h2
                    animate={{ 
                      scale: [1, 1.2, 1],
                      color: ['#FFDC00', '#FF4136', '#FFDC00']
                    }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-3xl font-bold"
                  >
                    Where was {targetCard.name}?
                  </motion.h2>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl mt-4"
                  >
                    🤔
                  </motion.div>
                </motion.div>
              )}
              
              <GameGrid 
                cards={cards} 
                gameState={gameState} 
                onCardClick={handleCardClick}
              />
            </motion.div>
          )}

          {gameState === 'correct' && (
            <motion.div
              key="correct"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 0.8 }}
                className="text-8xl mb-4"
              >
                🎉
              </motion.div>
              <motion.h2 
                className="text-4xl font-bold text-green-400 mb-4"
                animate={{ 
                  scale: [1, 1.2, 1],
                  color: ['#2ECC40', '#01FF70', '#2ECC40']
                }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                Correct!
              </motion.h2>
              <motion.p 
                className="text-xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
              >
                Score: {score}
              </motion.p>
              <p className="text-sm text-gray-400">Next round: {cards.length + Math.floor(score / 3)} cards</p>
            </motion.div>
          )}

          {gameState === 'wrong' && (
            <motion.div
              key="wrong"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.4, 1],
                  rotate: [0, -15, 15, 0]
                }}
                transition={{ duration: 1 }}
                className="text-8xl mb-4"
              >
                💥
              </motion.div>
              <motion.h2 
                className="text-4xl font-bold text-red-400 mb-4"
                animate={{ 
                  scale: [1, 1.1, 1],
                  color: ['#FF4136', '#FF851B', '#FF4136']
                }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                Wrong!
              </motion.h2>
              <motion.p 
                className="text-xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
              >
                Final Score: {score}
              </motion.p>
              {score > 0 && !isAuthenticated && (
                <motion.p 
                  className="text-yellow-400 text-sm mt-2"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  Sign in to save this score!
                </motion.p>
              )}
            </motion.div>
          )}

          {gameState === 'gameOver' && (
            <motion.div
              key="gameOver"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div 
                className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md mx-auto border border-white/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <motion.h2 
                  className="text-4xl font-bold mb-6"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    color: ['#FFDC00', '#FF4136', '#FFDC00']
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  Game Over
                </motion.h2>
                <div className="space-y-4 mb-8">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-gray-400">Final Score</p>
                    <motion.p 
                      className="text-3xl font-bold text-yellow-400"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      {score}
                    </motion.p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="text-gray-400">High Score</p>
                    <motion.p 
                      className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-2"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      <Trophy className="w-5 h-5" />
                      {Math.max(score, highScore)}
                    </motion.p>
                  </motion.div>
                  {isAuthenticated && score > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <p className="text-green-400 text-sm">✓ Score saved to leaderboard!</p>
                    </motion.div>
                  )}
                </div>
                
                <motion.div 
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={resetGame}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full w-full shadow-lg"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Play Again
                    </Button>
                  </motion.div>
                  {!isAuthenticated && (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link to="/auth">
                        <Button
                          variant="outline"
                          className="border-white/20 text-white hover:bg-white/10 w-full"
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Sign In to Save Scores
                        </Button>
                      </Link>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Login Popup */}
      <LoginPopup 
        isOpen={showLoginPopup} 
        onClose={() => setShowLoginPopup(false)} 
        score={score}
      />
    </div>
  );
};

export default Game;
