import { supabase } from './supabase';
import { nanoid } from 'nanoid';

// Connection state tracking
let isConnected = false;
let isConnecting = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 2000;
const activeChannels: Map<string, any> = new Map();
const pendingSubscriptions: Map<string, Function[]> = new Map();
const globalListeners: Set<Function> = new Set();

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
let heartbeatTimer: NodeJS.Timeout | null = null;

// Connection management
export const RealtimeManager = {
  /**
   * Initialize a single realtime connection for the application
   */
  init: async () => {
    if (isConnected || isConnecting) return isConnected;
    
    isConnecting = true;
    console.log('Initializing realtime connection...');
    
    try {
      // Configure realtime client
      supabase.realtime.setAuth(supabase.auth.session()?.access_token || null);
      
      // Only try to connect if we haven't exceeded attempts
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        connectionAttempts++;
        await supabase.realtime.connect();
        
        // Wait for connection to establish
        const connected = await waitForConnection(5000);
        isConnected = connected;
        
        if (connected) {
          console.log('Realtime connection established');
          connectionAttempts = 0; // Reset counter on success
          
          // Process any pending subscriptions
          processPendingSubscriptions();
          
          // Notify listeners
          notifyListeners('connected');
          
          // Start heartbeat
          startHeartbeat();
        } else {
          console.warn(`Failed to establish realtime connection (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
          
          // Schedule reconnection
          setTimeout(() => {
            isConnecting = false;
            RealtimeManager.init();
          }, RECONNECTION_DELAY * Math.pow(1.5, connectionAttempts));
        }
      } else {
        console.error('Maximum realtime connection attempts reached');
        notifyListeners('max_attempts_reached');
      }
    } catch (error) {
      console.error('Error establishing realtime connection:', error);
      isConnected = false;
      
      // Schedule reconnection
      setTimeout(() => {
        isConnecting = false;
        RealtimeManager.init();
      }, RECONNECTION_DELAY * Math.pow(1.5, connectionAttempts));
    } finally {
      isConnecting = false;
    }
    
    return isConnected;
  },
  
  /**
   * Create a channel subscription with proper connection management
   */
  createSubscription: async (
    table: string,
    callback: (payload: any) => void,
    filter?: any
  ): Promise<string> => {
    // Generate unique subscription ID
    const subscriptionId = `${table}_${nanoid(8)}`;
    
    // Initialize connection if needed
    if (!isConnected) {
      // Add to pending subscriptions
      if (!pendingSubscriptions.has(subscriptionId)) {
        pendingSubscriptions.set(subscriptionId, []);
      }
      pendingSubscriptions.get(subscriptionId)?.push(callback);
      
      // Try to establish connection
      await RealtimeManager.init();
      
      // If still not connected, return ID for future processing
      if (!isConnected) {
        return subscriptionId;
      }
    }
    
    // Create channel
    try {
      const channel = supabase.channel(subscriptionId, {
        config: {
          broadcast: { self: true },
          presence: { key: subscriptionId },
        },
      });
      
      // Configure channel with proper filter
      const channelFilter = filter || { event: '*', schema: 'public', table };
      
      channel.on(
        'postgres_changes',
        channelFilter,
        (payload) => {
          try {
            callback(payload);
          } catch (error) {
            console.error(`Error in subscription callback (${subscriptionId}):`, error);
          }
        }
      );
      
      // Subscribe with improved error handling
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscription active: ${subscriptionId}`);
          activeChannels.set(subscriptionId, channel);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for ${subscriptionId}:`, err);
          
          // Attempt to recreate subscription after delay
          setTimeout(() => {
            if (activeChannels.has(subscriptionId)) {
              RealtimeManager.removeSubscription(subscriptionId);
              RealtimeManager.createSubscription(table, callback, filter);
            }
          }, 5000);
        } else if (status === 'CLOSED') {
          console.log(`Channel closed: ${subscriptionId}`);
          activeChannels.delete(subscriptionId);
        }
      });
      
      return subscriptionId;
    } catch (error) {
      console.error(`Error creating subscription (${subscriptionId}):`, error);
      throw error;
    }
  },
  
  /**
   * Safely remove a subscription
   */
  removeSubscription: async (subscriptionId: string): Promise<void> => {
    try {
      const channel = activeChannels.get(subscriptionId);
      if (channel) {
        await channel.unsubscribe();
        supabase.removeChannel(channel);
        activeChannels.delete(subscriptionId);
        console.log(`Subscription removed: ${subscriptionId}`);
      }
      
      // Also remove any pending subscription
      pendingSubscriptions.delete(subscriptionId);
    } catch (error) {
      console.warn(`Error removing subscription (${subscriptionId}):`, error);
    }
  },
  
  /**
   * Add a global listener for connection events
   */
  addConnectionListener: (listener: Function): void => {
    globalListeners.add(listener);
  },
  
  /**
   * Remove a global listener
   */
  removeConnectionListener: (listener: Function): void => {
    globalListeners.delete(listener);
  },
  
  /**
   * Get connection status
   */
  isConnected: () => isConnected,
  
  /**
   * Force reconnection
   */
  reconnect: async (): Promise<boolean> => {
    if (isConnecting) return false;
    
    // Close all existing channels
    for (const [id, channel] of activeChannels.entries()) {
      try {
        await channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn(`Error closing channel ${id}:`, err);
      }
    }
    
    activeChannels.clear();
    isConnected = false;
    connectionAttempts = 0;
    
    // Stop heartbeat
    stopHeartbeat();
    
    // Attempt to reconnect
    return await RealtimeManager.init();
  },
  
  /**
   * Send a heartbeat to keep the connection alive
   */
  sendHeartbeat: async (): Promise<boolean> => {
    if (!isConnected) return false;
    
    try {
      // Use a simple presence update as a heartbeat
      const heartbeatChannel = activeChannels.values().next().value;
      
      if (heartbeatChannel && typeof heartbeatChannel.track === 'function') {
        await heartbeatChannel.track({
          heartbeat: Date.now()
        });
        console.log('Heartbeat sent successfully');
        return true;
      }
      
      // If no channels exist, create a temporary one for heartbeat
      if (activeChannels.size === 0) {
        const tempChannel = supabase.channel('heartbeat_' + nanoid(4));
        await tempChannel.subscribe();
        
        // Send heartbeat
        if (typeof tempChannel.track === 'function') {
          await tempChannel.track({
            heartbeat: Date.now()
          });
        }
        
        // Clean up temporary channel
        setTimeout(async () => {
          await tempChannel.unsubscribe();
          supabase.removeChannel(tempChannel);
        }, 1000);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Error sending heartbeat:', error);
      return false;
    }
  },
  
  /**
   * Remove all subscriptions and disconnect
   */
  cleanup: async (): Promise<void> => {
    // Stop heartbeat
    stopHeartbeat();
    
    // Unsubscribe all channels
    for (const [id, channel] of activeChannels.entries()) {
      try {
        await channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn(`Error closing channel ${id}:`, err);
      }
    }
    
    activeChannels.clear();
    pendingSubscriptions.clear();
    globalListeners.clear();
    isConnected = false;
    isConnecting = false;
    connectionAttempts = 0;
  }
};

// Helper function to wait for connection
async function waitForConnection(timeout: number = 5000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (supabase.realtime.isConnected()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

// Process pending subscriptions after connection is established
function processPendingSubscriptions(): void {
  for (const [id, callbacks] of pendingSubscriptions.entries()) {
    const [table] = id.split('_');
    
    for (const callback of callbacks) {
      RealtimeManager.createSubscription(table, callback).catch(console.error);
    }
  }
  
  pendingSubscriptions.clear();
}

// Notify all global listeners of connection events
function notifyListeners(event: string): void {
  for (const listener of globalListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in connection listener:', error);
    }
  }
}

// Start heartbeat mechanism
function startHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  
  heartbeatTimer = setInterval(() => {
    if (isConnected) {
      RealtimeManager.sendHeartbeat().catch(error => {
        console.warn('Heartbeat error:', error);
        
        // If heartbeat fails, check connection and potentially reconnect
        if (!supabase.realtime.isConnected()) {
          console.log('Connection appears to be down, attempting to reconnect...');
          RealtimeManager.reconnect();
        }
      });
    }
  }, HEARTBEAT_INTERVAL);
}

// Stop heartbeat mechanism
function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// Setup automatic reconnection when tab becomes visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isConnected) {
      console.log('Document became visible, reconnecting...');
      RealtimeManager.init();
    }
  });
}

// Setup automatic reconnection when network comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network came online, reconnecting...');
    RealtimeManager.init();
  });
}