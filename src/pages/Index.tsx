
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Brain, Trophy, Users, Zap, Star, Eye, RotateCcw, Target, MousePointer, Palette, Type, Quote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import AuthButton from "@/components/AuthButton";

const GAME_MODES: Record<string, { name: string; icon: LucideIcon; color: string }> = {
  classic: { name: 'Classic Memory', icon: Brain, color: 'from-cyan-400 to-blue-400' },
  'freeze-frame': { name: 'Freeze Frame', icon: Eye, color: 'from-purple-400 to-pink-400' },
  'reverse-sequence': { name: 'Reverse Sequence', icon: RotateCcw, color: 'from-orange-400 to-red-400' },
  'quick-reflex': { name: 'Quick Reflex', icon: Target, color: 'from-green-400 to-emerald-400' },
  'trail-tracker': { name: 'Trail Tracker', icon: MousePointer, color: 'from-indigo-400 to-purple-400' },
  'palette-recall': { name: 'Palette Recall', icon: Palette, color: 'from-yellow-400 to-orange-400' },
  'speed-typist': { name: 'Speed Typist', icon: Type, color: 'from-teal-400 to-cyan-400' },
};

type JoinedReview = {
  id: string;
  game_mode: string;
  rating: number;
  review: string | null;
  created_at: string;
  profiles: { username: string | null } | null;
};

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

  // Simple site-wide metrics
  const [metrics, setMetrics] = useState({
    users: 0,
    games: 0,
    topScore: 0,
    games24h: 0,
    modes: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [avgRatingsByMode, setAvgRatingsByMode] = useState<Record<string, number>>({});
  const [ratingCountsByMode, setRatingCountsByMode] = useState<Record<string, number>>({});
  const [recentReviews, setRecentReviews] = useState<Array<{ id: string; game_mode: string; rating: number; review: string | null; created_at: string; username: string | null }>>([]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [usersCount, gamesCount, topScoreRes, games24hRes, modesRes, ratingsRes, recentReviewsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('game_scores').select('id', { count: 'exact', head: true }),
          supabase.from('game_scores').select('score').order('score', { ascending: false }).limit(1),
          supabase.from('game_scores').select('id').gte('created_at', sinceIso),
          supabase.from('game_scores').select('game_mode'),
          supabase.from('game_reviews').select('game_mode, rating'),
          supabase.from('game_reviews').select(`id, game_mode, rating, review, created_at, user_id, profiles!game_reviews_user_id_fkey (username)`).order('created_at', { ascending: false }).limit(10),
        ]);

        const users = usersCount.count ?? 0;
        const games = gamesCount.count ?? 0;
        const topScore = topScoreRes.data && topScoreRes.data.length > 0 ? topScoreRes.data[0].score as number : 0;
        const games24h = games24hRes.data ? games24hRes.data.length : 0;
        const modes = modesRes.data ? new Set((modesRes.data as Array<{ game_mode: string }>).map(d => d.game_mode)).size : 0;

        setMetrics({ users, games, topScore, games24h, modes });

        // Aggregate ratings per mode
        const ratings = (ratingsRes.data || []) as Array<{ game_mode: string; rating: number }>;
        const sums: Record<string, { total: number; count: number }> = {};
        ratings.forEach((r) => {
          if (!sums[r.game_mode]) sums[r.game_mode] = { total: 0, count: 0 };
          sums[r.game_mode].total += r.rating;
          sums[r.game_mode].count += 1;
        });
        const avgs: Record<string, number> = {};
        const counts: Record<string, number> = {};
        Object.keys(GAME_MODES).forEach((mode) => {
          if (sums[mode]) {
            avgs[mode] = Math.round((sums[mode].total / Math.max(1, sums[mode].count)) * 10) / 10;
            counts[mode] = sums[mode].count;
          } else {
            avgs[mode] = 0;
            counts[mode] = 0;
          }
        });
        setAvgRatingsByMode(avgs);
        setRatingCountsByMode(counts);

        // Recent reviews list
        const recent = ((recentReviewsRes.data || []) as JoinedReview[]).map((r) => ({
          id: r.id,
          game_mode: r.game_mode,
          rating: r.rating,
          review: r.review || null,
          created_at: r.created_at,
          username: r.profiles?.username ?? null,
        }));
        setRecentReviews(recent);
      } catch (e) {
        console.error('Failed to load site metrics', e);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Auto-advance reviews carousel
  useEffect(() => {
    if (!carouselApi || recentReviews.length <= 1) return;
    const id = setInterval(() => {
      try {
        carouselApi.scrollNext();
      } catch (err) {
        // ignore
      }
    }, 3500);
    return () => clearInterval(id);
  }, [carouselApi, recentReviews.length]);

  const renderStars = (value: number) => {
    const stars = [1,2,3,4,5];
    return (
      <div className="flex items-center gap-1">
        {stars.map((s) => (
          <Star key={s} className={value >= s ? 'text-yellow-400 fill-yellow-400 w-4 h-4' : 'text-gray-500 w-4 h-4'} />
        ))}
      </div>
    );
  };

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
          Seven different memory games to challenge your brain. One mistake resets everything. 
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

        {/* Top Rated Games */}
        {/* Animated Reviews Carousel */}
        <motion.div variants={itemVariants} className="mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Quote className="w-5 h-5 text-pink-300" />
            <h3 className="text-xl font-bold">What players say</h3>
          </div>
          {recentReviews.length === 0 ? (
            <div className="text-center text-gray-400">No reviews yet. Be the first to rate a game!</div>
          ) : (
            <div className="max-w-4xl mx-auto relative">
              <Carousel opts={{ loop: true, align: 'start' }} setApi={setCarouselApi}>
                <CarouselContent>
                  {recentReviews.map((r) => {
                    const mode = GAME_MODES[r.game_mode] || { name: r.game_mode, icon: Brain, color: 'from-gray-400 to-gray-600' };
                    const ModeIcon = mode.icon;
                    const timeAgo = formatDistanceToNow(new Date(r.created_at), { addSuffix: true });
                    const displayName = r.username || 'Anonymous';
                    const initial = displayName.charAt(0).toUpperCase();
                    return (
                      <CarouselItem key={r.id} className="md:basis-1/2 lg:basis-1/3">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          className="relative h-full p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden hover:shadow-xl hover:shadow-pink-400/10 transition-shadow"
                        >
                          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />
                          <Quote className="absolute -bottom-4 -right-2 w-24 h-24 text-white/5" />
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-md bg-gradient-to-r ${mode.color}`}>
                                <ModeIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-sm text-gray-300">{mode.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {renderStars(r.rating)}
                              <span className="text-xs text-yellow-300">{r.rating}★</span>
                            </div>
                          </div>
                          {r.review ? (
                            <div className="text-sm text-gray-200 line-clamp-4 leading-relaxed">“{r.review}”</div>
                          ) : (
                            <div className="text-sm text-gray-400 italic">No review message</div>
                          )}
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-gray-300">
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-gray-200 border border-white/10">
                                {initial}
                              </div>
                              <span>by {displayName}</span>
                            </div>
                            <span className="text-gray-500">{timeAgo}</span>
                          </div>
                        </motion.div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="border-white/20 text-white/80 hover:text-white hover:bg-white/10" />
                <CarouselNext className="border-white/20 text-white/80 hover:text-white hover:bg-white/10" />
              </Carousel>
            </div>
          )}
        </motion.div>

        {/* Live Stats */}
        <motion.div
          variants={containerVariants}
          className="grid md:grid-cols-5 gap-4 max-w-6xl mx-auto mb-12"
        >
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Users className="w-8 h-8 mx-auto mb-2 text-purple-300" />
            <div className="text-3xl font-extrabold">{statsLoading ? '—' : metrics.users.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Registered Users</div>
          </motion.div>
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
            <div className="text-3xl font-extrabold">{statsLoading ? '—' : metrics.games.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Games Played</div>
          </motion.div>
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Zap className="w-8 h-8 mx-auto mb-2 text-cyan-300" />
            <div className="text-3xl font-extrabold">{statsLoading ? '—' : metrics.games24h.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Games in Last 24h</div>
          </motion.div>
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Brain className="w-8 h-8 mx-auto mb-2 text-pink-300" />
            <div className="text-3xl font-extrabold">{statsLoading ? '—' : metrics.modes}</div>
            <div className="text-gray-400 text-sm">Game Modes</div>
          </motion.div>
          <motion.div variants={itemVariants} className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
            <div className="text-3xl font-extrabold">{statsLoading ? '—' : metrics.topScore}</div>
            <div className="text-gray-400 text-sm">All-time High Score</div>
          </motion.div>
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
