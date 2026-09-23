import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/useAuth';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { Shell, ErrorBoundary, Loading } from '@/components/platform/Platform';
const Index=lazy(()=>import('./pages/Index'));
const Game=lazy(()=>import('./pages/Game'));
const Leaderboard=lazy(()=>import('./pages/Leaderboard'));
const Profile=lazy(()=>import('./pages/Profile'));
const UserProfile=lazy(()=>import('./pages/UserProfile'));
const Auth=lazy(()=>import('./pages/Auth'));
const NotFound=lazy(()=>import('./pages/NotFound'));
const Library=lazy(()=>import('./pages/Library'));
const Challenges=lazy(()=>import('./pages/Challenges'));
const Settings=lazy(()=>import('./pages/Settings'));
const Onboarding=lazy(()=>import('./pages/Onboarding'));
const cache=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
function PlatformRoutes(){
  const location=useLocation();const {settings}=useSettings();
  useEffect(()=>{window.scrollTo(0,0);document.body.removeAttribute('data-playing');},[location.pathname]);
  return <MotionConfig reducedMotion={settings.reducedMotion?'always':'user'}><Shell><ErrorBoundary key={location.pathname}><Suspense fallback={<Loading/>}><Routes>
    <Route path="/" element={<Index/>}/><Route path="/game" element={<Library/>}/><Route path="/game/:gameMode" element={<Game/>}/>
    <Route path="/dashboard" element={<Profile/>}/><Route path="/profile" element={<Profile/>}/><Route path="/profile/:userId" element={<UserProfile/>}/>
    <Route path="/leaderboard" element={<Leaderboard/>}/><Route path="/challenges" element={<Challenges/>}/><Route path="/settings" element={<Settings/>}/>
    <Route path="/onboarding" element={<Onboarding/>}/><Route path="/auth" element={<Auth/>}/><Route path="*" element={<NotFound/>}/>
  </Routes></Suspense></ErrorBoundary></Shell></MotionConfig>;
}
export default function App(){return <QueryClientProvider client={cache}><AuthProvider><SettingsProvider><TooltipProvider><BrowserRouter><PlatformRoutes/></BrowserRouter><Toaster/></TooltipProvider></SettingsProvider></AuthProvider></QueryClientProvider>;}

