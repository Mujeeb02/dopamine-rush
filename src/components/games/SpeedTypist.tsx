import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Type, Zap, Clock, CheckCircle, XCircle } from "lucide-react";

interface SpeedTypistProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

interface TypingWord {
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
}

const SpeedTypist = ({ score, onCorrect, onWrong, gameStarted }: SpeedTypistProps) => {
  const [gameState, setGameState] = useState<'waiting' | 'typing' | 'timeout'>('waiting');
  const [currentWord, setCurrentWord] = useState<TypingWord | null>(null);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [wpm, setWpm] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Word lists by difficulty
  const wordLists = {
    easy: [
      'hello', 'world', 'game', 'play', 'fun', 'fast', 'quick', 'smart', 'brain', 'test',
      'type', 'speed', 'skill', 'learn', 'think', 'react', 'focus', 'mind', 'sharp', 'alert'
    ],
    medium: [
      'challenge', 'adventure', 'excitement', 'brilliant', 'fantastic', 'wonderful', 'amazing',
      'incredible', 'beautiful', 'powerful', 'creative', 'energetic', 'confident', 'successful',
      'determined', 'passionate', 'inspired', 'motivated', 'focused', 'disciplined'
    ],
    hard: [
      'supercalifragilisticexpialidocious', 'pneumonoultramicroscopicsilicovolcanoconioses',
      'antidisestablishmentarianism', 'floccinaucinihilipilification', 'hippopotomonstrosesquippedaliophobia',
      'pseudopseudohypoparathyroidism', 'spectrophotofluorometrically', 'thyroparathyroidectomized',
      'dichlorodifluoromethane', 'psychoneuroendocrinological', 'electroencephalographically',
      'immunoelectrophoretically', 'psychophysicotherapeutics', 'thyroparathyroidectomized',
      'pneumoencephalographically', 'radioimmunoelectrophoresis', 'hepaticocholangiogastrostomy',
      'esophagogastroduodenoscopy', 'electrocardiographically', 'immunoelectrophoretically'
    ]
  };

  const generateWord = useCallback((level: number): TypingWord => {
    const difficulty = level < 5 ? 'easy' : level < 10 ? 'medium' : 'hard';
    const words = wordLists[difficulty];
    const randomWord = words[Math.floor(Math.random() * words.length)];
    
    // Calculate time limit based on word length and difficulty
    const baseTime = difficulty === 'easy' ? 5000 : difficulty === 'medium' ? 4000 : 3000;
    const timeLimit = Math.max(2000, baseTime - (level * 100));
    
    return {
      text: randomWord,
      difficulty,
      timeLimit
    };
  }, []);

  const startNewRound = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const newWord = generateWord(score);
    setCurrentWord(newWord);
    setUserInput('');
    setTimeLeft(newWord.timeLimit);
    setAccuracy(100);
    setWpm(0);
    setStartTime(null);
    setIsCorrect(null);
    setGameState('typing');

    // Focus the input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [score, generateWord]);

  const calculateAccuracy = (input: string, target: string): number => {
    if (target.length === 0) return 100;
    let correct = 0;
    const minLength = Math.min(input.length, target.length);
    
    for (let i = 0; i < minLength; i++) {
      if (input[i] === target[i]) correct++;
    }
    
    return Math.round((correct / target.length) * 100);
  };

  const calculateWPM = (input: string, timeElapsed: number): number => {
    if (timeElapsed === 0) return 0;
    const words = input.trim().split(/\s+/).length;
    const minutes = timeElapsed / 60000;
    return Math.round(words / minutes);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setUserInput(input);

    if (!startTime) {
      setStartTime(Date.now());
    }

    if (currentWord) {
      const newAccuracy = calculateAccuracy(input, currentWord.text);
      setAccuracy(newAccuracy);

      // Check if word is complete
      if (input === currentWord.text) {
        const timeElapsed = startTime ? Date.now() - startTime : 0;
        const newWpm = calculateWPM(input, timeElapsed);
        setWpm(newWpm);
        setIsCorrect(true);
        
        // Small delay to show success state
        setTimeout(() => {
          onCorrect();
        }, 500);
      } else if (input.length > currentWord.text.length) {
        // User typed too much
        setIsCorrect(false);
        setTimeout(() => {
          onWrong();
        }, 500);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentWord) {
      if (userInput === currentWord.text) {
        setIsCorrect(true);
        setTimeout(() => {
          onCorrect();
        }, 500);
      } else {
        setIsCorrect(false);
        setTimeout(() => {
          onWrong();
        }, 500);
      }
    }
  };

  // Timer countdown
  useEffect(() => {
    if (gameState === 'typing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 100) {
            setGameState('timeout');
            setTimeout(() => {
              onWrong();
            }, 500);
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [gameState, timeLeft, onWrong]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameStarted) {
      startNewRound();
    } else {
      // Reset state when game is not started
      cleanup();
      setGameState('waiting');
      setCurrentWord(null);
      setUserInput('');
      setTimeLeft(0);
      setAccuracy(100);
      setWpm(0);
      setStartTime(null);
      setIsCorrect(null);
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
        {gameState === 'typing' && currentWord && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-8"
          >
            <motion.h2
              animate={{ 
                scale: [1, 1.05, 1],
                color: ['#FFDC00', '#FF4136', '#FFDC00']
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-2xl font-bold mb-4"
            >
              Type the word quickly!
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              ⌨️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Word Display */}
      {currentWord && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
            <motion.div
              className={`text-4xl font-mono font-bold mb-4 ${
                isCorrect === true ? 'text-green-400' : 
                isCorrect === false ? 'text-red-400' : 'text-white'
              }`}
              animate={isCorrect !== null ? {
                scale: [1, 1.2, 1],
                rotate: isCorrect ? [0, 5, -5, 0] : [0, -5, 5, 0]
              } : {}}
              transition={{ duration: 0.3 }}
            >
              {currentWord.text}
            </motion.div>
            
            {/* Difficulty indicator */}
            <div className="flex justify-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                currentWord.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                currentWord.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {currentWord.difficulty.toUpperCase()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Input Field */}
      <div className="mb-8">
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full max-w-md px-6 py-4 text-2xl font-mono bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-all duration-200"
          placeholder="Start typing..."
          disabled={gameState !== 'typing'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 rounded-lg p-4"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-400">Time Left</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {(timeLeft / 1000).toFixed(1)}s
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <motion.div
              className="bg-cyan-400 h-2 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / (currentWord?.timeLimit || 1)) * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-lg p-4"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Accuracy</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {accuracy}%
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 rounded-lg p-4"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-400">WPM</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {wpm}
          </div>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-400">
        <p>Press Enter to submit or type the complete word</p>
      </div>
    </div>
  );
};

export default SpeedTypist; 