import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { backendConfigured, supabase } from '@/integrations/supabase/client';
import { identify } from '@/lib/analytics';

type AuthState = { session: Session | null; loading: boolean; error: boolean };
const AuthContext = createContext<AuthState>({session:null,loading:true,error:false});
export function AuthProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<AuthState>({session:null,loading:backendConfigured,error:false});
  const cache=useQueryClient();
  useEffect(()=>{
    if(!backendConfigured)return;
    let active=true, changed=false, identity:string|undefined;
    const apply=(session:Session|null,error=false)=>{
      if(!active)return;
      // Clear private cache before a new identity renders, never during its fetch.
      if(identity!==session?.user.id){cache.clear();identity=session?.user.id;identify(session?.user.id??null,{anonymous:session?.user.is_anonymous??false});}
      setState({session,loading:false,error});
    };
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      changed=true;apply(session);
    });
    supabase.auth.getSession().then(({data,error})=>{
      if(!changed)apply(data.session,!!error);
    }).catch(()=>{if(!changed)apply(null,true);});
    return()=>{active=false;subscription.unsubscribe();};
  },[cache]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth(){
  const state=useContext(AuthContext);
  return {...state,user:state.session?.user??null,isAuthenticated:!!state.session?.user,
    signOut:async()=>{const {error}=await supabase.auth.signOut();if(error)throw new Error('Sign out failed. Please try again.');}};
}
