import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { SongRequest } from '../types';

const REQUESTS_CACHE_KEY = 'requests:all';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const requestsSubscriptionRef = useRef<string | null>(null);
  const requestersSubscriptionRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef<boolean>(false);

  // Fetch requests with simple error handling
  const fetchRequests = useCallback(async (bypassCache = false) => {
    // Don't allow concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    
    try {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);

      // Check cache first unless bypassing
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

      // Fetch requests with requesters
      console.log('🔄 Fetching requests with requesters...');
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

      if (!requestsData) {
        console.log('No requests found');
        if (mountedRef.current) {
          onUpdate([]);
        }
        return;
      }

      if (mountedRef.current) {
        console.log('✅ Fetched requests:', requestsData.length);
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

        // Clear cache and update with fresh data
        if (bypassCache) {
          cacheService.del(REQUESTS_CACHE_KEY);
        }
        
        cacheService.setRequests(REQUESTS_CACHE_KEY, formattedRequests);
        onUpdate(formattedRequests);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (error) {
      console.error('❌ Error fetching requests:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Use cached data if available
        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedRequests);
        }
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
          }
          
          fetchTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setRetryCount(prev => prev + 1);
              fetchRequests(true);
            }
          }, delay);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      fetchInProgressRef.current = false;
    }
  }, [onUpdate, retryCount]);

  // Setup realtime subscriptions
  useEffect(() => {
    mountedRef.current = true;
    
    // Initialize RealtimeManager
    RealtimeManager.init();
    
    // Setup subscriptions
    const setupSubscriptions = () => {
      try {
        // Subscribe to requests table
        const requestsSub = RealtimeManager.createSubscription(
          'requests',
          (payload) => {
            console.log('🔔 Requests changed:', payload.eventType);
            fetchRequests(true);
          }
        );
        
        // Subscribe to requesters table
        const requestersSub = RealtimeManager.createSubscription(
          'requesters',
          (payload) => {
            console.log('🔔 Requesters changed:', payload.eventType);
            fetchRequests(true);
          }
        );
        
        requestsSubscriptionRef.current = requestsSub;
        requestersSubscriptionRef.current = requestersSub;
      } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
      }
    };
    
    // Initial fetch and subscription setup
    fetchRequests();
    setupSubscriptions();
    
    // Setup periodic refresh
    const refreshInterval = setInterval(() => {
      if (mountedRef.current) {
        fetchRequests(true);
      }
    }, 60000); // Refresh every minute
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Clear any pending timeouts
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Clear refresh interval
      clearInterval(refreshInterval);
      
      // Remove subscriptions
      if (requestsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(requestsSubscriptionRef.current);
      }
      
      if (requestersSubscriptionRef.current) {
        RealtimeManager.removeSubscription(requestersSubscriptionRef.current);
      }
    };
  }, [fetchRequests]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
    
    // Remove existing subscriptions
    if (requestsSubscriptionRef.current) {
      RealtimeManager.removeSubscription(requestsSubscriptionRef.current);
      requestsSubscriptionRef.current = null;
    }
    
    if (requestersSubscriptionRef.current) {
      RealtimeManager.removeSubscription(requestersSubscriptionRef.current);
      requestersSubscriptionRef.current = null;
    }
    
    // Reconnect realtime
    RealtimeManager.reconnect();
    
    // Setup new subscriptions
    const setupSubscriptions = () => {
      try {
        // Subscribe to requests table
        const requestsSub = RealtimeManager.createSubscription(
          'requests',
          (payload) => {
            console.log('🔔 Requests changed:', payload.eventType);
            fetchRequests(true);
          }
        );
        
        // Subscribe to requesters table
        const requestersSub = RealtimeManager.createSubscription(
          'requesters',
          (payload) => {
            console.log('🔔 Requesters changed:', payload.eventType);
            fetchRequests(true);
          }
        );
        
        requestsSubscriptionRef.current = requestsSub;
        requestersSubscriptionRef.current = requestersSub;
      } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
      }
    };
    
    setupSubscriptions();
    
    // Fetch latest data
    fetchRequests(true);
  }, [fetchRequests]);

  return {
    isLoading,
    error,
    refetch: () => fetchRequests(true),
    reconnect
  };
}