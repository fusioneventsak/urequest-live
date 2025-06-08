// src/hooks/useRequestSync.ts
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { SongRequest } from '../types';

const REQUESTS_CACHE_KEY = 'requests:all';
const FALLBACK_POLLING_INTERVAL = 5000; // Faster polling for requests

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const requestsSubscriptionRef = useRef<string | null>(null);
  const requestersSubscriptionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<number | null>(null);

  // Fetch requests with proper error handling
  const fetchRequests = useCallback(async (bypassCache = false) => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoading(true);

      if (!bypassCache) {
        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests?.length > 0) {
          console.log('Using cached requests');
          onUpdate(cachedRequests);
          setIsLoading(false);
          return;
        }
      }

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

        cacheService.setRequests(REQUESTS_CACHE_KEY, formattedRequests);
        onUpdate(formattedRequests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Fallback to cache
        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedRequests);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onUpdate]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup realtime subscription or fallback polling
  useEffect(() => {
    mountedRef.current = true;
    
    const setupRealtimeOrPolling = async () => {
      if (!isOnline) {
        console.log('Skipping realtime setup while offline');
        return;
      }
      
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Attempt to set up realtime subscriptions
      try {
        // Subscribe to request changes
        const requestsSub = await RealtimeManager.createSubscription(
          'requests',
          async () => {
            console.log('Request update received via realtime');
            await fetchRequests(true);
          }
        );
        
        // Subscribe to requester changes
        const requestersSub = await RealtimeManager.createSubscription(
          'requesters',
          async () => {
            console.log('Requester update received via realtime');
            await fetchRequests(true);
          }
        );
        
        requestsSubscriptionRef.current = requestsSub;
        requestersSubscriptionRef.current = requestersSub;
        setIsRealtime(true);
        
        // Initial fetch
        fetchRequests();
      } catch (error) {
        console.error('Error setting up realtime for requests:', error);
        setIsRealtime(false);
        
        // Fallback to polling
        fetchRequests();
        
        // Setup polling interval
        pollingIntervalRef.current = window.setInterval(() => {
          if (mountedRef.current && isOnline) {
            fetchRequests(true);
          }
        }, FALLBACK_POLLING_INTERVAL);
      }
    };
    
    setupRealtimeOrPolling();
    
    // Listen for connection changes
    const connectionListener = (event: string) => {
      if (event === 'connected' && !isRealtime && isOnline) {
        // Re-establish realtime when connection is restored
        setupRealtimeOrPolling();
      }
    };
    
    RealtimeManager.addConnectionListener(connectionListener);
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      
      // Remove realtime subscriptions
      if (requestsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(requestsSubscriptionRef.current);
        requestsSubscriptionRef.current = null;
      }
      
      if (requestersSubscriptionRef.current) {
        RealtimeManager.removeSubscription(requestersSubscriptionRef.current);
        requestersSubscriptionRef.current = null;
      }
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove connection listener
      RealtimeManager.removeConnectionListener(connectionListener);
    };
  }, [fetchRequests, isOnline, isRealtime]);

  // Force reconnection
  const reconnect = useCallback(async () => {
    console.log('Manual reconnection requested');
    
    // Remove existing subscriptions
    if (requestsSubscriptionRef.current) {
      await RealtimeManager.removeSubscription(requestsSubscriptionRef.current);
      requestsSubscriptionRef.current = null;
    }
    
    if (requestersSubscriptionRef.current) {
      await RealtimeManager.removeSubscription(requestersSubscriptionRef.current);
      requestersSubscriptionRef.current = null;
    }
    
    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setIsRealtime(false);
    
    // Reconnect realtime manager
    await RealtimeManager.reconnect();
    
    // Fetch latest data
    await fetchRequests(true);
    
    return true;
  }, [fetchRequests]);

  return {
    isLoading,
    error,
    isOnline,
    refetch: () => fetchRequests(true),
    reconnect,
    isRealtime
  };
}