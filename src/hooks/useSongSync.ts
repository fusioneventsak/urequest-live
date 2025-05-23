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
      const baseDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      return Math.min(baseDelay + jitter, 60000);
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

    const waitForConnection = async (timeout = 5000): Promise<boolean> => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (supabase.realtime.isConnected()) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return false;
    };

    const setupRealtimeSubscription = async () => {
      if (!mounted) return;

      try {
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.error('Max retry attempts reached for song subscription');
          setError(new Error('Failed to establish realtime connection after maximum attempts'));
          return;
        }

        await cleanupChannel();

        const isConnected = await waitForConnection();
        if (!isConnected) {
          throw new Error('Failed to establish realtime connection');
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
                    console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
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
    }, 5000);

    // Refresh data periodically when subscribed
    const refreshInterval = setInterval(() => {
      if (mounted && isSubscribed) {
        fetchSongs(true).catch(console.error);
      }
    }, 5 * 60 * 1000);

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