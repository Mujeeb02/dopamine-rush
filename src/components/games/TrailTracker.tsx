import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MousePointer, RotateCcw, Check, Clock, AlertTriangle, Eye } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface TrailTrackerProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const TrailTracker = ({ score, onCorrect, onWrong, gameStarted }: TrailTrackerProps) => {
  const [gameState, setGameState] = useState<'showing' | 'retracing' | 'checking'>('showing');
  const [trail, setTrail] = useState<Point[]>([]);
  const [userTrail, setUserTrail] = useState<Point[]>([]);
  const [currentPoint, setCurrentPoint] = useState(0);
  const [showTime, setShowTime] = useState(3000);
  const [trailLength, setTrailLength] = useState(5);
  const [gridSize, setGridSize] = useState(8);
  const [timeLeft, setTimeLeft] = useState(0);
  const [wrongClicks, setWrongClicks] = useState<Point[]>([]);
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const generateTrail = useCallback((level: number) => {
    // Easy: 4-6 points, Medium: 6-8 points, Hard: 8-12 points
    const length = level < 5 ? Math.min(4 + Math.floor(level / 2), 6) : 
                   level < 15 ? Math.min(6 + Math.floor((level - 5) / 3), 8) :
                   Math.min(8 + Math.floor((level - 15) / 2), 12);
    
    // Easy: 6x6 grid, Medium: 8x8 grid, Hard: 10x10 grid
    const size = level < 5 ? 6 : level < 15 ? 8 : 10;
    
    const newTrail: Point[] = [];
    
    // Start from a random position, not center
    let currentX = Math.floor(Math.random() * size);
    let currentY = Math.floor(Math.random() * size);
    newTrail.push({ x: currentX, y: currentY });

    // Create patterns based on difficulty
    const patternType = level < 5 ? 0 : level < 15 ? level % 2 : level % 4;
    
    for (let i = 1; i < length; i++) {
      let nextX, nextY;
      
      if (patternType === 0) {
        // Easy: Simple L-shaped movements
        const directions = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 }
        ];
        const direction = directions[Math.floor(Math.random() * directions.length)];
        nextX = currentX + direction.dx;
        nextY = currentY + direction.dy;
      } else if (patternType === 1) {
        // Medium: Diagonal patterns
        const angle = (i * 0.8) % (2 * Math.PI);
        const radius = Math.floor(i / 3) + 1;
        nextX = Math.floor(size / 2) + Math.floor(radius * Math.cos(angle));
        nextY = Math.floor(size / 2) + Math.floor(radius * Math.sin(angle));
      } else if (patternType === 2) {
        // Hard: Random jumps
        nextX = Math.floor(Math.random() * size);
        nextY = Math.floor(Math.random() * size);
      } else {
        // Hard: Snake-like pattern
        const directions = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
        ];
        const direction = directions[Math.floor(Math.random() * directions.length)];
        nextX = currentX + direction.dx;
        nextY = currentY + direction.dy;
      }
      
      // Ensure bounds
      nextX = Math.max(0, Math.min(size - 1, nextX));
      nextY = Math.max(0, Math.min(size - 1, nextY));
      
      // Avoid duplicates and ensure minimum distance
      const isDuplicate = newTrail.some(p => p.x === nextX && p.y === nextY);
      const isTooClose = newTrail.some(p => Math.abs(p.x - nextX) <= 1 && Math.abs(p.y - nextY) <= 1);
      
      if (!isDuplicate && !isTooClose) {
        newTrail.push({ x: nextX, y: nextY });
        currentX = nextX;
        currentY = nextY;
      } else {
        // Try again with a different approach
        nextX = Math.floor(Math.random() * size);
        nextY = Math.floor(Math.random() * size);
        if (!newTrail.some(p => p.x === nextX && p.y === nextY)) {
          newTrail.push({ x: nextX, y: nextY });
          currentX = nextX;
          currentY = nextY;
        }
      }
    }

    return { trail: newTrail, size };
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

    const { trail: newTrail, size } = generateTrail(score);
    setTrail(newTrail);
    setUserTrail([]);
    setWrongClicks([]);
    setShowWrongFeedback(false);
    setCurrentPoint(0);
    setTrailLength(newTrail.length);
    setGridSize(size);
    
    // Easy: More time, Medium: Moderate time, Hard: Less time
    const baseTime = score < 5 ? 4000 : score < 15 ? 3000 : 2000;
    setShowTime(Math.max(2000, baseTime - score * 50));
    
    // Easy: More attempts, Medium: Moderate attempts, Hard: Fewer attempts
    const attempts = score < 5 ? 5 : score < 15 ? 4 : 3;
    setMaxAttempts(attempts);
    setAttempts(0);
    setGameState('showing');
  }, [score, generateTrail]);

  const handleGridClick = (x: number, y: number) => {
    if (gameState !== 'retracing') return;

    const newPoint = { x, y };
    const expectedPoint = trail[userTrail.length];
    
    // Check if this is the correct next point
    if (expectedPoint && expectedPoint.x === x && expectedPoint.y === y) {
      setUserTrail(prev => [...prev, newPoint]);
      
      // Check if trail is complete
      if (userTrail.length + 1 === trail.length) {
        onCorrect();
      }
    } else {
      // Wrong click
      setWrongClicks(prev => [...prev, newPoint]);
      setShowWrongFeedback(true);
      setAttempts(prev => prev + 1);
      
      // Clear wrong feedback after 1 second
      setTimeout(() => {
        setShowWrongFeedback(false);
      }, 1000);
      
      // Check if too many attempts
      if (attempts + 1 >= maxAttempts) {
        setTimeout(() => {
          onWrong();
        }, 1000);
      }
    }
  };

  const resetTrail = () => {
    setUserTrail([]);
    setWrongClicks([]);
    setShowWrongFeedback(false);
    setAttempts(0);
  };

  const startCountdown = useCallback(() => {
    // Easy: More time, Medium: Moderate time, Hard: Less time
    const baseTime = score < 5 ? 40 : score < 15 ? 30 : 20;
    const retraceTime = Math.max(15, baseTime - Math.floor(score / 3));
    setTimeLeft(retraceTime);
    
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - wrong answer
          onWrong();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [score, onWrong]);

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
    if (gameState === 'showing' && currentPoint < trail.length) {
      timeoutRef.current = setTimeout(() => {
        setCurrentPoint(prev => prev + 1);
      }, showTime / trail.length);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else if (gameState === 'showing' && currentPoint >= trail.length) {
      timeoutRef.current = setTimeout(() => {
        setGameState('retracing');
        startCountdown();
      }, 1000); // Longer pause to let user process
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [gameState, currentPoint, trail.length, showTime, startCountdown]);

  useEffect(() => {
    if (gameStarted) {
      startNewRound();
    } else {
      // Reset state when game is not started
      cleanup();
      setGameState('showing');
      setTrail([]);
      setUserTrail([]);
      setWrongClicks([]);
      setCurrentPoint(0);
      setTimeLeft(0);
      setAttempts(0);
    }
  }, [gameStarted, startNewRound, cleanup]);

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
              Watch the trail... ({Math.round(showTime / 1000)}s)
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

        {gameState === 'retracing' && (
          <motion.div
            key="retracing"
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
              Retrace the trail from memory!
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

      {/* Difficulty Display */}
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Difficulty: <span className="text-yellow-400 font-bold">{getDifficultyLevel()}</span> | 
          Grid: {gridSize}x{gridSize} | Trail: {trailLength} points
        </p>
      </div>

      {/* Timer for retracing phase */}
      {gameState === 'retracing' && (
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-lg font-bold text-yellow-400">{timeLeft}s</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / 40) * 100}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex justify-center mb-8">
        <div 
          className="grid gap-1 border-2 border-gray-600 p-2 rounded-lg"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            width: `${gridSize * 50}px`,
            height: `${gridSize * 50}px`
          }}
        >
          {Array.from({ length: gridSize * gridSize }, (_, i) => {
            const x = i % gridSize;
            const y = Math.floor(i / gridSize);
            const isTrailPoint = trail.some((point, index) => 
              point.x === x && point.y === y && index < currentPoint
            );
            const isUserPoint = userTrail.some(point => point.x === x && point.y === y);
            const isWrongClick = wrongClicks.some(point => point.x === x && point.y === y);

            return (
              <motion.div
                key={i}
                className={`w-10 h-10 rounded border cursor-pointer transition-all duration-200 ${
                  gameState === 'showing' && isTrailPoint
                    ? 'bg-gradient-to-r from-indigo-400 to-purple-400 border-indigo-300'
                    : gameState === 'retracing' && isUserPoint
                    ? 'bg-gradient-to-r from-green-400 to-emerald-400 border-green-300'
                    : gameState === 'retracing' && isWrongClick
                    ? 'bg-gradient-to-r from-red-400 to-pink-400 border-red-300'
                    : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                }`}
                whileHover={gameState === 'retracing' ? { scale: 1.1 } : {}}
                whileTap={gameState === 'retracing' ? { scale: 0.9 } : {}}
                onClick={() => handleGridClick(x, y)}
                animate={
                  gameState === 'showing' && isTrailPoint ? {
                    scale: [1, 1.2, 1],
                    boxShadow: ['0 0 10px #FFDC00', '0 0 20px #FFDC00', '0 0 10px #FFDC00']
                  } : gameState === 'retracing' && isWrongClick && showWrongFeedback ? {
                    scale: [1, 1.3, 1],
                    boxShadow: ['0 0 10px #FF4136', '0 0 20px #FF4136', '0 0 10px #FF4136']
                  } : {}
                }
                transition={{ duration: 0.3 }}
              />
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      {gameState === 'retracing' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center gap-4"
        >
          <Button
            onClick={resetTrail}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Trail
          </Button>
        </motion.div>
      )}

      {/* Progress */}
      {gameState === 'showing' && (
        <div className="mb-4">
          <p className="text-sm text-gray-400">
            Progress: {currentPoint}/{trail.length}
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <motion.div
              className="bg-gradient-to-r from-indigo-400 to-purple-400 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentPoint / trail.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* User Progress */}
      {gameState === 'retracing' && (
        <div className="mb-4">
          <p className="text-sm text-gray-400">
            Your Progress: {userTrail.length}/{trail.length} | Attempts: {attempts}/{maxAttempts}
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <motion.div
              className="bg-gradient-to-r from-green-400 to-emerald-400 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(userTrail.length / trail.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Wrong Click Feedback */}
      {showWrongFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg"
        >
          <div className="flex items-center justify-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Wrong cell! Attempt {attempts}/{maxAttempts}</span>
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        {gameState === 'showing' && (
          <p>Watch the moving trail carefully - you'll need to retrace it from memory!</p>
        )}
        {gameState === 'retracing' && (
          <p>Click the cells to retrace the trail from memory. No hints given!</p>
        )}
      </div>
    </div>
  );
};

export default TrailTracker; 