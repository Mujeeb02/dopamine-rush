import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { games } from '@/lib/games';
import { PageIntro, Loading } from '@/components/platform/Platform';
export default function Onboarding(){const {user,loading}=useAuth();const [name,setName]=useState(''),[game,setGame]=useState('classic'),[busy,setBusy]=useState(false),[error,setError]=useState('');const navigate=useNavigate(),cache=useQueryClient();
if(loading)return <Loading/>;
return <div className="page onboarding"><PageIntro eyebrow="WELCOME TO THE PLAYGROUND" title="Make yourself a player." description="Choose a name for your profile and leaderboard. Your email will stay private."/>{!user?<Link className="button" to="/auth">Sign in to continue<ArrowUpRight size={17}/></Link>:<form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api.updatePlayer(name.trim());await cache.invalidateQueries({queryKey:['player']});navigate(`/game/${game}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>What should we call you?<input className="text-input" value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_ \-]{3,24}" required autoComplete="nickname" placeholder={user.user_metadata?.username||'Your player name'}/></label><fieldset><legend>Choose your first challenge</legend><div className="onboarding-games">{games.slice(0,4).map(g=><label key={g.id} className={game===g.id?'selected':''}><input type="radio" name="first-game" value={g.id} checked={game===g.id} onChange={()=>setGame(g.id)}/><g.icon size={20}/><span>{g.name}<small>{g.skill}</small></span></label>)}</div></fieldset>{error&&<p role="alert" className="error-text">{error}</p>}<button className="button button-large" disabled={busy}>{busy?'Saving…':'Let’s find your focus'}<ArrowUpRight size={18}/></button></form>}</div>;
}
