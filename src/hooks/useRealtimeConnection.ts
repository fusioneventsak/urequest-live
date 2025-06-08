import { useState, useEffect, useCallback } from 'react';
import { RealtimeManager } from '../utils/realtimeManager';

/**
 * Custom hook for managing the global Supabase realtime connection
 * with improved error handling and reconnection logic
 */
export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // Initialize connection
  const initialize = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const connected = await RealtimeManager.init();
      setIsConnected(connected);
      
      if (!connected) {
        setConnectionAttempts(prev => prev + 1);
      } else {
        setConnectionAttempts(0);
      }
    } catch (error) {
      console.error('Error initializing realtime connection:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);
  
  // Force reconnection
  const reconnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const connected = await RealtimeManager.reconnect();
      setIsConnected(connected);
      
      if (connected) {
        setConnectionAttempts(0);
      } else {
        setConnectionAttempts(prev => prev + 1);
      }
      
      return connected;
    } catch (error) {
      console.error('Error reconnecting:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsConnected(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);
  
  // Setup connection listener
  useEffect(() => {
    const handleConnectionEvent = (event: string) => {
      if (event === 'connected') {
        setIsConnected(true);
        setConnectionAttempts(0);
        setError(null);
      } else if (event === 'disconnected') {
        setIsConnected(false);
      } else if (event === 'max_attempts_reached') {
        setError(new Error('Maximum connection attempts reached'));
      }
    };
    
    RealtimeManager.addConnectionListener(handleConnectionEvent);
    
    // Initial connection
    initialize();
    
    // Setup network event listeners
    const handleOnline = () => {
      console.log('Network online, reconnecting...');
      reconnect();
    };
    
    const handleOffline = () => {
      console.log('Network offline');
      setIsConnected(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Cleanup
    return () => {
      RealtimeManager.removeConnectionListener(handleConnectionEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initialize, reconnect]);
  
  return {
    isConnected,
    isConnecting,
    error,
    connectionAttempts,
    reconnect,
    initialize
  };
}