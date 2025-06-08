import { useState, useEffect } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook to track and manage Supabase realtime connection status
 */
export function useRealtimeConnection() {
  const [connectionStatus, setConnectionStatus] = useState<string>(
    realtimeManager.getConnectionState()
  );
  const [error, setError] = useState<Error | null>(null);
  const [lastReconnectTime, setLastReconnectTime] = useState<Date | null>(null);

  useEffect(() => {
    const listenerId = `connection-listener-${uuidv4()}`;
    
    // Register listener for connection status updates
    realtimeManager.addListener(listenerId, (status, err) => {
      setConnectionStatus(status);
      
      if (err) {
        setError(err);
      } else if (status === 'connected') {
        setError(null);
      }
      
      if (status === 'connecting') {
        setLastReconnectTime(new Date());
      }
    });
    
    // Cleanup on unmount
    return () => {
      realtimeManager.removeListener(listenerId);
    };
  }, []);
  
  // Function to manually trigger reconnection
  const reconnect = () => {
    realtimeManager.reconnect();
    setLastReconnectTime(new Date());
  };
  
  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    hasError: connectionStatus === 'error',
    error,
    lastReconnectTime,
    reconnect
  };
}