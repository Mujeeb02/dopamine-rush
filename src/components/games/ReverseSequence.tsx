import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RotateCcw, ArrowLeft, ArrowRight, Play, Pause } from "lucide-react";

interface ReverseSequenceProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const ReverseSequence = ({ score, onCorrect, onWrong, gameStarted }: ReverseSequenceProps) => {
  const [gameState, setGameState] = useState<'showing' | 'inputting' | 'checking'>('showing');
  const [sequence, setSequence] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTime, setShowTime] = useState(800);
  const [sequenceLength, setSequenceLength] = useState(4);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const colors = ['#FF4136', '#2ECC40', '#FFDC00', '#0074D9', '#B10DC9', '#FF851B'];
  const colorNames = ['Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Orange'];
  const emojis = ['🔴', '🟢', '🟡', '🔵', '🟣', '🟠'];

  const generateSequence = useCallback((level: number) => {
    const length = Math.min(4 + Math.floor(level / 2), 8);
    const newSequence = [];
    for (let i = 0; i < length; i++) {
      newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    return newSequence;
  }, []);

  const startNewRound = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const newSequence = generateSequence(score);
    setSequence(newSequence);
    setUserInput([]);
    setCurrentIndex(0);
    setSequenceLength(newSequence.length);
    setShowTime(Math.max(400, 800 - score * 30));
    setGameState('showing');
  }, [score, generateSequence]);

  const handleColorClick = (color: string) => {
    if (gameState !== 'inputting') return;

    const newInput = [...userInput, color];
    setUserInput(newInput);

    if (newInput.length === sequence.length) {
      // Check if input matches reversed sequence
      const reversedSequence = [...sequence].reverse();
      const isCorrect = newInput.every((color, index) => color === reversedSequence[index]);
      
      if (isCorrect) {
        onCorrect();
      } else {
        onWrong();
      }
    }
  };

  const resetInput = () => {
    setUserInput([]);
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState === 'showing' && currentIndex < sequence.length) {
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, showTime);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else if (gameState === 'showing' && currentIndex >= sequence.length) {
      timeoutRef.current = setTimeout(() => {
        setGameState('inputting');
      }, 500);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [gameState, currentIndex, sequence.length, showTime]);

  useEffect(() => {
    if (gameStarted) {
      startNewRound();
    } else {
      // Reset state when game is not started
      cleanup();
      setGameState('showing');
      setSequence([]);
      setUserInput([]);
      setCurrentIndex(0);
    }
  }, [gameStarted, startNewRound, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  if (!gameStarted) {
    return null;
  }

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
              Watch the sequence... ({Math.round(showTime)}ms per color)
            </motion.h2>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-4xl mb-4"
            >
              🔄
            </motion.div>
          </motion.div>
        )}

        {gameState === 'inputting' && (
          <motion.div
            key="inputting"
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
              Input in REVERSE order!
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              ⬅️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sequence Display */}
      <div className="mb-8">
        {gameState === 'showing' && (
          <div className="flex justify-center gap-4">
            {sequence.map((color, index) => (
              <motion.div
                key={index}
                className={`w-16 h-16 rounded-full border-2 transition-all duration-200 ${
                  index === currentIndex - 1 ? 'border-white scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                animate={index === currentIndex - 1 ? {
                  scale: [1, 1.2, 1],
                  boxShadow: [`0 0 20px ${color}40`, `0 0 40px ${color}60`, `0 0 20px ${color}40`]
                } : {}}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        )}

        {gameState === 'inputting' && (
          <div className="space-y-4">
            {/* User Input Display */}
            <div className="flex justify-center gap-2 mb-4">
              {userInput.map((color, index) => (
                <div
                  key={index}
                  className="w-12 h-12 rounded-full border-2 border-green-400"
                  style={{ backgroundColor: color }}
                />
              ))}
              {[...Array(sequence.length - userInput.length)].map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="w-12 h-12 rounded-full border-2 border-gray-600 bg-gray-700"
                />
              ))}
            </div>

            {/* Color Buttons */}
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
              {colors.map((color, index) => (
                <motion.button
                  key={color}
                  className="w-16 h-16 rounded-full border-2 border-white hover:border-gray-300 transition-all duration-200"
                  style={{ backgroundColor: color }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleColorClick(color)}
                >
                  <span className="text-2xl">{emojis[index]}</span>
                </motion.button>
              ))}
            </div>

            {/* Reset Button */}
            <div className="mt-4">
              <Button
                onClick={resetInput}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Input
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        {gameState === 'showing' && (
          <p>Watch the sequence carefully - you'll need to input it in reverse!</p>
        )}
        {gameState === 'inputting' && (
          <p>Click the colors in the REVERSE order you saw them</p>
        )}
      </div>
    </div>
  );
};

export default ReverseSequence; 