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

// Client identifier
const CLIENT_ID = nanoid(12);

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
          
          // Log successful connection
          try {
            await supabase
              .from('realtime_connection_logs')
              .insert({
                status: 'connected',
                client_id: CLIENT_ID,
                created_at: new Date().toISOString()
              });
          } catch (logError) {
            console.warn('Failed to log connection:', logError);
          }
        } else {
          console.warn(`Failed to establish realtime connection (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
          
          // Log connection failure
          try {
            await supabase
              .from('realtime_connection_logs')
              .insert({
                status: 'error',
                client_id: CLIENT_ID,
                error_message: 'Connection timeout',
                created_at: new Date().toISOString()
              });
          } catch (logError) {
            console.warn('Failed to log connection error:', logError);
          }
          
          // Schedule reconnection
          setTimeout(() => {
            isConnecting = false;
            RealtimeManager.init();
          }, RECONNECTION_DELAY * Math.pow(1.5, connectionAttempts));
        }
      } else {
        console.error('Maximum realtime connection attempts reached');
        notifyListeners('max_attempts_reached');
        
        // Log max attempts reached
        try {
          await supabase
            .from('realtime_connection_logs')
            .insert({
              status: 'error',
              client_id: CLIENT_ID,
              error_message: 'Maximum connection attempts reached',
              created_at: new Date().toISOString()
            });
        } catch (logError) {
          console.warn('Failed to log connection error:', logError);
        }
      }
    } catch (error) {
      console.error('Error establishing realtime connection:', error);
      isConnected = false;
      
      // Log connection error
      try {
        await supabase
          .from('realtime_connection_logs')
          .insert({
            status: 'error',
            client_id: CLIENT_ID,
            error_message: error instanceof Error ? error.message : String(error),
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        console.warn('Failed to log connection error:', logError);
      }
      
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
          retryAfter: 2000,
          timeout: 30000 // 30 seconds
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
      )
      .on('error', (err) => {
        console.error(`Channel error (${subscriptionId}):`, err);
        
        // Log channel error
        try {
          supabase
            .from('realtime_connection_logs')
            .insert({
              status: 'error',
              client_id: CLIENT_ID,
              error_message: `Channel error (${subscriptionId}): ${err.message || JSON.stringify(err)}`,
              created_at: new Date().toISOString()
            })
            .then(() => {})
            .catch(logError => {
              console.warn('Failed to log channel error:', logError);
            });
        } catch (logError) {
          console.warn('Failed to log channel error:', logError);
        }
      })
      .on('system', (event) => {
        console.log(`Channel system event (${subscriptionId}):`, event);
      })
      .on('disconnect', (event) => {
        console.log(`Channel disconnected (${subscriptionId}):`, event);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (activeChannels.has(subscriptionId)) {
            console.log(`Attempting to reconnect channel (${subscriptionId})...`);
            RealtimeManager.removeSubscription(subscriptionId)
              .then(() => RealtimeManager.createSubscription(table, callback, filter))
              .catch(console.error);
          }
        }, 5000);
      });
      
      // Subscribe with improved error handling
      channel.subscribe((status, err) => {
        console.log(`Subscription status (${subscriptionId}):`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log(`Subscription active: ${subscriptionId}`);
          activeChannels.set(subscriptionId, channel);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for ${subscriptionId}:`, err);
          
          // Log channel error
          try {
            supabase
              .from('realtime_connection_logs')
              .insert({
                status: 'error',
                client_id: CLIENT_ID,
                error_message: `Channel error (${subscriptionId}): ${err?.message || JSON.stringify(err)}`,
                created_at: new Date().toISOString()
              })
              .then(() => {})
              .catch(logError => {
                console.warn('Failed to log channel error:', logError);
              });
          } catch (logError) {
            console.warn('Failed to log channel error:', logError);
          }
          
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
      
      // Log subscription error
      try {
        await supabase
          .from('realtime_connection_logs')
          .insert({
            status: 'error',
            client_id: CLIENT_ID,
            error_message: `Error creating subscription (${subscriptionId}): ${error instanceof Error ? error.message : String(error)}`,
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        console.warn('Failed to log subscription error:', logError);
      }
      
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
    
    // Log reconnection attempt
    try {
      await supabase
        .from('realtime_connection_logs')
        .insert({
          status: 'disconnected',
          client_id: CLIENT_ID,
          error_message: 'Manual reconnection requested',
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.warn('Failed to log reconnection attempt:', logError);
    }
    
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
          heartbeat: Date.now(),
          client_id: CLIENT_ID
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
            heartbeat: Date.now(),
            client_id: CLIENT_ID
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
    
    // Log disconnection
    try {
      await supabase
        .from('realtime_connection_logs')
        .insert({
          status: 'disconnected',
          client_id: CLIENT_ID,
          error_message: 'Client disconnected',
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.warn('Failed to log disconnection:', logError);
    }
    
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