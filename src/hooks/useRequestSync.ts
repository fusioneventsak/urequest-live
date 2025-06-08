// src/hooks/useSongSync.ts
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { Song } from '../types';

const SONGS_CACHE_KEY = 'songs:all';
const FALLBACK_POLLING_INTERVAL = 30000; // Only used when realtime fails

export function useSongSync(onUpdate: (songs: Song[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);
  const subscriptionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<number | null>(null);

  // Fetch songs with proper error handling
  const fetchSongs = useCallback(async (bypassCache = false) => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoading(true);

      if (!bypassCache) {
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs?.length > 0) {
          console.log('Using cached songs');
          onUpdate(cachedSongs);
          setIsLoading(false);
          return;
        }
      }

      const { data: songsData, error } = await supabase
        .from('songs')
        .select('*')
        .order('title');

      if (error) throw error;

      if (songsData && mountedRef.current) {
        cacheService.setSongs(SONGS_CACHE_KEY, songsData);
        onUpdate(songsData);
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Fallback to cache
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedSongs);
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
      // Attempt to set up realtime subscription
      try {
        const subscriptionId = await RealtimeManager.createSubscription(
          'songs',
          async () => {
            console.log('Song update received via realtime');
            await fetchSongs(true);
          }
        );
        
        subscriptionIdRef.current = subscriptionId;
        setIsRealtime(true);
        
        // Initial fetch
        fetchSongs();
      } catch (error) {
        console.error('Error setting up realtime for songs:', error);
        setIsRealtime(false);
        
        // Fallback to polling
        fetchSongs();
        
        // Setup polling interval
        pollingIntervalRef.current = window.setInterval(() => {
          if (mountedRef.current) {
            fetchSongs(true);
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
      
      // Remove realtime subscription
      if (subscriptionIdRef.current) {
        RealtimeManager.removeSubscription(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove connection listener
      RealtimeManager.removeConnectionListener(connectionListener);
    };
  }, [fetchSongs, isRealtime]);

  return {
    isLoading,
    error,
    refetch: () => fetchSongs(true),
    isRealtime
  };
}