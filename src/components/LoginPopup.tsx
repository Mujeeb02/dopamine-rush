
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, X } from "lucide-react";
import { Link } from "react-router-dom";

interface LoginPopupProps {
  isOpen: boolean;
  onClose: () => void;
  score: number;
}

const LoginPopup = ({ isOpen, onClose, score }: LoginPopupProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-gradient-to-br from-gray-900 to-purple-900 border border-white/20 rounded-xl p-8 max-w-md w-full text-white relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-4"
              >
                🏆
              </motion.div>
              
              <h2 className="text-2xl font-bold mb-2">Great Score!</h2>
              <p className="text-gray-300 mb-6">
                You scored <span className="text-yellow-400 font-bold">{score}</span> points! 
                Sign in to save your score and compete with players worldwide.
              </p>

              <div className="space-y-3">
                <Link to="/auth" onClick={onClose}>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white w-full font-bold">
                    <Trophy className="w-4 h-4 mr-2" />
                    Sign In to Save Score
                  </Button>
                </Link>
                
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 w-full"
                >
                  Continue Without Saving
                </Button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Join thousands of players competing for the top spot!
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginPopup;
