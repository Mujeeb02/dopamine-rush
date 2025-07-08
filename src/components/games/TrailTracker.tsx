import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MousePointer, RotateCcw, Check } from "lucide-react";

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

  const generateTrail = useCallback((level: number) => {
    const length = Math.min(5 + Math.floor(level / 3), 12);
    const size = Math.min(8 + Math.floor(level / 5), 12);
    const newTrail: Point[] = [];
    
    // Start from center
    let currentX = Math.floor(size / 2);
    let currentY = Math.floor(size / 2);
    newTrail.push({ x: currentX, y: currentY });

    for (let i = 1; i < length; i++) {
      // Generate next point with some randomness but keep it connected
      const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 },  // right
        { dx: -1, dy: -1 }, // up-left
        { dx: 1, dy: -1 },  // up-right
        { dx: -1, dy: 1 },  // down-left
        { dx: 1, dy: 1 }    // down-right
      ];

      const validDirections = directions.filter(dir => {
        const newX = currentX + dir.dx;
        const newY = currentY + dir.dy;
        return newX >= 0 && newX < size && newY >= 0 && newY < size;
      });

      if (validDirections.length > 0) {
        const direction = validDirections[Math.floor(Math.random() * validDirections.length)];
        currentX += direction.dx;
        currentY += direction.dy;
        newTrail.push({ x: currentX, y: currentY });
      }
    }

    return { trail: newTrail, size };
  }, []);

  const startNewRound = useCallback(() => {
    const { trail: newTrail, size } = generateTrail(score);
    setTrail(newTrail);
    setUserTrail([]);
    setCurrentPoint(0);
    setTrailLength(newTrail.length);
    setGridSize(size);
    setShowTime(Math.max(2000, 4000 - score * 100));
    setGameState('showing');
  }, [score, generateTrail]);

  const handleGridClick = (x: number, y: number) => {
    if (gameState !== 'retracing') return;

    const newPoint = { x, y };
    setUserTrail(prev => [...prev, newPoint]);

    // Check if trail is complete
    if (userTrail.length + 1 === trail.length) {
      const isCorrect = userTrail.every((point, index) => 
        point.x === trail[index].x && point.y === trail[index].y
      ) && newPoint.x === trail[trail.length - 1].x && newPoint.y === trail[trail.length - 1].y;

      if (isCorrect) {
        onCorrect();
      } else {
        onWrong();
      }
    }
  };

  const resetTrail = () => {
    setUserTrail([]);
  };

  useEffect(() => {
    if (gameState === 'showing' && currentPoint < trail.length) {
      const timer = setTimeout(() => {
        setCurrentPoint(prev => prev + 1);
      }, showTime / trail.length);
      
      return () => clearTimeout(timer);
    } else if (gameState === 'showing' && currentPoint >= trail.length) {
      setTimeout(() => {
        setGameState('retracing');
      }, 500);
    }
  }, [gameState, currentPoint, trail.length, showTime]);

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
              🎯
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
              Retrace the trail!
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              🖱️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            const isCurrentPoint = trail[currentPoint - 1]?.x === x && trail[currentPoint - 1]?.y === y;

            return (
              <motion.div
                key={i}
                className={`w-10 h-10 rounded border cursor-pointer transition-all duration-200 ${
                  gameState === 'showing' && isTrailPoint
                    ? 'bg-gradient-to-r from-indigo-400 to-purple-400 border-indigo-300'
                    : gameState === 'retracing' && isUserPoint
                    ? 'bg-gradient-to-r from-green-400 to-emerald-400 border-green-300'
                    : gameState === 'showing' && isCurrentPoint
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-400 border-yellow-300'
                    : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                }`}
                whileHover={gameState === 'retracing' ? { scale: 1.1 } : {}}
                whileTap={gameState === 'retracing' ? { scale: 0.9 } : {}}
                onClick={() => handleGridClick(x, y)}
                animate={gameState === 'showing' && isCurrentPoint ? {
                  scale: [1, 1.2, 1],
                  boxShadow: ['0 0 10px #FFDC00', '0 0 20px #FFDC00', '0 0 10px #FFDC00']
                } : {}}
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

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        {gameState === 'showing' && (
          <p>Watch the moving trail carefully - you'll need to retrace it!</p>
        )}
        {gameState === 'retracing' && (
          <p>Click the cells to retrace the trail you saw</p>
        )}
      </div>
    </div>
  );
};

export default TrailTracker; 