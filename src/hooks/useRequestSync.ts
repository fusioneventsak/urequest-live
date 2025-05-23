import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase, executeDbOperation } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { executeWithCircuitBreaker } from '../utils/circuitBreaker';
import type { SongRequest } from '../types';

const REQUESTS_CACHE_KEY = 'requests:all';
const REQUESTS_SERVICE_KEY = 'requests';
const MAX_RETRY_ATTEMPTS = 15;
const INITIAL_RETRY_DELAY = 2000;
const SUBSCRIPTION_INIT_DELAY = 5000;
const MAX_BACKOFF_DELAY = 60000;
const HEALTH_CHECK_INTERVAL = 30000;
const RECONNECT_THRESHOLD = 3;
const JITTER_MAX = 1000;
const FETCH_TIMEOUT = 30000;

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckRef = useRef<NodeJS.Timeout>();
  const channelIdRef = useRef<string>(crypto.randomUUID());
  const lastFetchRef = useRef<number>(0);
  const lastErrorRef = useRef<string>('');
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createFreshAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      try {
        if (!abortControllerRef.current.signal.aborted) {
          abortControllerRef.current.abort();
        }
      } catch (err) {
        console.warn('Error aborting previous request:', err);
      }
    }
    
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  const cleanupChannel = useCallback(async () => {
    if (channelRef.current) {
      try {
        console.log('Cleaning up request sync channel...');
        await channelRef.current.unsubscribe();
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('Error cleaning up channel:', err);
      } finally {
        channelRef.current = null;
        if (mountedRef.current) {
          setIsSubscribed(false);
        }
      }
    }
  }, []);

  const fetchRequests = useCallback(async (bypassCache = false) => {
    if (!mountedRef.current) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 1000 && !bypassCache) {
      console.log('Debouncing request fetch...');
      return;
    }
    
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    lastFetchRef.current = now;

    let signal: AbortSignal;
    try {
      signal = createFreshAbortController();
    } catch (err) {
      console.error('Error creating abort controller:', err);
      signal = new AbortController().signal;
    }

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        console.warn(`Fetch operation timed out after ${FETCH_TIMEOUT}ms`);
        abortControllerRef.current.abort('Request timed out');
      }
    }, FETCH_TIMEOUT);

    const fetchPromise = (async () => {
      try {
        if (!mountedRef.current) return;
        setIsLoading(true);
        setError(null);

        if (!bypassCache) {
          const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
          if (cachedRequests?.length > 0) {
            console.log('Using cached requests');
            if (mountedRef.current) {
              onUpdate(cachedRequests);
              setIsLoading(false);
            }
            return;
          }
        }

        await executeWithCircuitBreaker(REQUESTS_SERVICE_KEY, async () => {
          await executeDbOperation('requests:list', async () => {
            console.log('Fetching requests with requesters...');
            
            const { data: requestsData, error: requestsError } = await supabase
              .from('requests')
              .select(`
                *,
                requesters (
                  id,
                  name,
                  photo,
                  message,
                  created_at
                )
              `)
              .order('created_at', { ascending: false })
              .abortSignal(signal);

            if (requestsError) throw requestsError;

            if (!requestsData) {
              console.log('No requests found');
              if (mountedRef.current) {
                onUpdate([]);
              }
              return;
            }

            const formattedRequests = requestsData.map(request => ({
              id: request.id,
              title: request.title,
              artist: request.artist || '',
              votes: request.votes || 0,
              status: request.status || 'pending',
              isLocked: request.is_locked || false,
              isPlayed: request.is_played || false,
              createdAt: new Date(request.created_at).toISOString(),
              requesters: (request.requesters || []).map(requester => ({
                id: requester.id,
                name: requester.name,
                photo: requester.photo,
                message: requester.message || '',
                timestamp: new Date(requester.created_at).toISOString()
              }))
            }));

            if (mountedRef.current) {
              cacheService.setRequests(REQUESTS_CACHE_KEY, formattedRequests);
              onUpdate(formattedRequests);
              setConsecutiveFailures(0);
            }
          });
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError' && !mountedRef.current) {
          console.log('Request aborted due to component unmount');
          return;
        }

        if (mountedRef.current) {
          console.error('Error fetching requests:', error);
          setError(error instanceof Error ? error : new Error(String(error)));
          setConsecutiveFailures(prev => prev + 1);

          const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
          if (cachedRequests) {
            console.warn('Using stale cache due to fetch error');
            onUpdate(cachedRequests);
          }

          if (consecutiveFailures >= RECONNECT_THRESHOLD) {
            console.log('Too many consecutive failures, forcing reconnect...');
            await cleanupChannel();
            channelIdRef.current = crypto.randomUUID();
            setRetryCount(0);
            setConsecutiveFailures(0);
          }
        }
      } finally {
        clearTimeout(timeoutId);

        if (mountedRef.current) {
          setIsLoading(false);
        }
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [onUpdate, consecutiveFailures, cleanupChannel, createFreshAbortController]);

  const setupRealtimeSubscription = useCallback(async () => {
    if (!mountedRef.current || !isOnline) return;

    try {
      await cleanupChannel();

      const channelId = `requests-${channelIdRef.current}`;
      console.log(`Setting up new request sync channel: ${channelId}`);

      const newChannel = supabase.channel(channelId, {
        config: {
          broadcast: { self: true },
          presence: { key: channelId },
          retryAfter: INITIAL_RETRY_DELAY,
          timeout: 30000
        },
      });

      const handleChange = async () => {
        if (mountedRef.current && isSubscribed) {
          console.log('Received database change');
          await fetchRequests(true);
        }
      };

      newChannel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requests' },
          handleChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requesters' },
          handleChange
        )
        .on('error', (err) => {
          console.error('Channel error:', err);
          lastErrorRef.current = err.message || 'Unknown error';
        })
        .on('system', (event) => {
          console.log('Channel system event:', event);
        })
        .on('disconnect', (event) => {
          console.log('Channel disconnected:', event);
          if (mountedRef.current) {
            setIsSubscribed(false);
            const delay = Math.min(
              INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount),
              MAX_BACKOFF_DELAY
            );
            
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setRetryCount(prev => prev + 1);
                channelIdRef.current = crypto.randomUUID();
                setupRealtimeSubscription();
              }
            }, delay);
          }
        })
        .subscribe(async (status, err) => {
          if (!mountedRef.current) return;

          console.log(`Channel ${channelId} status: ${status}`);

          if (status === 'SUBSCRIBED') {
            channelRef.current = newChannel;
            setIsSubscribed(true);
            setRetryCount(0);
            setError(null);
            
            setTimeout(() => {
              if (mountedRef.current) {
                fetchRequests(true).catch(console.error);
              }
            }, 1000);
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.error(`Channel ${status.toLowerCase()}:`, err);
            setIsSubscribed(false);
            channelRef.current = null;

            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }

            if (retryCount < MAX_RETRY_ATTEMPTS && isOnline && mountedRef.current) {
              const backoff = Math.min(
                INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
                MAX_BACKOFF_DELAY
              );
              const jitter = Math.floor(Math.random() * JITTER_MAX);
              const delay = backoff + jitter;

              console.log(`Reconnecting in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);

              retryTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                  setRetryCount(prev => prev + 1);
                  channelIdRef.current = crypto.randomUUID();
                  setupRealtimeSubscription();
                }
              }, delay);
            }
          }
        });
    } catch (error) {
      console.error('Error in setupRealtimeSubscription:', error);
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        setIsSubscribed(false);
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        if (retryCount < MAX_RETRY_ATTEMPTS && mountedRef.current) {
          const backoff = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
            MAX_BACKOFF_DELAY
          );
          const jitter = Math.floor(Math.random() * JITTER_MAX);
          const delay = backoff + jitter;
          
          console.log(`Scheduling reconnect in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setRetryCount(prev => prev + 1);
              setupRealtimeSubscription();
            }
          }, delay);
        }
      }
    }
  }, [cleanupChannel, fetchRequests, isSubscribed, retryCount, isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
      setRetryCount(0);
      setupRealtimeSubscription();
      fetchRequests(true).catch(console.error);
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
      cleanupChannel();
      
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort('Network connection lost');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [cleanupChannel, setupRealtimeSubscription, fetchRequests]);

  useEffect(() => {
    mountedRef.current = true;
    channelIdRef.current = crypto.randomUUID();

    const initFetch = async () => {
      if (!mountedRef.current) return;
      await fetchRequests();
      
      setTimeout(() => {
        if (mountedRef.current) {
          setupRealtimeSubscription();
        }
      }, SUBSCRIPTION_INIT_DELAY);
    };
    
    initFetch().catch(console.error);

    healthCheckRef.current = setInterval(() => {
      if (mountedRef.current && isOnline) {
        if (!isSubscribed) {
          console.log('Health check: Channel not subscribed, attempting reconnection...');
          setupRealtimeSubscription();
        } else {
          fetchRequests(true).catch(console.error);
        }
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      mountedRef.current = false;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
      
      if (abortControllerRef.current) {
        try {
          if (!abortControllerRef.current.signal.aborted) {
            abortControllerRef.current.abort('Component unmounted');
          }
        } catch (err) {
          console.warn('Error aborting request on unmount:', err);
        }
        abortControllerRef.current = null;
      }
      
      cleanupChannel().catch(err => {
        console.warn('Error cleaning up channel on unmount:', err);
      });
    };
  }, [setupRealtimeSubscription, cleanupChannel, fetchRequests, isSubscribed, isOnline]);

  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
    
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort('Manual reconnection requested');
      abortControllerRef.current = null;
    }
    
    cleanupChannel().then(() => {
      setRetryCount(0);
      setConsecutiveFailures(0);
      channelIdRef.current = crypto.randomUUID();
      setupRealtimeSubscription();
      fetchRequests(true).catch(console.error);
    }).catch(console.error);
  }, [cleanupChannel, setupRealtimeSubscription, fetchRequests]);

  return {
    isLoading,
    error,
    isOnline,
    retryCount,
    refetch: () => fetchRequests(true),
    reconnect
  };
}