import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase, executeDbOperation } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { executeWithCircuitBreaker } from '../utils/circuitBreaker';
import type { SongRequest } from '../types';
import { backOff } from 'exponential-backoff';
import retry from 'retry';

const REQUESTS_CACHE_KEY = 'requests:all';
const REQUESTS_SERVICE_KEY = 'requests';
const MAX_RETRY_ATTEMPTS = 10;
const INITIAL_RETRY_DELAY = 2000;
const SUBSCRIPTION_INIT_DELAY = 1000;
const CONNECTION_TIMEOUT = 15000; // 15 second timeout
const FETCH_TIMEOUT = 30000; // 30 second timeout for fetch operations

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
  const channelIdRef = useRef<string>(`requests_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const lastFetchRef = useRef<number>(0);
  const lastErrorRef = useRef<string>('');
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchInProgressRef = useRef(false);

  // Create a fresh AbortController and clean up any existing one
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

  // Clean up channel with proper error handling
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

  // Fetch requests with proper error handling and retries
  const fetchRequests = useCallback(async (bypassCache = false) => {
    if (!mountedRef.current || fetchInProgressRef.current) return;
    if (!navigator.onLine) {
      console.log('Offline - using cached data');
      const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
      if (cachedRequests && mountedRef.current) {
        onUpdate(cachedRequests);
        return;
      }
    }

    // Debounce and prevent concurrent fetches
    const now = Date.now();
    if (now - lastFetchRef.current < 1000 && !bypassCache) {
      console.log('Debouncing request fetch...');
      return;
    }

    // If a fetch is already in progress, return that promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    fetchInProgressRef.current = true;
    lastFetchRef.current = now;

    // Create fresh abort controller
    const signal = createFreshAbortController();

    // Create timeout to abort long-running requests
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        console.warn(`Fetch operation timed out after ${FETCH_TIMEOUT}ms`);
        abortControllerRef.current.abort('Request timed out');
      }
    }, FETCH_TIMEOUT);

    const fetchPromise = (async () => {
      try {
        if (!mountedRef.current) return;
        
        if (mountedRef.current) {
          setIsLoading(true);
          setError(null);
        }

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

        const operation = retry.operation({
          retries: MAX_RETRY_ATTEMPTS,
          factor: 2,
          minTimeout: INITIAL_RETRY_DELAY,
          randomize: true
        });

        await new Promise((resolve, reject) => {
          operation.attempt(async (currentAttempt) => {
            try {
              await executeWithCircuitBreaker(REQUESTS_SERVICE_KEY, async () => {
                await executeDbOperation('requests:list', async () => {
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
                  if (!requestsData) throw new Error('No data returned from database');

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
              resolve(true);
            } catch (error) {
              if (operation.retry(error as Error)) {
                console.warn(`Retry attempt ${currentAttempt}/${MAX_RETRY_ATTEMPTS}`);
                return;
              }
              reject(operation.mainError());
            }
          });
        });

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError' && !mountedRef.current) {
          console.log('Request aborted due to component unmount');
          return;
        }

        console.error('Error fetching requests:', error);
        if (mountedRef.current) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setConsecutiveFailures(prev => prev + 1);
        }

        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests && mountedRef.current) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedRequests);
        }

      } finally {
        clearTimeout(timeoutId);
        if (mountedRef.current) {
          setIsLoading(false);
        }
        fetchPromiseRef.current = null;
        fetchInProgressRef.current = false;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [onUpdate, consecutiveFailures, cleanupChannel, createFreshAbortController]);

  // Set up realtime subscription with proper error handling
  const setupRealtimeSubscription = useCallback(async () => {
    if (!mountedRef.current || !navigator.onLine) return;

    try {
      await cleanupChannel();

      const channelId = channelIdRef.current;
      console.log(`Setting up new request sync channel: ${channelId}`);

      const channel = supabase.channel(channelId, {
        config: {
          broadcast: { self: true },
          presence: { key: channelId },
          retryAfter: INITIAL_RETRY_DELAY,
          timeout: CONNECTION_TIMEOUT
        }
      });

      // Keep track of event handlers to avoid issues with callback references
      const requestChangeHandler = async (payload: any) => {
        if (mountedRef.current && isSubscribed) {
          console.log('Received request change:', payload.eventType);
          await fetchRequests(true);
        }
      };

      const requesterChangeHandler = async (payload: any) => {
        if (mountedRef.current && isSubscribed) {
          console.log('Received requester change:', payload.eventType);
          await fetchRequests(true);
        }
      };

      channel
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'requests' },
          requestChangeHandler
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'requesters' },
          requesterChangeHandler
        )
        .on('error', (err) => {
          console.error('Channel error:', err);
          lastErrorRef.current = err.message || 'Unknown error';
        })
        .on('disconnect', async (event) => {
          console.log('Channel disconnected:', event);
          if (mountedRef.current) {
            setIsSubscribed(false);
          }

          if (mountedRef.current && navigator.onLine) {
            const delay = Math.min(
              INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount),
              60000 // Max 1 minute
            );

            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }

            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setRetryCount(prev => prev + 1);
                channelIdRef.current = `requests_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                setupRealtimeSubscription();
              }
            }, delay);
          }
        });

      channelRef.current = channel;

      const { error: subscribeError } = await channel.subscribe(async (status) => {
        if (!mountedRef.current) return;

        console.log(`Channel ${channelId} status: ${status}`);

        if (status === 'SUBSCRIBED') {
          if (mountedRef.current) {
            setIsSubscribed(true);
            setRetryCount(0);
            setError(null);
          }

          // Fetch initial data after successful subscription
          setTimeout(() => {
            if (mountedRef.current) {
              fetchRequests(true).catch(console.error);
            }
          }, SUBSCRIPTION_INIT_DELAY);
        }
      });

      if (subscribeError) throw subscribeError;

    } catch (error) {
      console.error('Error in setupRealtimeSubscription:', error);
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        setIsSubscribed(false);
      }

      if (retryCount < MAX_RETRY_ATTEMPTS && mountedRef.current) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
          60000
        );
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setRetryCount(prev => prev + 1);
            setupRealtimeSubscription();
          }
        }, delay);
      }
    }
  }, [fetchRequests, retryCount, isSubscribed, cleanupChannel]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      if (mountedRef.current) {
        setIsOnline(true);
        setRetryCount(0);
        setupRealtimeSubscription();
        fetchRequests(true).catch(console.error);
      }
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      if (mountedRef.current) {
        setIsOnline(false);
      }
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

  // Initialize subscription and set up health checks
  useEffect(() => {
    mountedRef.current = true;
    channelIdRef.current = `requests_${Date.now()}_${Math.random().toString(36).slice(2)}`;

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
      if (mountedRef.current && navigator.onLine) {
        if (!isSubscribed) {
          console.log('Health check: Channel not subscribed, attempting reconnection...');
          setupRealtimeSubscription();
        } else {
          fetchRequests(true).catch(console.error);
        }
      }
    }, 30000); // Check every 30 seconds

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
  }, [setupRealtimeSubscription, cleanupChannel, fetchRequests, isSubscribed]);

  return {
    isLoading,
    error,
    isOnline,
    retryCount,
    refetch: () => fetchRequests(true),
    reconnect: () => {
      console.log('Manual reconnection requested');
      cleanupChannel().then(() => {
        setRetryCount(0);
        setConsecutiveFailures(0);
        channelIdRef.current = `requests_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setupRealtimeSubscription();
        fetchRequests(true).catch(console.error);
      }).catch(console.error);
    }
  };
}