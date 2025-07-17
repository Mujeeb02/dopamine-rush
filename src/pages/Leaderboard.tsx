import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Trophy,
  Medal,
  Award,
  Crown,
  Search,
  User,
  Star,
  Brain,
  Eye,
  RotateCcw,
  Target,
  MousePointer,
  Palette,
  Type,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LeaderboardEntry {
  id: string;
  score: number;
  streak: number;
  game_mode: string;
  created_at: string;
  user_id: string;
  username: string;
  email: string;
  profiles?: {
    username: string | null;
    email: string | null;
  } | null;
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
  },
  'speed-typist': {
    name: 'Speed Typist',
    icon: Type,
    color: 'from-teal-400 to-cyan-400',
  }
};

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGameMode, setSelectedGameMode] = useState<string>("all");
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  // Filter leaderboard based on search term and game mode
  useEffect(() => {
    let filtered = leaderboard;
    
    // Filter by game mode
    if (selectedGameMode !== "all") {
      filtered = filtered.filter(entry => entry.game_mode === selectedGameMode);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (entry) =>
          entry.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredLeaderboard(filtered);
  }, [searchTerm, leaderboard, selectedGameMode]);

  const fetchLeaderboard = async () => {
    try {
      console.log("🔍 Fetching leaderboard data...");
      setLoading(true);

      // Get all scores with user profile information
      console.log("📊 Querying game_scores table...");
      
      // First, let's try a simpler approach - get all scores
      const { data: scoresData, error: scoresError } = await supabase
        .from("game_scores")
        .select("*")
        .order("score", { ascending: false });

      if (scoresError) {
        console.error("❌ Error fetching scores:", scoresError);
        throw scoresError;
      }

      console.log("✅ Raw scores data:", scoresData);
      console.log(`📈 Found ${scoresData?.length || 0} scores`);

      if (!scoresData || scoresData.length === 0) {
        console.log("⚠️ No scores found in database");
        setLeaderboard([]);
        setFilteredLeaderboard([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs from scores
      const userIds = [...new Set(scoresData.map(score => score.user_id))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("❌ Error fetching profiles:", profilesError);
        // Continue without profiles
      }

      // Create a map of user ID to profile
      const profileMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          profileMap.set(profile.id, profile);
        });
      }

      // Process the joined data - scores now include profile information
      const userBestScores = new Map();
      scoresData.forEach((score) => {
        const profile = profileMap.get(score.user_id); // Get profile from our map
        
        const key = `${score.user_id}-${score.game_mode}`;
        if (
          !userBestScores.has(key) ||
          userBestScores.get(key).score < score.score
        ) {
          userBestScores.set(key, {
            ...score,
            username: profile?.username || "Anonymous",
            email: profile?.email || "Unknown",
          });
        }
      });

      // Convert to array and sort by score
      const topScores = Array.from(userBestScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 50); // Show more scores since we have multiple game modes

      console.log("🏆 Processed leaderboard:", topScores);
      setLeaderboard(topScores);
      setFilteredLeaderboard(topScores);

      // Find current user's rank
      if (isAuthenticated && user) {
        const userEntry = topScores.findIndex(
          (entry) => entry.user_id === user.id
        );
        setUserRank(userEntry >= 0 ? userEntry + 1 : null);
        console.log("👑 User rank:", userEntry >= 0 ? userEntry + 1 : null);
      }
    } catch (error) {
      console.error("💥 Error fetching leaderboard:", error);
      // Set empty leaderboard on error
      setLeaderboard([]);
      setFilteredLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Trophy className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />;
      default:
        return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "from-yellow-500/20 to-yellow-600/20 border-yellow-400/30";
      case 2:
        return "from-gray-400/20 to-gray-500/20 border-gray-300/30";
      case 3:
        return "from-orange-400/20 to-orange-500/20 border-orange-400/30";
      default:
        return "from-white/5 to-white/10 border-white/10";
    }
  };

  const handleUserClick = (userId: string) => {
    // Navigate to user profile - works for both authenticated and non-authenticated users
    navigate(`/profile/${userId}`);
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (entry.username && entry.username !== "Anonymous") {
      return entry.username;
    }
    if (entry.email && entry.email !== "Unknown") {
      return entry.email.split("@")[0];
    }
    return "Anonymous Player";
  };

  const getGameModeInfo = (gameMode: string) => {
    return GAME_MODES[gameMode as keyof typeof GAME_MODES] || {
      name: 'Unknown Game',
      icon: Brain,
      color: 'from-gray-400 to-gray-600',
    };
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
          className="mb-8"
        >
          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedGameMode}
                onChange={(e) => setSelectedGameMode(e.target.value)}
                className="border border-white/20 text-white rounded-md px-3 py-2 bg-white/10 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <option value="all" style={{ background: 'rgba(17, 24, 39, 0.95)' }}>All Games</option>
                {Object.entries(GAME_MODES).map(([key, mode]) => (
                  <option key={key} value={key} style={{ background: 'rgba(17, 24, 39, 0.95)' }}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Rank Display */}
          {isAuthenticated && userRank && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-lg"
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-bold">Your Rank: #{userRank}</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading leaderboard...</p>
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No scores found</h3>
            <p className="text-gray-500">
              {selectedGameMode !== "all" 
                ? `No scores for ${getGameModeInfo(selectedGameMode).name} yet.`
                : "No scores have been recorded yet."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeaderboard.map((entry, index) => {
              const rank = index + 1;
              const gameModeInfo = getGameModeInfo(entry.game_mode);
              const GameModeIcon = gameModeInfo.icon;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border backdrop-blur-sm cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 ${getRankColor(rank)}`}
                  onClick={() => handleUserClick(entry.user_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getRankIcon(rank)}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-white hover:text-cyan-400 transition-colors duration-200 cursor-pointer">
                              {getDisplayName(entry)}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-gray-400 opacity-60" />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <GameModeIcon className="w-4 h-4" />
                            <span>{gameModeInfo.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-yellow-400">
                        {entry.score}
                      </div>
                      <div className="text-sm text-gray-400">
                        Streak: {entry.streak}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
