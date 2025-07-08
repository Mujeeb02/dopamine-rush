import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Target, TrendingUp, Zap, Calendar, User, Star } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
    created_at: string;
  }>;
}

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string;
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    highScore: 0,
    totalGames: 0,
    averageScore: 0,
    totalStreak: 0,
    recentScores: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('User not found');
        return;
      }

      setUserProfile(profile);

      // Fetch user's game scores
      const { data: scores, error: scoresError } = await supabase
        .from('game_scores')
        .select('score, streak, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        setError('Failed to load user stats');
        return;
      }

      if (scores && scores.length > 0) {
        const scoreValues = scores.map(item => item.score);
        const streakValues = scores.map(item => item.streak);
        
        setUserStats({
          highScore: Math.max(...scoreValues),
          totalGames: scores.length,
          averageScore: Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10) / 10,
          totalStreak: streakValues.reduce((a, b) => a + b, 0),
          recentScores: scores.slice(0, 5)
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () => {
    if (!userProfile) return 'Unknown Player';
    if (userProfile.username && userProfile.username !== 'Anonymous') {
      return userProfile.username;
    }
    if (userProfile.email && userProfile.email !== 'Unknown') {
      return userProfile.email.split('@')[0];
    }
    return 'Anonymous Player';
  };

  const isOwnProfile = currentUser?.id === userId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="flex justify-between items-center p-6">
          <Button 
            onClick={() => navigate(-1)} 
            variant="ghost" 
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="container mx-auto px-6 py-8 flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">User Not Found</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => navigate('/leaderboard')}>
              Back to Leaderboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <Button 
          onClick={() => navigate(-1)} 
          variant="ghost" 
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Player Profile
        </h1>

        <div className="w-20" />
      </div>

      <div className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20"
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <User className="w-8 h-8 text-cyan-400" />
                <h2 className="text-3xl font-bold text-white">
                  {getDisplayName()}
                </h2>
                {userProfile?.username && userProfile.username !== 'Anonymous' && (
                  <Star className="w-6 h-6 text-yellow-400" />
                )}
              </div>
              {isOwnProfile && (
                <p className="text-cyan-400 text-sm mb-2">Your Profile</p>
              )}
              <p className="text-gray-400 text-sm">
                Member since {new Date(userProfile?.created_at || '').toLocaleDateString()}
              </p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
            >
              <Trophy className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
              <div className="text-3xl font-bold text-yellow-400 mb-1">{userStats.highScore}</div>
              <div className="text-sm text-gray-400">High Score</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
            >
              <Target className="w-8 h-8 mx-auto mb-3 text-cyan-400" />
              <div className="text-3xl font-bold text-cyan-400 mb-1">{userStats.totalGames}</div>
              <div className="text-sm text-gray-400">Games Played</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
            >
              <TrendingUp className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <div className="text-3xl font-bold text-green-400 mb-1">{userStats.averageScore}</div>
              <div className="text-sm text-gray-400">Average Score</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
            >
              <Zap className="w-8 h-8 mx-auto mb-3 text-purple-400" />
              <div className="text-3xl font-bold text-purple-400 mb-1">{userStats.totalStreak}</div>
              <div className="text-sm text-gray-400">Total Streaks</div>
            </motion.div>
          </motion.div>

          {/* Recent Games */}
          {userStats.recentScores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                Recent Games
              </h3>
              <div className="space-y-3">
                {userStats.recentScores.map((game, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-cyan-400">{game.score}</div>
                      <div className="text-sm text-gray-400">
                        Streak: {game.streak}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(game.created_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* No Games Message */}
          {userStats.totalGames === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center"
            >
              <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400">No games played yet</p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-8 space-y-4"
          >
            <Link to="/leaderboard">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Back to Leaderboard
              </Button>
            </Link>
            {isOwnProfile && (
              <Link to="/game">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full">
                  Play Game
                </Button>
              </Link>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default UserProfile; 