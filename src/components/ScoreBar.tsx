
import { motion } from "framer-motion";
import { Trophy, Zap, Target } from "lucide-react";

interface ScoreBarProps {
  score: number;
  highScore: number;
  streak: number;
}

const ScoreBar = ({ score, highScore, streak }: ScoreBarProps) => {
  return (
    <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-6 py-4">
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {/* Current Score */}
          <motion.div 
            className="text-center"
            animate={score > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-400">Score</span>
            </div>
            <motion.div 
              className="text-2xl font-bold text-cyan-400"
              animate={{ 
                textShadow: score > 0 ? [
                  "0 0 5px #7FDBFF40",
                  "0 0 20px #7FDBFF80",
                  "0 0 5px #7FDBFF40"
                ] : []
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {score}
            </motion.div>
          </motion.div>

          {/* High Score */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Best</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {highScore}
            </div>
          </div>

          {/* Streak */}
          <motion.div 
            className="text-center"
            animate={streak > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Streak</span>
            </div>
            <motion.div 
              className="text-2xl font-bold text-purple-400"
              animate={streak > 2 ? {
                textShadow: [
                  "0 0 5px #B10DC940",
                  "0 0 25px #B10DC980",
                  "0 0 5px #B10DC940"
                ]
              } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {streak}
              {streak > 4 && (
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="ml-1"
                >
                  🔥
                </motion.span>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBar;
