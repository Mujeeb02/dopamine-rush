import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Settings={sound:boolean;reducedMotion:boolean};
const Context=createContext<{settings:Settings;update:(patch:Partial<Settings>)=>void}>({settings:{sound:false,reducedMotion:false},update:()=>{}});
export function SettingsProvider({children}:{children:ReactNode}){
  const [settings,setSettings]=useState<Settings>(()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('dopamine-settings')||'{}');}catch{/* Storage is optional. */}return {sound:false,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,...saved};});
  useEffect(()=>{document.documentElement.dataset.reducedMotion=String(settings.reducedMotion);try{localStorage.setItem('dopamine-settings',JSON.stringify(settings));}catch{/* Storage is optional. */}},[settings]);
  return <Context.Provider value={{settings,update:patch=>setSettings(s=>({...s,...patch}))}}>{children}</Context.Provider>;
}
export const useSettings=()=>useContext(Context);
let audio:AudioContext|undefined;
export function playTone(success:boolean){try{audio??=new AudioContext();void audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=success?660:220;gain.gain.setValueAtTime(.06,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);oscillator.start();oscillator.stop(audio.currentTime+.17);}catch{/* Sound is optional. */}}
