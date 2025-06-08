// src/hooks/useSongSync.ts
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase, executeDbOperation } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { executeWithCircuitBreaker } from '../utils/circuitBreaker';
import { nanoid } from 'nanoid';
import type { Song } from '../types';

const SONGS_CACHE_KEY = 'songs:all';
const SONGS_SERVICE_KEY = 'songs';
const MAX_RETRY_ATTEMPTS = 10;
const INITIAL_RETRY_DELAY = 2000;
const SUBSCRIPTION_INIT_DELAY = 1000;
const CONNECTION_TIMEOUT = 15000; // Increased timeout to 15 seconds

export function useSongSync(onUpdate: (songs: Song[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const mountedRef = useRef(true);
  const channelRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSongs = useCallback(async (bypassCache = false) => {
    // Create a new abort controller for this fetch
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.warn('Error aborting previous request:', err);
      }
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);

      if (!bypassCache) {
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs?.length > 0) {
          console.log('Using cached songs');
          if (mountedRef.current) {
            onUpdate(cachedSongs);
            setIsLoading(false);
          }
          return;
        }
      }

      await executeWithCircuitBreaker(SONGS_SERVICE_KEY, async () => {
        await executeDbOperation('songs:list', async () => {
          if (!mountedRef.current) return;
          
          const { data: songsData, error } = await supabase
            .from('songs')
            .select('*')
            .order('title')
            .abortSignal(signal);

          if (error) throw error;

          if (songsData && mountedRef.current) {
            cacheService.setSongs(SONGS_CACHE_KEY, songsData);
            onUpdate(songsData);
          }
        }, signal);
      }, signal);

    } catch (error) {
      if (!mountedRef.current) return;
      
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('Component unmounted'))) {
        // Silently handle abortion
        console.log('Songs fetch aborted');
        return;
      }
      
      console.error('Error fetching songs:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      
      const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
      if (cachedSongs) {
        console.warn('Using stale cache due to fetch error');
        onUpdate(cachedSongs);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    let channelId = `songs_changes_${Date.now()}_${nanoid()}`;

    const cleanupChannel = async () => {
      if (channelRef.current) {
        try {
          console.log('Cleaning up song sync channel...');
          
          try {
            await channelRef.current.unsubscribe();
          } catch (unsubError) {
            console.warn('Error unsubscribing channel:', unsubError);
          }
          
          try {
            await supabase.removeChannel(channelRef.current);
          } catch (removeError) {
            console.warn('Error removing channel:', removeError);
          }
          
          channelRef.current = null;
          setIsSubscribed(false);
        } catch (err) {
          console.warn('Error cleaning up channel:', err);
        }
      }
    };

    const waitForConnection = async (timeout = CONNECTION_TIMEOUT): Promise<boolean> => {
      // Try to establish connection with increased timeout
      const startTime = Date.now();
      let isConnected = false;
      
      // Check initial connection state
      if (supabase.realtime.isConnected()) {
        return true;
      }
      
      // Attempt to manually connect if not already connected
      try {
        await supabase.realtime.connect();
      } catch (err) {
        console.warn('Error manually connecting to realtime:', err);
      }
      
      // Wait for connection with polling
      while (Date.now() - startTime < timeout) {
        if (supabase.realtime.isConnected()) {
          isConnected = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return isConnected;
    };

    const setupRealtimeSubscription = async () => {
      if (!mountedRef.current) return;

      try {
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.error('Max retry attempts reached for song subscription');
          setError(new Error('Failed to establish realtime connection after maximum attempts'));
          // Still proceed with normal data fetching even if realtime fails
          await fetchSongs(true);
          return;
        }

        await cleanupChannel();

        // Wait for connection with increased timeout
        console.log('Waiting for realtime connection...');
        const isConnected = await waitForConnection();
        
        if (!isConnected) {
          console.warn('Failed to establish realtime connection, will retry later');
          
          // Fetch data anyway even if realtime connection fails
          await fetchSongs(true);
          
          // Schedule retry
          if (mountedRef.current && retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount) + (Math.random() * 2000);
            console.log(`Retrying realtime connection in ${Math.round(delay/1000)}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
            
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setRetryCount(prev => prev + 1);
                setupRealtimeSubscription();
              }
            }, delay);
          }
          return;
        }

        try {
          channelRef.current = supabase
            .channel(channelId)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'songs' },
              async (payload) => {
                if (!mountedRef.current || !isSubscribed) return;
                
                try {
                  console.log('Songs changed:', payload.eventType);
                  await fetchSongs(true);
                } catch (err) {
                  console.error('Error handling song change:', err);
                }
              }
            );
            
          // Better error handling for subscribe
          channelRef.current.subscribe((status: string, err: any) => {
            if (!mountedRef.current) return;

            try {
              console.log(`Song subscription status (${channelId}):`, status, err);

              if (status === 'SUBSCRIBED') {
                console.log(`Successfully subscribed to song changes (${channelId})`);
                setIsSubscribed(true);
                setRetryCount(0);
                setError(null);
                
                setTimeout(async () => {
                  if (mountedRef.current) {
                    try {
                      await fetchSongs(true);
                    } catch (err) {
                      console.error('Error in initial fetch after subscription:', err);
                    }
                  }
                }, SUBSCRIPTION_INIT_DELAY);
              } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                console.error(`Channel ${status.toLowerCase()} (${channelId}):`, err);
                setIsSubscribed(false);
                
                if (err) {
                  setError(err instanceof Error ? err : new Error(String(err)));
                }
                
                if (mountedRef.current && retryCount < MAX_RETRY_ATTEMPTS) {
                  const delay = INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount) + (Math.random() * 2000);
                  console.log(`Retrying in ${Math.round(delay/1000)}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
                  
                  if (retryTimeoutRef.current) {
                    clearTimeout(retryTimeoutRef.current);
                  }
                  
                  retryTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                      setRetryCount(prev => prev + 1);
                      channelId = `songs_changes_${Date.now()}_${nanoid()}`;
                      setupRealtimeSubscription();
                    }
                  }, delay);
                }
              }
            } catch (error) {
              console.error(`Error handling subscription status (${channelId}):`, error);
              setError(error instanceof Error ? error : new Error(String(error)));
              setIsSubscribed(false);
            }
          });
        } catch (error) {
          console.error(`Error creating channel (${channelId}):`, error);
          throw error;
        }
      } catch (error) {
        console.error('Error in setupRealtimeSubscription:', error);
        if (mountedRef.current) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setIsSubscribed(false);
          
          // Still fetch data even if subscription fails
          try {
            await fetchSongs(true);
          } catch (err) {
            console.error('Error fetching data after subscription failure:', err);
          }
          
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount) + (Math.random() * 2000);
            
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setRetryCount(prev => prev + 1);
                setupRealtimeSubscription();
              }
            }, delay);
          }
        }
      }
    };

    // Initial setup
    fetchSongs();
    setupRealtimeSubscription();

    // Monitor connection state
    const connectionCheckInterval = setInterval(() => {
      if (mountedRef.current && !supabase.realtime.isConnected() && isSubscribed) {
        console.log('Realtime connection lost, attempting to reconnect...');
        setupRealtimeSubscription();
      }
    }, 10000); // Check every 10 seconds

    // Refresh data periodically when subscribed
    const refreshInterval = setInterval(() => {
      if (mountedRef.current) {
        // Always fetch data periodically, regardless of subscription status
        fetchSongs(true).catch(console.error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      mountedRef.current = false;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      clearInterval(connectionCheckInterval);
      clearInterval(refreshInterval);
      
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        try {
          if (!abortControllerRef.current.signal.aborted) {
            abortControllerRef.current.abort('Component unmounted');
          }
        } catch (err) {
          console.warn('Error aborting fetch on unmount:', err);
        }
      }
      
      cleanupChannel().catch(console.error);
    };
  }, [fetchSongs, retryCount]);

  return { isLoading, error, refetch: () => fetchSongs(true) };
}