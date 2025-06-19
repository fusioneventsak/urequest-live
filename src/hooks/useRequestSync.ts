import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import type { SongRequest } from '../types';

const CACHE_DURATION = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

interface CachedData {
  data: SongRequest[];
  timestamp: number;
}

export function useRequestSync(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const subscriptionRef = useRef<any>(null);
  const fetchInProgressRef = useRef<boolean>(false);
  const cacheRef = useRef<CachedData | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Optimized fetch with caching and deduplication
  const fetchRequests = useCallback(async (bypassCache = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      return;
    }
    
    // Check cache first
    if (!bypassCache && cacheRef.current) {
      const { data, timestamp } = cacheRef.current;
      const age = Date.now() - timestamp;
      
      if (age < CACHE_DURATION && data.length > 0) {
        if (mountedRef.current) {
          onUpdate(data);
          setIsLoading(false);
        }
        return;
      }
    }
    
    fetchInProgressRef.current = true;
    
    try {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);

      // Use the optimized database function for better performance
      const { data: requestsData, error: requestsError } = await supabase
        .rpc('get_requests_with_votes');

      if (requestsError) throw requestsError;

      if (!requestsData) {
        const emptyResult: SongRequest[] = [];
        if (mountedRef.current) {
          onUpdate(emptyResult);
          cacheRef.current = { data: emptyResult, timestamp: Date.now() };
        }
        return;
      }

      // Fetch requesters separately for active requests only
      const requestIds = requestsData.map(r => r.id);
      let requestersData: any[] = [];
      
      if (requestIds.length > 0) {
        const { data: reqData, error: reqError } = await supabase
          .from('requesters')
          .select('id, request_id, name, photo, message, created_at')
          .in('request_id', requestIds)
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;
        requestersData = reqData || [];
      }

      // Group requesters by request_id for efficient lookup
      const requestersByRequestId = requestersData.reduce((acc, requester) => {
        if (!acc[requester.request_id]) {
          acc[requester.request_id] = [];
        }
        acc[requester.request_id].push({
          name: requester.name,
          photo: requester.photo,
          message: requester.message,
          timestamp: new Date(requester.created_at)
        });
        return acc;
      }, {} as Record<string, any[]>);

      // Transform to SongRequest format
      const transformedRequests: SongRequest[] = requestsData.map(request => ({
        id: request.id,
        title: request.title,
        artist: request.artist || '',
        requesters: requestersByRequestId[request.id] || [],
        votes: request.votes || 0,
        status: request.status as any,
        isLocked: request.is_locked || false,
        isPlayed: request.is_played || false,
        createdAt: new Date(request.created_at)
      }));

      if (mountedRef.current) {
        onUpdate(transformedRequests);
        cacheRef.current = { data: transformedRequests, timestamp: Date.now() };
        lastUpdateRef.current = Date.now();
        setRetryCount(0);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      if (mountedRef.current) {
        setError(error as Error);
        
        // Retry logic with exponential backoff
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchRequests(true);
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

  // Setup real-time subscription with debouncing
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const setupSubscription = () => {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      // Subscribe to requests changes
      subscriptionRef.current = supabase
        .channel('requests_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests'
          },
          (payload) => {
            console.log('📡 Request change detected:', payload.eventType);
            
            // Debounce rapid changes
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(() => {
              const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
              
              // Only refetch if enough time has passed or it's a critical change
              if (timeSinceLastUpdate > 2000 || payload.eventType === 'DELETE') {
                fetchRequests(true);
              }
            }, 500);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requesters'
          },
          (payload) => {
            console.log('📡 Requester change detected:', payload.eventType);
            
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(() => {
              fetchRequests(true);
            }, 300);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_votes'
          },
          (payload) => {
            console.log('📡 Vote change detected:', payload.eventType);
            
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(() => {
              fetchRequests(true);
            }, 200);
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time subscription active');
          }
        });
    };

    setupSubscription();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchRequests]);

  // Initial fetch
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Manual refresh function
  const refresh = useCallback(() => {
    cacheRef.current = null;
    fetchRequests(true);
  }, [fetchRequests]);

  return {
    isLoading,
    error,
    refresh,
    retryCount
  };
}