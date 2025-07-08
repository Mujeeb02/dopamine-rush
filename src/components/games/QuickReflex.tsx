import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Target, Zap, AlertTriangle } from "lucide-react";

interface QuickReflexProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const QuickReflex = ({ score, onCorrect, onWrong, gameStarted }: QuickReflexProps) => {
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'paused'>('waiting');
  const [currentColor, setCurrentColor] = useState<string>('');
  const [targetColor, setTargetColor] = useState<string>('');
  const [colorIndex, setColorIndex] = useState(0);
  const [flashInterval, setFlashInterval] = useState(1000);
  const [sequence, setSequence] = useState<string[]>([]);
  const [userClicked, setUserClicked] = useState(false);

  const colors = ['#FF4136', '#2ECC40', '#FFDC00', '#0074D9', '#B10DC9', '#FF851B'];
  const colorNames = ['Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Orange'];

  const generateSequence = useCallback((level: number) => {
    const length = Math.min(5 + Math.floor(level / 2), 12);
    const newSequence = [];
    for (let i = 0; i < length; i++) {
      newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    return newSequence;
  }, []);

  const startNewRound = useCallback(() => {
    const newSequence = generateSequence(score);
    setSequence(newSequence);
    setColorIndex(0);
    setFlashInterval(Math.max(500, 1200 - score * 50));
    setGameState('playing');
    setUserClicked(false);
    
    // Set target color (randomly choose one that appears in sequence)
    const targetIndex = Math.floor(Math.random() * newSequence.length);
    setTargetColor(newSequence[targetIndex]);
  }, [score, generateSequence]);

  const handleColorClick = () => {
    if (gameState !== 'playing') return;
    
    setUserClicked(true);
    
    if (currentColor === targetColor) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  useEffect(() => {
    if (gameState === 'playing' && colorIndex < sequence.length) {
      const timer = setTimeout(() => {
        setCurrentColor(sequence[colorIndex]);
        setColorIndex(prev => prev + 1);
      }, flashInterval);
      
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && colorIndex >= sequence.length) {
      // Sequence finished without user clicking
      setTimeout(() => {
        onWrong();
      }, 500);
    }
  }, [gameState, colorIndex, sequence, flashInterval, onCorrect, onWrong]);

  useEffect(() => {
    if (gameStarted) {
      startNewRound();
    }
  }, [gameStarted, startNewRound]);

  if (!gameStarted) {
    return null;
  }

  return (
    <div className="text-center">
      <AnimatePresence mode="wait">
        {gameState === 'playing' && (
          <motion.div
            key="playing"
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
              Tap when you see {colorNames[colors.indexOf(targetColor)]}!
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              🎯
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Display */}
      <div className="flex justify-center mb-8">
        <motion.div
          className={`w-32 h-32 rounded-full border-4 cursor-pointer transition-all duration-200 ${
            currentColor ? 'border-white' : 'border-gray-600'
          }`}
          style={{ backgroundColor: currentColor || '#374151' }}
          whileHover={gameState === 'playing' ? { scale: 1.05 } : {}}
          whileTap={gameState === 'playing' ? { scale: 0.95 } : {}}
          onClick={handleColorClick}
          animate={currentColor ? {
            scale: [1, 1.1, 1],
            boxShadow: [`0 0 20px ${currentColor}40`, `0 0 40px ${currentColor}60`, `0 0 20px ${currentColor}40`]
          } : {}}
          transition={{
            scale: { duration: 0.3 },
            boxShadow: { duration: 0.5, repeat: Infinity }
          }}
        />
      </div>

      {/* Target Color Indicator */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-2">Target Color:</p>
        <div className="flex justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-white"
            style={{ backgroundColor: targetColor }}
          />
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Progress: {colorIndex}/{sequence.length}
        </p>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <motion.div
            className="bg-gradient-to-r from-green-400 to-emerald-400 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(colorIndex / sequence.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        <p>Click the circle when you see the target color!</p>
        <p className="text-xs mt-1">Speed: {Math.round(1000 / flashInterval)} flashes per second</p>
      </div>

      {/* Warning */}
      {userClicked && currentColor !== targetColor && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg"
        >
          <div className="flex items-center justify-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Wrong color! You clicked on {colorNames[colors.indexOf(currentColor)]}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default QuickReflex; 