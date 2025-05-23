import { useEffect, useCallback, useState } from 'react';
import { supabase, executeDbOperation } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { executeWithCircuitBreaker } from '../utils/circuitBreaker';
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

  const fetchSongs = useCallback(async (bypassCache = false) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!bypassCache) {
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs?.length > 0) {
          console.log('Using cached songs');
          onUpdate(cachedSongs);
          setIsLoading(false);
          return;
        }
      }

      await executeWithCircuitBreaker(SONGS_SERVICE_KEY, async () => {
        await executeDbOperation('songs:list', async () => {
          const { data: songsData, error } = await supabase
            .from('songs')
            .select('*')
            .order('title');

          if (error) throw error;

          if (songsData) {
            cacheService.setSongs(SONGS_CACHE_KEY, songsData);
            onUpdate(songsData);
          }
        });
      });

    } catch (error) {
      console.error('Error fetching songs:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      
      const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
      if (cachedSongs) {
        console.warn('Using stale cache due to fetch error');
        onUpdate(cachedSongs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel>;
    let retryTimeout: NodeJS.Timeout;
    let initTimeout: NodeJS.Timeout;
    let connectionCheckInterval: NodeJS.Timeout;

    const calculateRetryDelay = (attempt: number) => {
      // Exponential backoff with jitter
      const baseDelay = INITIAL_RETRY_DELAY * Math.pow(1.5, attempt);
      const jitter = Math.random() * 2000; // Add up to 2 seconds of jitter
      return Math.min(baseDelay + jitter, 60000); // Cap at 60 seconds
    };

    const cleanupChannel = async () => {
      if (channel) {
        try {
          console.log('Cleaning up song sync channel...');
          await channel.unsubscribe();
          await supabase.removeChannel(channel);
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
      if (!mounted) return;

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
          if (mounted && retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = calculateRetryDelay(retryCount);
            console.log(`Retrying realtime connection in ${Math.round(delay/1000)}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
            retryTimeout = setTimeout(() => {
              if (mounted) {
                setRetryCount(prev => prev + 1);
                setupRealtimeSubscription();
              }
            }, delay);
          }
          return;
        }

        const channelId = `songs_changes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        try {
          channel = supabase
            .channel(channelId)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'songs' },
              async (payload) => {
                if (!mounted || !isSubscribed) return;
                
                try {
                  console.log('Songs changed:', payload.eventType);
                  await fetchSongs(true);
                } catch (err) {
                  console.error('Error handling song change:', err);
                  // Don't throw here - we want to keep the subscription alive
                }
              }
            )
            .subscribe(async (status, err) => {
              if (!mounted) return;

              try {
                console.log(`Song subscription status (${channelId}):`, status, err);

                if (status === 'SUBSCRIBED') {
                  console.log(`Successfully subscribed to song changes (${channelId})`);
                  setIsSubscribed(true);
                  setRetryCount(0);
                  setError(null);
                  
                  initTimeout = setTimeout(async () => {
                    if (mounted) {
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
                  
                  if (mounted && retryCount < MAX_RETRY_ATTEMPTS) {
                    const delay = calculateRetryDelay(retryCount);
                    console.log(`Retrying in ${Math.round(delay/1000)}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
                    retryTimeout = setTimeout(() => {
                      if (mounted) {
                        setRetryCount(prev => prev + 1);
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
        if (mounted) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setIsSubscribed(false);
          
          // Still fetch data even if subscription fails
          try {
            await fetchSongs(true);
          } catch (err) {
            console.error('Error fetching data after subscription failure:', err);
          }
          
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = calculateRetryDelay(retryCount);
            retryTimeout = setTimeout(() => {
              if (mounted) {
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
    connectionCheckInterval = setInterval(() => {
      if (mounted && !supabase.realtime.isConnected() && isSubscribed) {
        console.log('Realtime connection lost, attempting to reconnect...');
        setupRealtimeSubscription();
      }
    }, 10000); // Check every 10 seconds

    // Refresh data periodically when subscribed
    const refreshInterval = setInterval(() => {
      if (mounted) {
        // Always fetch data periodically, regardless of subscription status
        fetchSongs(true).catch(console.error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      mounted = false;
      clearTimeout(retryTimeout);
      clearTimeout(initTimeout);
      clearInterval(refreshInterval);
      clearInterval(connectionCheckInterval);
      cleanupChannel().catch(console.error);
    };
  }, [fetchSongs, retryCount]);

  return { isLoading, error, refetch: () => fetchSongs(true) };
}