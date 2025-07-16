import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Palette, Eye, Check, Clock, AlertTriangle, Brain } from "lucide-react";

interface PaletteRecallProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const PaletteRecall = ({ score, onCorrect, onWrong, gameStarted }: PaletteRecallProps) => {
  const [gameState, setGameState] = useState<'showing' | 'question' | 'checking'>('showing');
  const [palette, setPalette] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [showTime, setShowTime] = useState(5000);
  const [paletteSize, setPaletteSize] = useState(6);
  const [timeLeft, setTimeLeft] = useState(0);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const generatePalette = useCallback((level: number) => {
    // Easy: 4-6 colors, Medium: 6-8 colors, Hard: 8-12 colors
    const size = level < 5 ? Math.min(4 + Math.floor(level / 2), 6) : 
                 level < 15 ? Math.min(6 + Math.floor((level - 5) / 3), 8) :
                 Math.min(8 + Math.floor((level - 15) / 2), 12);
    
    const newPalette: string[] = [];
    
    // Generate colors with difficulty-based variation
    for (let i = 0; i < size; i++) {
      const hue = Math.floor(Math.random() * 360);
      
      // Easy: High saturation and lightness for distinct colors
      // Medium: Moderate variation
      // Hard: Subtle variations that are harder to distinguish
      let saturation, lightness;
      if (level < 5) {
        // Easy - very distinct colors
        saturation = 60 + Math.random() * 30; // 60-90%
        lightness = 40 + Math.random() * 30; // 40-70%
      } else if (level < 15) {
        // Medium - moderate distinctness
        saturation = 50 + Math.random() * 40; // 50-90%
        lightness = 35 + Math.random() * 35; // 35-70%
      } else {
        // Hard - subtle variations
        saturation = 40 + Math.random() * 50; // 40-90%
        lightness = 30 + Math.random() * 40; // 30-70%
      }
      
      newPalette.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return newPalette;
  }, []);

  const generateOptions = useCallback((targetColor: string, palette: string[]) => {
    // Use ALL colors from the original palette as options
    // Shuffle the palette to randomize the order
    return [...palette].sort(() => Math.random() - 0.5);
  }, []);

  const startNewRound = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }

    const newPalette = generatePalette(score);
    setPalette(newPalette);
    setPaletteSize(newPalette.length);
    
    // Easy: More time, Medium: Moderate time, Hard: Less time
    const baseTime = score < 5 ? 8000 : score < 15 ? 6000 : 4000;
    setShowTime(Math.max(3000, baseTime - score * 50));
    setGameState('showing');
    
