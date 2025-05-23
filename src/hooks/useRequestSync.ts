import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { nanoid } from 'nanoid';
import type { SongRequest } from '../types';

const RETRY_DELAY_MS = 2000;
const MAX_RETRY_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL_MS = 30000;

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const mountedRef = useRef(true);
  const channelRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckRef = useRef<NodeJS.Timeout>();
  const channelIdRef = useRef<string>(nanoid(8));

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

  // Fetch requests data from Supabase
  const fetchRequests = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

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
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (requestsData) {
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

        onUpdate(formattedRequests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onUpdate]);

  // Set up real-time subscription
  const setupRealtimeSubscription = useCallback(async () => {
    if (!mountedRef.current || !isOnline) return;

    try {
      await cleanupChannel();
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.error('Max retry attempts reached for request subscription');
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
              
              retryTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                  setRetryCount(prev => prev + 1);
                  channelIdRef.current = nanoid(8);
                  setupRealtimeSubscription();
                }
              }, RETRY_DELAY_MS);
            }
          }
        });
    } catch (error) {
      console.error('Error in setupRealtimeSubscription:', error);
      setIsSubscribed(false);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [cleanupChannel, fetchRequests, isOnline, retryCount]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
      setRetryCount(0);
      setupRealtimeSubscription();
      fetchRequests();
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
      cleanupChannel();
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
      if (mountedRef.current && isOnline) {
        if (!isSubscribed) {
          console.log('Health check: Channel not subscribed, attempting reconnection...');
          setupRealtimeSubscription();
        } else {
          // Periodically refresh data even if subscribed
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
      
      cleanupChannel();
    };
  }, [setupRealtimeSubscription, cleanupChannel, fetchRequests, isSubscribed, isOnline]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
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
    reconnect
  };
}