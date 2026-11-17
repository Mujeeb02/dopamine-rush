import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/useAuth';
import { SettingsProvider } from '@/hooks/useSettings';
import { pageview } from '@/lib/analytics';
import { Shell, ErrorBoundary, Loading } from '@/components/platform/Platform';
const Index=lazy(()=>import('./pages/Index'));
const Game=lazy(()=>import('./pages/Game'));
const Leaderboard=lazy(()=>import('./pages/Leaderboard'));
const Profile=lazy(()=>import('./pages/Profile'));
const UserProfile=lazy(()=>import('./pages/UserProfile'));
const Auth=lazy(()=>import('./pages/Auth'));
const NotFound=lazy(()=>import('./pages/NotFound'));
const Library=lazy(()=>import('./pages/Library'));
const Daily=lazy(()=>import('./pages/Daily'));
const ChallengeLink=lazy(()=>import('./pages/ChallengeLink'));
const Settings=lazy(()=>import('./pages/Settings'));
const Onboarding=lazy(()=>import('./pages/Onboarding'));
const cache=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
const titles:Record<string,string>={'/':'Dopamine Rush — quick brain and reflex games','/game':'All games · Dopamine Rush','/leaderboard':'Leaderboards · Dopamine Rush','/dashboard':'My progress · Dopamine Rush','/profile':'My profile · Dopamine Rush','/settings':'Settings · Dopamine Rush','/auth':'Sign in · Dopamine Rush','/onboarding':'Welcome · Dopamine Rush'};
function PlatformRoutes(){
  const location=useLocation();
  useEffect(()=>{window.scrollTo(0,0);document.body.removeAttribute('data-playing');pageview(location.pathname);const title=titles[location.pathname];if(title)document.title=title;},[location.pathname]);
  return <Shell><ErrorBoundary key={location.pathname}><Suspense fallback={<Loading/>}><Routes>
    <Route path="/" element={<Index/>}/><Route path="/game" element={<Library/>}/><Route path="/game/:gameMode" element={<Game/>}/><Route path="/play/:slug" element={<Game/>}/>
    <Route path="/dashboard" element={<Profile/>}/><Route path="/profile" element={<Profile/>}/><Route path="/profile/:userId" element={<UserProfile/>}/>
    <Route path="/leaderboard" element={<Leaderboard/>}/><Route path="/daily" element={<Daily/>}/><Route path="/challenges" element={<Navigate to="/daily" replace/>}/><Route path="/c/:slug" element={<ChallengeLink/>}/><Route path="/settings" element={<Settings/>}/>
    <Route path="/onboarding" element={<Onboarding/>}/><Route path="/auth" element={<Auth/>}/><Route path="*" element={<NotFound/>}/>
  </Routes></Suspense></ErrorBoundary></Shell>;
}
export default function App(){return <QueryClientProvider client={cache}><AuthProvider><SettingsProvider><TooltipProvider><BrowserRouter><PlatformRoutes/></BrowserRouter><Toaster/></TooltipProvider></SettingsProvider></AuthProvider></QueryClientProvider>;}

