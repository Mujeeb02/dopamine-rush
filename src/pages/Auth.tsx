import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, LockKeyhole, Zap } from 'lucide-react';
import { supabase, backendConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { track } from '@/lib/analytics';
import { GameArt } from '@/components/platform/Platform';
type Mode='login'|'signup'|'reset'|'update';
export default function Auth(){
  const [params]=useSearchParams();const [mode,setMode]=useState<Mode>(params.has('recovery')?'update':params.has('reset')?'reset':params.has('upgrade')?'signup':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[username,setUsername]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const {user:sessionUser}=useAuth();const guest=sessionUser?.is_anonymous?sessionUser:null;const user=guest?null:sessionUser;const navigate=useNavigate();
  useEffect(()=>{let active=true;if(user&&mode!=='update'&&mode!=='reset'){api.player(user.id).then(p=>{if(active)navigate(p.onboarded?'/dashboard':'/onboarding',{replace:true});}).catch(()=>{if(active)navigate('/dashboard',{replace:true});});}return()=>{active=false;};},[user,mode,navigate]);
  const google=async()=>{setError('');setMessage('');setBusy(true);try{
    const redirectTo=`${window.location.origin}/auth`;
    // A guest links Google to the same account, so verified runs and streaks carry over.
    const {error}=guest?await supabase.auth.linkIdentity({provider:'google',options:{redirectTo}}):await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
    if(error){setError(/already|exists|linked/i.test(error.message)?'That Google account already has a Dopamine Rush profile. Sign in with it instead.':'Google sign-in is not available right now. Use email instead.');setBusy(false);return;}
    if(guest)track('signup_completed',{from:'guest',method:'google'});
  }catch{setError('Connection interrupted. Please try again.');setBusy(false);}};
  const change=(m:Mode)=>{setMode(m);setError('');setMessage('');setPassword('');};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setMessage('');setBusy(true);try{
    let failure;
    if(mode==='login'){const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});failure=error;}
    if(mode==='signup'){if(!/^[A-Za-z0-9_ -]{3,24}$/.test(username.trim())){setError('Use 3–24 letters, numbers, spaces, underscores or hyphens for your name.');return;}if(guest){
        // Keep the guest's verified runs: attach an email and password to the same account.
        const {error}=await supabase.auth.updateUser({email:email.trim(),password,data:{username:username.trim()}},{emailRedirectTo:`${window.location.origin}/auth`});failure=error;
        if(!error){await api.updatePlayer(username.trim()).catch(()=>{});track('signup_completed',{from:'guest'});setMessage('Check your email to confirm it. Your runs are already saved to this account.');}
      }else{
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/auth`,data:{username:username.trim()}}});failure=error;
        if(!error){track('signup_completed',{from:'new'});if(!data.session)setMessage('Check your email to confirm your account, then come back to sign in.');}
      }}
    if(mode==='reset'){const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/auth?recovery=1`});failure=error;if(!error)setMessage('If an account uses that email, a reset link is on its way.');}
    if(mode==='update'){const {error}=await supabase.auth.updateUser({password});failure=error;if(!error){setPassword('');setMessage('Your password has been updated.');}}
    if(failure)setError(failure.status===429?'Please wait a moment before trying again.':mode==='login'?'Sign in failed. Check your email and password, and confirm your email if you just joined.':'That request could not be completed. Please try again.');
  }catch{setError('Connection interrupted. Please try again.');}finally{setBusy(false);}};
  const title={login:'Back for another round?',signup:'Your best is still ahead.',reset:'Let’s get you back in.',update:'Choose a new password.'}[mode];
  return <div className="page auth-layout"><div className="auth-story"><span className="eyebrow">A LITTLE PLAY GOES A LONG WAY</span><h1>Keep your<br/>momentum.</h1><p>Your records. Your daily ritual.<br/>Your next “just one more”.</p><GameArt id="reverse-sequence"/><span className="tiny muted"><LockKeyhole size={14}/> Your email stays private.</span></div><div className="auth-form-wrap"><span className="brand-mark"><Zap size={24}/></span><h2>{title}</h2><p className="muted">{mode==='signup'&&guest?'Your guest runs are already verified. Add an email to keep them on every device and start earning XP.':mode==='signup'?'Join to save your runs, earn XP, and find your place on the leaderboard.':mode==='login'?'Sign in to pick up where you left off.':'Follow the steps to recover your account.'}</p>
    {!backendConfigured&&<p role="alert" className="error-text">Online accounts are not configured here. You can still practice every game.</p>}
    {(mode==='login'||mode==='signup')&&backendConfigured&&<><button type="button" className="button button-secondary google-button" disabled={busy} onClick={()=>void google()}><GoogleMark/>{guest?'Save progress with Google':'Continue with Google'}</button><p className="auth-divider"><span>or use email</span></p></>}
    <form onSubmit={submit} className="form-stack">{mode==='signup'&&<label>Player name<input className="text-input" value={username} onChange={e=>setUsername(e.target.value)} required minLength={3} maxLength={24} autoComplete="nickname"/></label>}
    {mode!=='update'&&<label>Email address<input className="text-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>}
    {mode!=='reset'&&<label>Password<input className="text-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==='login'?1:10} autoComplete={mode==='login'?'current-password':'new-password'}/>{mode!=='login'&&<small>Use at least 10 characters.</small>}</label>}
    {error&&<p role="alert" className="error-text">{error}</p>}{message&&<p role="status" className="success-text">{message}</p>}
    <button className="button" disabled={busy||!backendConfigured||(mode==='update'&&!user)}>{busy?'One moment…':{login:'Sign in',signup:'Create account',reset:'Send reset link',update:'Update password'}[mode]}<ArrowUpRight size={17}/></button></form>
    {mode==='login'&&<button className="text-link auth-link" onClick={()=>change('reset')}>Forgot your password?</button>}
    {mode==='login'||mode==='signup'?<p className="auth-switch">{mode==='login'?'New to the playground?':'Already have an account?'} <button className="text-link" onClick={()=>change(mode==='login'?'signup':'login')}>{mode==='login'?'Join the rush':'Sign in'}</button></p>:<Link to={user?'/dashboard':'/auth'} className="text-link auth-link" onClick={()=>{if(!user)change('login');}}>{user?'Go to your dashboard':'Back to sign in'}</Link>}
    <Link to="/game" className="text-link auth-link">Keep playing as a guest<ArrowUpRight size={16}/></Link>
  </div></div>;
}
function GoogleMark(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;}
