import { useState, useEffect, useRef } from 'react';
import { RealtimeManager } from '../utils/realtimeManager';

/**
 * Custom hook to monitor connection health and auto-reconnect when needed
 */
export function useConnectionHealth() {
  const [status, setStatus] = useState<'good' | 'poor' | 'disconnected'>('good');
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  
  // Update the ref whenever the state changes
  useEffect(() => {
    lastUpdateTimeRef.current = lastUpdateTime;
  }, [lastUpdateTime]);
  
  // Register data update
  const registerUpdate = () => {
    const now = Date.now();
    setLastUpdateTime(now);
    lastUpdateTimeRef.current = now;
    setStatus('good');
  };
  
  // Monitor connection health
  useEffect(() => {
    const healthCheck = setInterval(() => {
      const now = Date.now();
      const lastUpdate = lastUpdateTimeRef.current;
      
      if (now - lastUpdate > 10000) { // No updates for 10 seconds
        setStatus('poor');
        
        // Auto-reconnect if no updates for 15 seconds
        if (now - lastUpdate > 15000) {
          console.warn('No updates received for 15 seconds, attempting reconnection');
          RealtimeManager.reconnect();
          setReconnectAttempts(prev => prev + 1);
        }
      } else {
        setStatus('good');
      }
    }, 5000);
    
    // Listen for connection state changes
    const handleConnectionChange = (state: string) => {
      if (state === 'connected') {
        setStatus('good');
      } else if (state === 'disconnected') {
        setStatus('disconnected');
      } else if (state === 'error') {
        setStatus('poor');
      }
    };
    
    RealtimeManager.addConnectionListener(handleConnectionChange);
    
    return () => {
      clearInterval(healthCheck);
      RealtimeManager.removeConnectionListener(handleConnectionChange);
    };
  }, []);
  
  return {
    status,
    lastUpdateTime,
    reconnectAttempts,
    registerUpdate,
    reconnect: RealtimeManager.reconnect
  };
}