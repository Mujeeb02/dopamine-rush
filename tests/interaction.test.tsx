// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import GameGrid from '../src/components/GameGrid';
import QuickReflex from '../src/components/games/QuickReflex';
import SpeedTypist from '../src/components/games/SpeedTypist';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
const auth=vi.hoisted(()=>({getSession:vi.fn(),onAuthStateChange:vi.fn(),signOut:vi.fn()}));
vi.mock('../src/integrations/supabase/client',()=>({backendConfigured:true,supabase:{auth}}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
describe('game controls and timer cleanup',()=>{
  it('hides memory tiles after the reveal, then times out exactly once',()=>{
    vi.useFakeTimers();const answer=vi.fn();const view=render(<GameGrid challenge={{mode:'classic',round:0,reveal_ms:1000,limit_ms:3000,cards:[0,1,2,3],target:1}} onAnswer={answer}/>);
    expect((screen.getByRole('button',{name:'Mint, position 2'}) as HTMLButtonElement).disabled).toBe(true);
    act(()=>vi.advanceTimersByTime(1100));
    expect(screen.getByRole('heading',{name:'Where was Mint?'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Position 2'}));expect(answer).toHaveBeenCalledWith(1);
    answer.mockClear();act(()=>vi.advanceTimersByTime(10000));expect(answer).toHaveBeenCalledTimes(1);expect(answer).toHaveBeenCalledWith({timeout:true});
    view.unmount();expect(vi.getTimerCount()).toBe(0);
  });
  it('does not race a pending answer with timeout',()=>{
    vi.useFakeTimers();const answer=vi.fn();render(<GameGrid challenge={{mode:'classic',round:0,reveal_ms:100,limit_ms:300,cards:[0],target:0}} onAnswer={answer} disabled/>);
    act(()=>vi.advanceTimersByTime(2000));expect(answer).not.toHaveBeenCalled();
  });
  it('uses Space for reflex play and removes the listener after unmount',()=>{
    vi.useFakeTimers();const answer=vi.fn();const view=render(<QuickReflex challenge={{mode:'quick-reflex',round:0,reveal_ms:0,limit_ms:3000,sequence:[0,1,2],target:2,interval_ms:1000}} onAnswer={answer}/>);
    act(()=>vi.advanceTimersByTime(2100));fireEvent.keyDown(window,{code:'Space'});expect(answer).toHaveBeenCalledWith(2);
    view.unmount();answer.mockClear();fireEvent.keyDown(window,{code:'Space'});expect(answer).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
  it('accepts exact typing and rejects a partial or mismatched word',()=>{
    const answer=vi.fn();render(<SpeedTypist challenge={{mode:'speed-typist',round:0,reveal_ms:0,limit_ms:5000,word:'focus'}} onAnswer={answer}/>);
    fireEvent.change(screen.getByLabelText('Type: focus'),{target:{value:'Focus'}});expect(answer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Type: focus'),{target:{value:'focus'}});expect(answer).toHaveBeenCalledWith('focus');
  });
});
describe('shared authentication state',()=>{
  function Status(){const {user,loading,error}=useAuth();return <p>{loading?'Loading':error?'Connection error':user?.id??'Guest'}</p>;}
  it('does not overwrite a fresh auth event with a stale session fetch',async()=>{
    let resolveSession:(value:unknown)=>void;let changed:(event:string,session:Session|null)=>void;
    const unsubscribe=vi.fn();auth.getSession.mockReturnValue(new Promise(resolve=>{resolveSession=resolve;}));
    auth.onAuthStateChange.mockImplementation(cb=>{changed=cb;return {data:{subscription:{unsubscribe}}};});
    const cache=new QueryClient();const clear=vi.spyOn(cache,'clear');
    const view=render(<QueryClientProvider client={cache}><AuthProvider><Status/><Status/></AuthProvider></QueryClientProvider>);
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    act(()=>changed('SIGNED_IN',{user:{id:'alice'}} as Session));
    await act(async()=>resolveSession({data:{session:null},error:null}));
    expect(screen.getAllByText('alice')).toHaveLength(2);expect(clear).toHaveBeenCalledTimes(1);
    act(()=>changed('TOKEN_REFRESHED',{user:{id:'alice'}} as Session));expect(clear).toHaveBeenCalledTimes(1);
    act(()=>changed('SIGNED_OUT',null));expect(screen.getAllByText('Guest')).toHaveLength(2);expect(clear).toHaveBeenCalledTimes(2);
    view.unmount();expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('finishes loading with a recoverable state when session restoration fails',async()=>{
    auth.getSession.mockRejectedValue(new Error('network'));
    auth.onAuthStateChange.mockReturnValue({data:{subscription:{unsubscribe:vi.fn()}}});
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Status/></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText('Connection error')).toBeTruthy();
  });
});