    // Set question index (which position to ask about)
    const questionIdx = Math.floor(Math.random() * newPalette.length);
    setQuestionIndex(questionIdx);
  }, [score, generatePalette]);

  const handleOptionClick = (selectedColor: string) => {
    const correctColor = palette[questionIndex];
    const isCorrect = selectedColor === correctColor;
    
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
    }
    
    // Move to next round or end game
    if (round < totalRounds) {
      setRound(prev => prev + 1);
      setTimeout(() => {
        startNewRound();
      }, 1000);
    } else {
      // Game finished - adjust success rate based on difficulty
      const successRate = (correctAnswers + (isCorrect ? 1 : 0)) / totalRounds;
      const requiredRate = score < 5 ? 0.5 : score < 15 ? 0.6 : 0.7; // Easier requirements for beginners
      if (successRate >= requiredRate) {
        onCorrect();
      } else {
        onWrong();
      }
    }
  };

  const startCountdown = useCallback(() => {
    // Easy: More time, Medium: Moderate time, Hard: Less time
    const baseTime = score < 5 ? 20 : score < 15 ? 15 : 10;
    const questionTime = Math.max(8, baseTime - Math.floor(score / 5));
    setTimeLeft(questionTime);
    
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - wrong answer
          handleOptionClick(''); // Pass empty string to indicate timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [score, handleOptionClick]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState === 'showing') {
      timeoutRef.current = setTimeout(() => {
        const correctColor = palette[questionIndex];
        const newOptions = generateOptions(correctColor, palette);
        setOptions(newOptions);
        setGameState('question');
        startCountdown();
      }, showTime);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [gameState, showTime, palette, questionIndex, generateOptions, startCountdown]);

  useEffect(() => {
    if (gameStarted) {
      setRound(1);
      setCorrectAnswers(0);
      // Easy: Fewer rounds, Medium: Moderate rounds, Hard: More rounds
      const rounds = score < 5 ? 3 : score < 15 ? 4 : 5;
      setTotalRounds(rounds);
      startNewRound();
    } else {
      // Reset state when game is not started
      cleanup();
      setGameState('showing');
      setPalette([]);
      setOptions([]);
      setQuestionIndex(0);
      setTimeLeft(0);
      setRound(1);
      setCorrectAnswers(0);
    }
  }, [gameStarted, startNewRound, cleanup, score]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  if (!gameStarted) {
    return null;
  }

  // Get difficulty level for display
  const getDifficultyLevel = () => {
    if (score < 5) return "Easy";
    if (score < 15) return "Medium";
    return "Hard";
  };

  return (
    <div className="text-center">
      <AnimatePresence mode="wait">
        {gameState === 'showing' && (
          <motion.div
            key="showing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-8"
          >
            <motion.h2
              animate={{ 
                scale: [1, 1.1, 1],
                color: ['#FFDC00', '#FF4136', '#FFDC00']
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-2xl font-bold mb-4"
            >
              Study the palette... ({Math.round(showTime / 1000)}s)
            </motion.h2>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-4xl mb-4"
            >
              🎨
            </motion.div>
          </motion.div>
        )}

        {gameState === 'question' && (
          <motion.div
            key="question"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-8"
          >
            <motion.h2
              animate={{ 
                scale: [1, 1.2, 1],
                color: ['#FFDC00', '#FF4136', '#FFDC00']
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-3xl font-bold mb-4"
            >
              Round {round}/{totalRounds} - Which color was at position {questionIndex + 1}?
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              🧠
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Difficulty and Round Progress */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">
          Difficulty: <span className="text-yellow-400 font-bold">{getDifficultyLevel()}</span> | 
          Round {round}/{totalRounds} | Correct: {correctAnswers}/{round - 1}
        </p>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((round - 1) / totalRounds) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Palette Display - Only show during showing phase */}
      {gameState === 'showing' && (
        <div className="mb-8">
          <div className="flex justify-center gap-2 mb-4 flex-wrap max-w-2xl mx-auto">
            {palette.map((color, index) => (
              <motion.div
                key={index}
                className="w-12 h-12 rounded-lg border-2 border-gray-600 transition-all duration-200"
                style={{ backgroundColor: color }}
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: ['0 0 5px rgba(255, 255, 255, 0.2)', '0 0 15px rgba(255, 255, 255, 0.4)', '0 0 5px rgba(255, 255, 255, 0.2)']
                }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.1 }}
              >
                <div className="flex items-center justify-center h-full text-white font-bold text-xs">
                  {index + 1}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-gray-400">
            Remember all the colors and their positions! You'll be tested on {totalRounds} random positions.
          </p>
        </div>
      )}

      {/* Options Display - Only show during question phase */}
      {gameState === 'question' && (
        <div className="mb-8">
          {/* Timer */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">{timeLeft}s</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / 20) * 100}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>

          {/* All palette colors as options */}
          <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
            {options.map((color, index) => (
              <motion.button
                key={index}
                className="w-16 h-16 rounded-lg border-2 border-white hover:border-gray-300 transition-all duration-200"
                style={{ backgroundColor: color }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOptionClick(color)}
              />
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Click the color that was at position {questionIndex + 1} from all the original colors
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        {gameState === 'showing' && (
          <p>Study the color palette carefully - you'll be tested on {totalRounds} random positions!</p>
        )}
        {gameState === 'question' && (
          <p>Click the color that was at the specified position. Need {score < 5 ? '50%' : score < 15 ? '60%' : '70%'} success rate to win!</p>
        )}
      </div>
    </div>
  );
};

export default PaletteRecall; 