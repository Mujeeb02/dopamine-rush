
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Brain, Trophy, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import AuthButton from "@/components/AuthButton";

const Index = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6 }
    }
  };

  const colors = ['#7FDBFF', '#FFDC00', '#FF4136', '#B10DC9', '#2ECC40'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {colors.map((color, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-20 blur-xl"
            style={{
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              width: Math.random() * 400 + 200,
              height: Math.random() * 400 + 200,
            }}
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 p-6 flex justify-between items-center">
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
        >
          Dopamine Rush+
        </motion.div>
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex gap-4 items-center"
        >
          <Link to="/leaderboard">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              Profile
            </Button>
          </Link>
          <AuthButton />
        </motion.div>
      </nav>

      {/* Hero Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 container mx-auto px-6 py-12 text-center"
      >
        <motion.div variants={itemVariants} className="mb-6">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-sm">
            🧠 Ultimate Brain Challenge
          </Badge>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          style={{ fontFamily: 'Orbitron, monospace' }}
        >
          DOPAMINE
          <br />
          RUSH+
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-xl md:text-2xl mb-8 text-gray-300 max-w-2xl mx-auto"
        >
          Six different memory games to challenge your brain. One mistake resets everything. 
          Can you handle the pressure?
        </motion.p>

        <motion.div variants={itemVariants} className="mb-12">
          <Link to="/game">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-xl font-bold rounded-full shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <Play className="w-6 h-6 mr-2" />
              START PLAYING
            </Button>
          </Link>
        </motion.div>

        {/* Game Preview Cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto mb-12"
        >
          {colors.slice(0, 4).map((color, i) => (
            <motion.div
              key={i}
              className="aspect-square rounded-xl shadow-lg cursor-pointer"
              style={{ backgroundColor: color }}
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [`0 0 20px ${color}40`, `0 0 40px ${color}60`, `0 0 20px ${color}40`]
              }}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity }
              }}
            />
          ))}
        </motion.div>

        {/* Features */}
        <motion.div
          variants={containerVariants}
          className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm">
            <Brain className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
            <h3 className="text-xl font-bold mb-2">Memory Challenge</h3>
            <p className="text-gray-400">Six different games to test various memory skills</p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm">
            <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h3 className="text-xl font-bold mb-2">Instant Reset</h3>
            <p className="text-gray-400">One mistake and you're back to zero. No mercy.</p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm">
            <Users className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <h3 className="text-xl font-bold mb-2">Global Competition</h3>
            <p className="text-gray-400">Compete with players worldwide for the top spot</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
