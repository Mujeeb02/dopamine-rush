import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, RotateCcw, Check, X } from "lucide-react";

interface GridCell {
  id: number;
  isActive: boolean;
  isSelected: boolean;
}

interface FreezeFrameProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const FreezeFrame = ({ score, onCorrect, onWrong, gameStarted }: FreezeFrameProps) => {
  const [gameState, setGameState] = useState<'showing' | 'recreating' | 'checking'>('showing');
  const [pattern, setPattern] = useState<GridCell[]>([]);
  const [userPattern, setUserPattern] = useState<GridCell[]>([]);
  const [gridSize, setGridSize] = useState(4);
  const [showTime, setShowTime] = useState(3000);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generatePattern = useCallback((level: number) => {
    const size = Math.min(4 + Math.floor(level / 5), 6);
    const cells = size * size;
    const activeCount = Math.min(3 + Math.floor(level / 3), Math.floor(cells / 2));
    
    const newPattern = Array.from({ length: cells }, (_, i) => ({
      id: i,
      isActive: false,
      isSelected: false
    }));

    // Randomly activate cells
    const shuffled = [...Array(cells)].map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < activeCount; i++) {
      newPattern[shuffled[i]].isActive = true;
    }

    return newPattern;
  }, []);

  const startNewRound = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const newPattern = generatePattern(score);
    setPattern(newPattern);
    setUserPattern(Array.from({ length: newPattern.length }, (_, i) => ({
      id: i,
      isActive: false,
      isSelected: false
    })));
    setGridSize(Math.sqrt(newPattern.length));
    setShowTime(Math.max(2000, 4000 - score * 100));
    setGameState('showing');
  }, [score, generatePattern]);

  const handleCellClick = (cellId: number) => {
    if (gameState !== 'recreating') return;

    setUserPattern(prev => prev.map(cell => 
      cell.id === cellId 
        ? { ...cell, isSelected: !cell.isSelected }
        : cell
    ));
  };

  const checkPattern = () => {
    const isCorrect = pattern.every((cell, index) => 
      cell.isActive === userPattern[index].isSelected
    );

    if (isCorrect) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState === 'showing') {
      timeoutRef.current = setTimeout(() => {
        setGameState('recreating');
      }, showTime);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [gameState, showTime]);

  useEffect(() => {
    if (gameStarted) {
      startNewRound();
    } else {
      // Reset state when game is not started
      cleanup();
      setGameState('showing');
      setPattern([]);
      setUserPattern([]);
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
              Memorize the pattern... ({Math.round(showTime / 1000)}s)
            </motion.h2>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-4xl mb-4"
            >
              👁️
            </motion.div>
          </motion.div>
        )}

        {gameState === 'recreating' && (
          <motion.div
            key="recreating"
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
              Recreate the pattern
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

      {/* Pattern Grid */}
      <div className="flex justify-center mb-8">
        <div 
          className="grid gap-2"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            width: `${gridSize * 80}px`
          }}
        >
          {pattern.map((cell) => (
            <motion.div
              key={cell.id}
              className={`w-16 h-16 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                gameState === 'showing' && cell.isActive
                  ? 'bg-gradient-to-r from-purple-400 to-pink-400 border-purple-300'
                  : gameState === 'recreating' && userPattern[cell.id]?.isSelected
                  ? 'bg-gradient-to-r from-green-400 to-emerald-400 border-green-300'
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}
              whileHover={gameState === 'recreating' ? { scale: 1.05 } : {}}
              whileTap={gameState === 'recreating' ? { scale: 0.95 } : {}}
              onClick={() => handleCellClick(cell.id)}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {gameState === 'recreating' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center gap-4"
        >
          <Button
            onClick={checkPattern}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-2 rounded-full"
          >
            <Check className="w-4 h-4 mr-2" />
            Check Pattern
          </Button>
          
          <Button
            onClick={() => setUserPattern(Array.from({ length: pattern.length }, (_, i) => ({
              id: i,
              isActive: false,
              isSelected: false
            })))}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 px-6 py-2 rounded-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default FreezeFrame; 