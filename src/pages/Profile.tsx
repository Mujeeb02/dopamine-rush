import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { PageIntro, Loading, ErrorState, Empty } from '@/components/platform/Platform';
import PlayerOverview from '@/components/platform/PlayerOverview';
import { practiceHistory } from '@/lib/practice';
import { gameById } from '@/lib/games';
export default function Profile(){const {user,loading}=useAuth();const player=usePlayer();const location=useLocation();const history=practiceHistory();return <div className="page">{loading?<Loading/>:!user?<><PageIntro eyebrow="YOUR PROGRESS" title="Give your focus a home." description="Keep personal records, earn XP, and turn a few good runs into a daily rhythm."/><div className="guest-progress"><Empty title="Your next chapter starts here." detail="Create a free account to keep scored runs and progress across devices." action={<Link to="/auth" className="button">Sign in or join<ArrowUpRight size={17}/></Link>}/></div>{history.length>0&&<section className="section-space"><h2>Practice on this device</h2><div className="session-list">{history.slice(0,5).map(r=><div className="session-row" key={r.id}><div><strong>{gameById(r.game_mode)?.name}</strong><small>{new Date(r.created_at).toLocaleDateString()}</small></div><strong>{r.score} rounds</strong><span className="tiny muted">Practice</span></div>)}</div></section>}</>:player.isPending?<Loading/>:player.error?<ErrorState message={player.error.message} onRetry={()=>void player.refetch()}/>:player.data?<PlayerOverview player={player.data} own dashboard={location.pathname!=='/profile'}/>:null}</div>;}

