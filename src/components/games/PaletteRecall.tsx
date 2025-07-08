import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Palette, Eye, Check } from "lucide-react";

interface PaletteRecallProps {
  score: number;
  onCorrect: () => void;
  onWrong: () => void;
  gameStarted: boolean;
}

const PaletteRecall = ({ score, onCorrect, onWrong, gameStarted }: PaletteRecallProps) => {
  const [gameState, setGameState] = useState<'showing' | 'question' | 'checking'>('showing');
  const [palette, setPalette] = useState<string[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [showTime, setShowTime] = useState(5000);
  const [paletteSize, setPaletteSize] = useState(6);

  const generatePalette = useCallback((level: number) => {
    const size = Math.min(6 + Math.floor(level / 3), 10);
    const baseHue = Math.floor(Math.random() * 360);
    const newPalette: string[] = [];
    
    for (let i = 0; i < size; i++) {
      // Generate colors with subtle variations
      const hue = (baseHue + i * 30) % 360;
      const saturation = 60 + Math.random() * 20;
      const lightness = 40 + Math.random() * 20;
      newPalette.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return newPalette;
  }, []);

  const generateOptions = useCallback((targetColor: string, palette: string[]) => {
    const options = [targetColor];
    
    // Generate 3 similar but different colors
    const targetHSL = targetColor.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
    if (targetHSL) {
      const [_, h, s, l] = targetHSL;
      const baseHue = parseInt(h);
      const baseSaturation = parseInt(s);
      const baseLightness = parseInt(l);
      
      for (let i = 0; i < 3; i++) {
        const hue = (baseHue + (i + 1) * 15) % 360;
        const saturation = Math.max(20, Math.min(100, baseSaturation + (Math.random() - 0.5) * 20));
        const lightness = Math.max(20, Math.min(80, baseLightness + (Math.random() - 0.5) * 20));
        options.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
    }
    
    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }, []);

  const startNewRound = useCallback(() => {
    const newPalette = generatePalette(score);
    setPalette(newPalette);
    setPaletteSize(newPalette.length);
    setShowTime(Math.max(3000, 6000 - score * 100));
    setGameState('showing');
    
    // Set target and question indices
    const targetIdx = Math.floor(Math.random() * newPalette.length);
    const questionIdx = Math.floor(Math.random() * newPalette.length);
    setTargetIndex(targetIdx);
    setQuestionIndex(questionIdx);
  }, [score, generatePalette]);

  const handleOptionClick = (selectedColor: string) => {
    const correctColor = palette[questionIndex];
    const isCorrect = selectedColor === correctColor;
    
    if (isCorrect) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  useEffect(() => {
    if (gameState === 'showing') {
      const timer = setTimeout(() => {
        const correctColor = palette[questionIndex];
        const newOptions = generateOptions(correctColor, palette);
        setOptions(newOptions);
        setGameState('question');
      }, showTime);
      
      return () => clearTimeout(timer);
    }
  }, [gameState, showTime, palette, questionIndex, generateOptions]);

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
              Which color was at position {questionIndex + 1}?
            </motion.h2>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl mb-4"
            >
              👁️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Palette Display */}
      {gameState === 'showing' && (
        <div className="mb-8">
          <div className="flex justify-center gap-2 mb-4">
            {palette.map((color, index) => (
              <motion.div
                key={index}
                className={`w-16 h-16 rounded-lg border-2 transition-all duration-200 ${
                  index === questionIndex ? 'border-white scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                animate={index === questionIndex ? {
                  scale: [1, 1.2, 1],
                  boxShadow: ['0 0 10px rgba(255, 255, 255, 0.4)', '0 0 20px rgba(255, 255, 255, 0.6)', '0 0 10px rgba(255, 255, 255, 0.4)']
                } : {}}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-center h-full text-white font-bold text-sm">
                  {index + 1}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-gray-400">
            Remember the color at position {questionIndex + 1} (highlighted)
          </p>
        </div>
      )}

      {/* Options Display */}
      {gameState === 'question' && (
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {options.map((color, index) => (
              <motion.button
                key={index}
                className="w-20 h-20 rounded-lg border-2 border-white hover:border-gray-300 transition-all duration-200"
                style={{ backgroundColor: color }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleOptionClick(color)}
              />
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Click the color that was at position {questionIndex + 1}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-400 mt-4">
        {gameState === 'showing' && (
          <p>Study the color palette carefully - you'll need to identify specific colors!</p>
        )}
        {gameState === 'question' && (
          <p>Click the color that was at the highlighted position</p>
        )}
      </div>
    </div>
  );
};

export default PaletteRecall; 