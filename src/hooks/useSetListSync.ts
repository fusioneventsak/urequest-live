// src/hooks/useSetListSync.ts
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { SetList } from '../types';

const SET_LISTS_CACHE_KEY = 'setLists:all';
const FALLBACK_POLLING_INTERVAL = 15000; // Less frequent polling for set lists

export function useSetListSync(onUpdate: (setLists: SetList[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);
  const setListsSubscriptionRef = useRef<string | null>(null);
  const setListSongsSubscriptionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<number | null>(null);

  // Fetch set lists with proper error handling
  const fetchSetLists = useCallback(async (bypassCache = false) => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoading(true);

      if (!bypassCache) {
        const cachedSetLists = cacheService.get<SetList[]>(SET_LISTS_CACHE_KEY);
        if (cachedSetLists?.length > 0) {
          console.log('Using cached set lists');
          onUpdate(cachedSetLists);
          setIsLoading(false);
          return;
        }
      }

      const { data: setListsData, error } = await supabase
        .from('set_lists')
        .select(`
          *,
          set_list_songs (
            position,
            song:songs(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (setListsData && mountedRef.current) {
        const formattedSetLists = setListsData.map(setList => ({
          id: setList.id,
          name: setList.name || 'Unnamed Set List',
          date: new Date(setList.date),
          notes: setList.notes || '',
          isActive: setList.is_active || false,
          songs: setList.set_list_songs
            ? setList.set_list_songs
              .sort((a: any, b: any) => a.position - b.position)
              .map((item: any) => item.song)
              .filter(Boolean)
            : []
        }));

        console.log('Fetched set lists:', formattedSetLists.length);
        cacheService.setSetLists(SET_LISTS_CACHE_KEY, formattedSetLists);
        onUpdate(formattedSetLists);
      }
    } catch (error) {
      console.error('Error fetching set lists:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Fallback to cache
        const cachedSetLists = cacheService.get<SetList[]>(SET_LISTS_CACHE_KEY);
        if (cachedSetLists) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedSetLists);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onUpdate]);

  // Setup realtime subscription or fallback polling
  useEffect(() => {
    mountedRef.current = true;
    
    const setupRealtimeOrPolling = async () => {
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Attempt to set up realtime subscriptions
      try {
        // Subscribe to set_lists changes
        const setListsSub = await RealtimeManager.createSubscription(
          'set_lists',
          async () => {
            console.log('Set list update received via realtime');
            await fetchSetLists(true);
          }
        );
        
        // Subscribe to set_list_songs changes
        const setListSongsSub = await RealtimeManager.createSubscription(
          'set_list_songs',
          async () => {
            console.log('Set list song update received via realtime');
            await fetchSetLists(true);
          }
        );
        
        setListsSubscriptionRef.current = setListsSub;
        setListSongsSubscriptionRef.current = setListSongsSub;
        setIsRealtime(true);
        
        // Initial fetch
        fetchSetLists();
      } catch (error) {
        console.error('Error setting up realtime for set lists:', error);
        setIsRealtime(false);
        
        // Fallback to polling
        fetchSetLists();
        
        // Setup polling interval
        pollingIntervalRef.current = window.setInterval(() => {
          if (mountedRef.current) {
            fetchSetLists(true);
          }
        }, FALLBACK_POLLING_INTERVAL);
      }
    };
    
    setupRealtimeOrPolling();
    
    // Listen for connection changes
    const connectionListener = (event: string) => {
      if (event === 'connected' && !isRealtime) {
        // Re-establish realtime when connection is restored
        setupRealtimeOrPolling();
      }
    };
    
    RealtimeManager.addConnectionListener(connectionListener);
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      
      // Remove realtime subscriptions
      if (setListsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(setListsSubscriptionRef.current);
        setListsSubscriptionRef.current = null;
      }
      
      if (setListSongsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(setListSongsSubscriptionRef.current);
        setListSongsSubscriptionRef.current = null;
      }
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove connection listener
      RealtimeManager.removeConnectionListener(connectionListener);
    };
  }, [fetchSetLists, isRealtime]);

  return {
    isLoading,
    error,
    refetch: () => fetchSetLists(true),
    isRealtime
  };
}