import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { nanoid } from 'nanoid';
import type { SongRequest } from '../types';

// Increased retry attempts and timeout values for better resilience
const RETRY_DELAY_MS = 3000;
const MAX_RETRY_ATTEMPTS = 10; // Increased from 5
const HEALTH_CHECK_INTERVAL_MS = 60000; // Increased from 30000
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000; // Increased from 30000
const FETCH_TIMEOUT_MS = 30000; // Increased from 10000

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  
  const mountedRef = useRef(true);
  const channelRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckRef = useRef<NodeJS.Timeout>();
  const channelIdRef = useRef<string>(nanoid(8));
  const fetchRetryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up any existing channel subscription
  const cleanupChannel = useCallback(async () => {
    if (channelRef.current) {
      try {
        console.log('Cleaning up request sync channel...');
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('Error cleaning up channel:', err);
      } finally {
        channelRef.current = null;
        setIsSubscribed(false);
      }
    }
  }, []);

  // Calculate exponential backoff time
  const getBackoffTime = useCallback((retryCount: number) => {
    const backoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, retryCount),
      MAX_BACKOFF_MS
    );
    // Add some jitter to prevent all clients retrying simultaneously
    return backoff + Math.random() * 1000;
  }, []);

  // Check network connectivity more thoroughly
  const checkNetworkConnectivity = useCallback(() => {
    const online = navigator.onLine;
    
    if (online !== isOnline) {
      setIsOnline(online);
      console.log(`Network status changed: ${online ? 'online' : 'offline'}`);
    }
    
    return online;
  }, [isOnline]);

  // Fetch requests data from Supabase with retry capability
  const fetchRequests = useCallback(async (retryAttempt = 0): Promise<void> => {
    if (!mountedRef.current) return;
    
    // Abort any in-flight requests before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const networkAvailable = checkNetworkConnectivity();
    if (!networkAvailable) {
      console.log('Device is offline, skipping fetch');
      setError(new Error('Network connection unavailable'));
      return;
    }

    try {
      if (retryAttempt === 0) {
        setIsLoading(true);
        setError(null);
      }

      console.log(`Fetching requests with requesters (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})...`);
      
      // Setup timeout for this fetch operation
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, FETCH_TIMEOUT_MS);
      
      try {
        const response = await supabase
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
        
        clearTimeout(timeoutId);
        
        if (response.error) throw response.error;

        // Validate the response data before processing
        if (!response.data || !Array.isArray(response.data)) {
          throw new Error('Invalid response format: expected an array');
        }

        // Safely parse and validate each request object
        const formattedRequests = response.data.map((request: any) => {
          try {
            if (!request || typeof request !== 'object') {
              console.warn('Invalid request object received:', request);
              return null;
            }

            // Ensure requesters is an array
            const requesters = Array.isArray(request.requesters) 
              ? request.requesters 
              : [];
            
            return {
              id: request.id,
              title: request.title || 'Unknown Title',
              artist: request.artist || '',
              votes: typeof request.votes === 'number' ? request.votes : 0,
              status: request.status || 'pending',
              isLocked: Boolean(request.is_locked),
              isPlayed: Boolean(request.is_played),
              createdAt: request.created_at ? new Date(request.created_at).toISOString() : new Date().toISOString(),
              requesters: requesters.filter(Boolean).map((requester: any) => ({
                id: requester.id,
                name: requester.name || 'Anonymous',
                photo: requester.photo || '',
                message: requester.message || '',
                timestamp: requester.created_at 
                  ? new Date(requester.created_at).toISOString() 
                  : new Date().toISOString()
              }))
            };
          } catch (err) {
            console.error('Error processing request item:', err);
            return null;
          }
        }).filter(Boolean);

        onUpdate(formattedRequests);
        setLastSuccessfulFetch(new Date());
        fetchRetryCountRef.current = 0;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      // Handle AbortError separately (user navigation or component unmount)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('Request was aborted', error);
        return;
      }
      
      const timestamp = new Date().toISOString();
      const errorType = error.name || 'Unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`[${timestamp}] Error fetching requests (${errorType}):`, error);
      
      setError(error instanceof Error ? error : new Error(errorMessage));

      // Specific handling for JSON parsing errors
      if (error instanceof SyntaxError && errorMessage.includes('JSON')) {
        console.error('JSON parsing error detected. The response may be corrupted or incomplete.');
      }
      
      // Implement retry with exponential backoff for network errors or timeouts
      if (
        retryAttempt < MAX_RETRY_ATTEMPTS && 
        mountedRef.current && 
        checkNetworkConnectivity() && 
        (errorMessage.includes('Failed to fetch') || 
         errorMessage.includes('NetworkError') ||
         errorMessage.includes('network') ||
         errorMessage.includes('timeout') ||
         error instanceof SyntaxError)
      ) {
        const backoffTime = getBackoffTime(retryAttempt);
        console.log(`[${timestamp}] Retrying fetch in ${Math.round(backoffTime / 1000)} seconds (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchRequests(retryAttempt + 1);
          }
        }, backoffTime);
      } else {
        fetchRetryCountRef.current++;
        
        if (fetchRetryCountRef.current > MAX_RETRY_ATTEMPTS) {
          console.error(`[${timestamp}] Max fetch retry attempts reached (${fetchRetryCountRef.current}), backing off until next health check`);
        }
        
        setIsLoading(false);
      }
    } finally {
      if (mountedRef.current && retryAttempt === 0) {
        setIsLoading(false);
      }
    }
  }, [onUpdate, getBackoffTime, checkNetworkConnectivity]);

  // Set up real-time subscription
  const setupRealtimeSubscription = useCallback(async () => {
    if (!mountedRef.current || !checkNetworkConnectivity()) return;

    try {
      await cleanupChannel();
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.error(`Max retry attempts reached for request subscription (${retryCount}/${MAX_RETRY_ATTEMPTS})`);
        setError(new Error('Failed to establish realtime connection after maximum attempts'));
        return;
      }

      const channelId = `requests-${channelIdRef.current}`;
      console.log(`Setting up new request sync channel: ${channelId}`);

      // Create a new channel with minimal configuration
      const channel = supabase.channel(channelId);

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          if (mountedRef.current) {
            fetchRequests();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requesters' }, () => {
          if (mountedRef.current) {
            fetchRequests();
          }
        })
        .subscribe(status => {
          if (!mountedRef.current) return;

          console.log(`Channel ${channelId} status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            channelRef.current = channel;
            setIsSubscribed(true);
            setRetryCount(0);
            setError(null);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsSubscribed(false);
            
            if (mountedRef.current && retryCount < MAX_RETRY_ATTEMPTS) {
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
              
              const backoffTime = getBackoffTime(retryCount);
              console.log(`Channel reconnection scheduled in ${Math.round(backoffTime / 1000)} seconds`);
              
              retryTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                  setRetryCount(prev => prev + 1);
                  channelIdRef.current = nanoid(8);
                  setupRealtimeSubscription();
                }
              }, backoffTime);
            }
          }
        });
    } catch (error) {
      console.error('Error in setupRealtimeSubscription:', error);
      setIsSubscribed(false);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [cleanupChannel, fetchRequests, retryCount, getBackoffTime, checkNetworkConnectivity]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
      setRetryCount(0);
      fetchRetryCountRef.current = 0;
      setupRealtimeSubscription();
      fetchRequests();
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
      cleanupChannel();
      
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
    channelIdRef.current = nanoid(8);
    fetchRetryCountRef.current = 0;

    // Initial fetch before subscription setup
    fetchRequests();
    
    // Setup subscription after a short delay
    setTimeout(() => {
      if (mountedRef.current) {
        setupRealtimeSubscription();
      }
    }, 1000);

    // Set up health check interval
    healthCheckRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      
      const networkAvailable = checkNetworkConnectivity();
      
      if (networkAvailable) {
        const timeSinceLastFetch = lastSuccessfulFetch 
          ? (new Date().getTime() - lastSuccessfulFetch.getTime()) 
          : Infinity;
        
        // Reset fetch retry counter if it's been a while
        if (fetchRetryCountRef.current > MAX_RETRY_ATTEMPTS && timeSinceLastFetch > HEALTH_CHECK_INTERVAL_MS) {
          console.log('Resetting fetch retry counter during health check');
          fetchRetryCountRef.current = 0;
        }

        if (!isSubscribed) {
          console.log('Health check: Channel not subscribed, attempting reconnection...');
          setupRealtimeSubscription();
        }
        
        // Periodically refresh data even if subscribed, but less frequently if we've had a recent success
        if (timeSinceLastFetch > HEALTH_CHECK_INTERVAL_MS / 2) {
          console.log('Health check: Performing periodic data refresh');
          fetchRequests();
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
      
      // Abort any pending fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      cleanupChannel();
    };
  }, [setupRealtimeSubscription, cleanupChannel, fetchRequests, isSubscribed, lastSuccessfulFetch, checkNetworkConnectivity]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
    
    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    fetchRetryCountRef.current = 0;
    cleanupChannel().then(() => {
      setRetryCount(0);
      channelIdRef.current = nanoid(8);
      setupRealtimeSubscription();
      fetchRequests();
    }).catch(console.error);
  }, [cleanupChannel, setupRealtimeSubscription, fetchRequests]);

  return {
    isLoading,
    error,
    isOnline,
    retryCount,
    refetch: fetchRequests,
    reconnect,
    lastSuccessfulFetch
  };
}