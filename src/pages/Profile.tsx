
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Trophy, Target, Zap, Calendar, TrendingUp, Brain, Eye, RotateCcw, MousePointer, Palette } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserStats {
  highScore: number;
  totalGames: number;
  averageScore: number;
  totalStreak: number;
  recentScores: Array<{
    score: number;
    streak: number;
    game_mode: string;
    created_at: string;
  }>;
  gameModeStats: {
    [key: string]: {
      highScore: number;
      totalGames: number;
      averageScore: number;
    };
  };
}

const GAME_MODES = {
  classic: {
    name: 'Classic Memory',
    icon: Brain,
    color: 'from-cyan-400 to-blue-400',
  },
  'freeze-frame': {
    name: 'Freeze Frame',
    icon: Eye,
    color: 'from-purple-400 to-pink-400',
  },
  'reverse-sequence': {
    name: 'Reverse Sequence',
    icon: RotateCcw,
    color: 'from-orange-400 to-red-400',
  },
  'quick-reflex': {
    name: 'Quick Reflex',
    icon: Target,
    color: 'from-green-400 to-emerald-400',
  },
  'trail-tracker': {
    name: 'Trail Tracker',
    icon: MousePointer,
    color: 'from-indigo-400 to-purple-400',
  },
  'palette-recall': {
    name: 'Palette Recall',
    icon: Palette,
    color: 'from-yellow-400 to-orange-400',
  }
};

const Profile = () => {
  const [userStats, setUserStats] = useState<UserStats>({
    highScore: 0,
    totalGames: 0,
    averageScore: 0,
    totalStreak: 0,
    recentScores: [],
    gameModeStats: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    if (user?.id) {
      fetchUserStats();
    }
  }, [isAuthenticated, user?.id, navigate, authLoading]);

  const fetchUserStats = async () => {
    if (!user?.id) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching stats for user:', user.id);
      setError(null);
      
      // First, ensure user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile check error:', profileError);
        throw profileError;
      }

      if (!profile) {
        // Profile doesn't exist, create it
        console.log('Creating profile for user:', user.id);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            username: user.user_metadata?.username || user.email?.split('@')[0]
          });
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
      }

      // Fetch user's game scores
      const { data: scores, error: scoresError } = await supabase
        .from('game_scores')
        .select('score, streak, game_mode, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        throw scoresError;
      }

      console.log('Fetched scores:', scores);

      if (scores && scores.length > 0) {
        const scoreValues = scores.map(item => item.score);
        const streakValues = scores.map(item => item.streak);
        
        // Calculate game mode statistics
        const gameModeStats: { [key: string]: { highScore: number; totalGames: number; averageScore: number } } = {};
        
        scores.forEach(score => {
          const mode = score.game_mode || 'classic';
          if (!gameModeStats[mode]) {
            gameModeStats[mode] = { highScore: 0, totalGames: 0, averageScore: 0 };
          }
          
          gameModeStats[mode].totalGames += 1;
          gameModeStats[mode].highScore = Math.max(gameModeStats[mode].highScore, score.score);
        });
        
        // Calculate average scores for each game mode
        Object.keys(gameModeStats).forEach(mode => {
          const modeScores = scores.filter(s => (s.game_mode || 'classic') === mode).map(s => s.score);
          gameModeStats[mode].averageScore = Math.round((modeScores.reduce((a, b) => a + b, 0) / modeScores.length) * 10) / 10;
        });
        
        setUserStats({
          highScore: Math.max(...scoreValues),
          totalGames: scores.length,
          averageScore: Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10) / 10,
          totalStreak: streakValues.reduce((a, b) => a + b, 0),
          recentScores: scores.slice(0, 5),
          gameModeStats
        });
      } else {
        console.log('No scores found for user');
        setUserStats({
          highScore: 0,
          totalGames: 0,
          averageScore: 0,
          totalStreak: 0,
          recentScores: [],
          gameModeStats: {}
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setError(error.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const getGameModeInfo = (gameMode: string) => {
    return GAME_MODES[gameMode as keyof typeof GAME_MODES] || {
      name: 'Unknown Game',
      icon: Brain,
      color: 'from-gray-400 to-gray-600',
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <Link to="/">
          <Button variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Profile
        </h1>

        <Button onClick={signOut} variant="outline" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full w-full md:w-auto">
          Sign Out
        </Button>
      </div>

      <div className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Profile Header */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-purple-400 rounded-full mx-auto mb-4 flex items-center justify-center"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-2">
              {user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player'}
            </h2>
            <p className="text-gray-400">{user?.email}</p>
            <p className="text-gray-500 text-sm">
              Member since {new Date(user?.created_at || '').toLocaleDateString()}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <Button 
                onClick={fetchUserStats} 
                className="mt-2 bg-red-600 hover:bg-red-700"
                size="sm"
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading stats...</p>
            </div>
          ) : (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                  <h3 className="text-2xl font-bold text-yellow-400">{userStats.highScore}</h3>
                  <p className="text-gray-400 text-sm">High Score</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <Target className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                  <h3 className="text-2xl font-bold text-cyan-400">{userStats.totalGames}</h3>
                  <p className="text-gray-400 text-sm">Total Games</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <h3 className="text-2xl font-bold text-green-400">{userStats.averageScore}</h3>
                  <p className="text-gray-400 text-sm">Average Score</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <Zap className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-400">{userStats.totalStreak}</h3>
                  <p className="text-gray-400 text-sm">Total Streak</p>
                </motion.div>
              </div>

              {/* Game Mode Stats */}
              {Object.keys(userStats.gameModeStats).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-cyan-400" />
                    Game Mode Statistics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(userStats.gameModeStats).map(([mode, stats]) => {
                      const gameModeInfo = getGameModeInfo(mode);
                      const GameModeIcon = gameModeInfo.icon;
                      
                      return (
                        <div key={mode} className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <GameModeIcon className="w-5 h-5" />
                            <h4 className="font-bold">{gameModeInfo.name}</h4>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">High Score:</span>
                              <span className="text-yellow-400 font-bold">{stats.highScore}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Games Played:</span>
                              <span className="text-cyan-400 font-bold">{stats.totalGames}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Average:</span>
                              <span className="text-green-400 font-bold">{stats.averageScore}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recent Games */}
              {userStats.recentScores.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    Recent Games
                  </h3>
                  <div className="space-y-3">
                    {userStats.recentScores.map((game, index) => {
                      const gameModeInfo = getGameModeInfo(game.game_mode || 'classic');
                      const GameModeIcon = gameModeInfo.icon;
                      
                      return (
                        <div key={index} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-cyan-400">{game.score}</div>
                            <div className="flex items-center gap-2">
                              <GameModeIcon className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-400">
                                {gameModeInfo.name}
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">
                              Streak: {game.streak}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(game.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* No Games Message */}
              {userStats.totalGames === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
                >
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-400 mb-2">No games played yet</h3>
                  <p className="text-gray-500 mb-4">Start playing to see your statistics here!</p>
                  <Link to="/">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 font-bold rounded-full">
                      Start Playing
                    </Button>
                  </Link>
                </motion.div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center space-y-4"
          >
            <Link to="/game">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full w-full md:w-auto">
                Continue Playing
              </Button>
            </Link>
            <div className="flex gap-4 justify-center">
              <Link to="/leaderboard">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full w-full md:w-auto">
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
