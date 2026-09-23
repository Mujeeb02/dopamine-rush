import { useParams } from 'react-router-dom';
import { usePlayer } from '@/hooks/usePlayer';
import { useAuth } from '@/hooks/useAuth';
import { Loading, ErrorState } from '@/components/platform/Platform';
import PlayerOverview from '@/components/platform/PlayerOverview';
export default function UserProfile(){const {userId}=useParams();const player=usePlayer(userId);const {user}=useAuth();return <div className="page">{player.isPending?<Loading/>:player.error?<ErrorState message={player.error.message} onRetry={()=>void player.refetch()}/>:player.data?<PlayerOverview player={player.data} own={user?.id===userId}/>:null}</div>;}

