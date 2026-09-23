import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { api } from '@/lib/api';
export function usePlayer(id?:string){const {user}=useAuth();const player=id??user?.id;return useQuery({queryKey:['player',player],queryFn:()=>api.player(player!),enabled:!!player,staleTime:30000,retry:1});}
