
import { motion } from "framer-motion";
import { Card, GameState } from "@/pages/Game";

interface GameGridProps {
  cards: Card[];
  gameState: GameState;
  onCardClick: (card: Card) => void;
}

const GameGrid = ({ cards, gameState, onCardClick }: GameGridProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      rotateY: -90
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      rotateY: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 20
      }
    }
  };

  const getGridCols = (cardCount: number) => {
    if (cardCount <= 4) return 'grid-cols-2';
    if (cardCount <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  // During question phase, show uniform gray color
  const getCardColor = (card: Card) => {
    if (gameState === 'question') {
      return '#4B5563'; // Gray color
    }
    return card.color;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`grid ${getGridCols(cards.length)} gap-4 max-w-lg mx-auto`}
    >
      {cards.map((card) => (
        <motion.div
          key={`${card.id}-${card.position}`}
          variants={cardVariants}
          className="aspect-square rounded-xl cursor-pointer relative overflow-hidden"
          style={{ backgroundColor: getCardColor(card) }}
          whileHover={gameState === 'question' ? { 
            scale: 1.05, 
            rotate: 2,
            boxShadow: `0 0 30px ${getCardColor(card)}80`
          } : {}}
          whileTap={gameState === 'question' ? { scale: 0.95 } : {}}
          onClick={() => onCardClick(card)}
          animate={gameState === 'showing' ? {
            boxShadow: [`0 0 0px ${card.color}00`, `0 0 30px ${card.color}80`, `0 0 0px ${card.color}00`]
          } : {}}
          transition={{
            boxShadow: { duration: 2, repeat: Infinity }
          }}
        >
          {gameState === 'showing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 360]
                }}
                transition={{ 
                  scale: { duration: 1, repeat: Infinity },
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" }
                }}
                className="w-8 h-8 bg-white/30 rounded-full"
              />
            </motion.div>
          )}
          
          {gameState === 'question' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default GameGrid;
