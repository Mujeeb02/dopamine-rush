
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Medal, Award, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LeaderboardEntry {
  id: string;
  score: number;
  streak: number;
  created_at: string;
  user_id: string;
  username: string;
  email: string;
}

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      console.log('🔍 Fetching leaderboard data...');
      setLoading(true);

      // Get all scores with user profile information
      console.log('📊 Querying game_scores table...');
      const { data: scoresData, error: scoresError } = await supabase
        .from('game_scores')
        .select('*')
        .order('score', { ascending: false });

      if (scoresError) {
        console.error('❌ Error fetching scores:', scoresError);
        throw scoresError;
      }

      console.log('✅ Raw scores data:', scoresData);
      console.log(`📈 Found ${scoresData?.length || 0} scores`);

      if (!scoresData || scoresData.length === 0) {
        console.log('⚠️ No scores found in database');
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Get user profiles for all unique user IDs
      const userIds = [...new Set(scoresData.map(score => score.user_id))];
      console.log('👥 Unique user IDs:', userIds);
      
      console.log('📋 Querying profiles table...');
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('✅ Profiles data:', profilesData);
      console.log(`👤 Found ${profilesData?.length || 0} profiles`);

      // Create a map of user profiles for quick lookup
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Group scores by user and get their best score
      const userBestScores = new Map();
      scoresData.forEach(score => {
        const profile = profilesMap.get(score.user_id);
        if (!userBestScores.has(score.user_id) || userBestScores.get(score.user_id).score < score.score) {
          userBestScores.set(score.user_id, {
            ...score,
            username: profile?.username || 'Anonymous',
            email: profile?.email || 'Unknown'
          });
        }
      });

      // Convert to array and sort by score
      const topScores = Array.from(userBestScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      console.log('🏆 Processed leaderboard:', topScores);
      setLeaderboard(topScores);

      // Find current user's rank
      if (isAuthenticated && user) {
        const userEntry = topScores.findIndex(
          entry => entry.user_id === user.id
        );
        setUserRank(userEntry >= 0 ? userEntry + 1 : null);
        console.log('👑 User rank:', userEntry >= 0 ? userEntry + 1 : null);
      }
    } catch (error) {
      console.error('💥 Error fetching leaderboard:', error);
      // Set empty leaderboard on error
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2: return <Trophy className="w-6 h-6 text-gray-300" />;
      case 3: return <Medal className="w-6 h-6 text-orange-400" />;
      default: return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-500/20 to-yellow-600/20 border-yellow-400/30';
      case 2: return 'from-gray-400/20 to-gray-500/20 border-gray-300/30';
      case 3: return 'from-orange-400/20 to-orange-500/20 border-orange-400/30';
      default: return 'from-white/5 to-white/10 border-white/10';
    }
  };

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
          Global Leaderboard
        </h1>

        <div className="w-20" />
      </div>

      <div className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {userRank && isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-purple-400/30"
            >
              <div className="text-center">
                <p className="text-sm text-gray-300">Your Rank</p>
                <p className="text-2xl font-bold text-purple-400">#{userRank}</p>
              </div>
            </motion.div>
          )}

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading leaderboard...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-400">No scores yet. Be the first to play!</p>
              </div>
            ) : (
              leaderboard.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-lg bg-gradient-to-r ${getRankColor(index + 1)} border backdrop-blur-sm hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className="flex items-center gap-4">
                    {getRankIcon(index + 1)}
                    <div>
                      <h3 className="font-bold text-lg">
                        {player.username || player.email?.split('@')[0] || 'Anonymous Player'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Best Streak: {player.streak} • {new Date(player.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-400">{player.score}</div>
                    <div className="text-sm text-gray-400">points</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8 space-y-4"
          >
            {!isAuthenticated && (
              <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-4">
                <p className="text-yellow-300">
                  Sign in to save your scores and appear on the leaderboard!
                </p>
              </div>
            )}
            <p className="text-gray-400 mb-4">Ready to climb the ranks?</p>
            <Link to="/game">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-bold rounded-full">
                Play Now
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Leaderboard;
