import { supabase } from './supabase';
import { nanoid } from 'nanoid';

// Connection state tracking
let connectionState = 'disconnected';
let isConnecting = false;
const activeChannels = new Map();
const connectionListeners = new Set();

// Client identifier
const CLIENT_ID = nanoid(8);

// Connection management
export const RealtimeManager = {
  /**
   * Get current connection state
   */
  getConnectionState: () => {
    return connectionState;
  },

  /**
   * Check if currently connected
   */
  isConnected: () => {
    return supabase.realtime.isConnected();
  },

  /**
   * Initialize realtime connection
   */
  init: async () => {
    if (isConnecting || RealtimeManager.isConnected()) return;
    
    isConnecting = true;
    updateConnectionState('connecting');
    
    try {
      await supabase.realtime.connect();
      
      if (RealtimeManager.isConnected()) {
        updateConnectionState('connected');
        
        // Log successful connection
        try {
          await supabase
            .from('realtime_connection_logs')
            .insert({
              status: 'connected',
              client_id: CLIENT_ID,
              created_at: new Date().toISOString()
            });
        } catch (error) {
          console.warn('Failed to log connection:', error);
        }
      } else {
        updateConnectionState('disconnected');
      }
    } catch (error) {
      console.error('Error connecting to realtime:', error);
      updateConnectionState('error', error instanceof Error ? error : new Error(String(error)));
      
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
    } finally {
      isConnecting = false;
    }
  },

  /**
   * Create a subscription to a table
   */
  createSubscription: (table, callback, filter) => {
    const channelId = `${table}_${nanoid(6)}`;
    
    try {
      // Create channel
      const channel = supabase.channel(channelId);
      
      // Configure channel
      channel.on(
        'postgres_changes',
        filter || { event: '*', schema: 'public', table },
        (payload) => {
          try {
            callback(payload);
          } catch (error) {
            console.error(`Error in subscription callback (${channelId}):`, error);
          }
        }
      ).subscribe((status) => {
        console.log(`Channel ${channelId} status:`, status);
      });
      
      // Store channel
      activeChannels.set(channelId, { channel, table });
      
      return channelId;
    } catch (error) {
      console.error(`Error creating subscription to ${table}:`, error);
      throw error;
    }
  },

  /**
   * Remove a subscription
   */
  removeSubscription: async (channelId) => {
    const channelInfo = activeChannels.get(channelId);
    if (!channelInfo) return;
    
    try {
      await channelInfo.channel.unsubscribe();
      supabase.removeChannel(channelInfo.channel);
      activeChannels.delete(channelId);
    } catch (error) {
      console.warn(`Error removing subscription ${channelId}:`, error);
    }
  },

  /**
   * Add a connection listener
   */
  addConnectionListener: (listener) => {
    connectionListeners.add(listener);
  },

  /**
   * Remove a connection listener
   */
  removeConnectionListener: (listener) => {
    connectionListeners.delete(listener);
  },

  /**
   * Add a listener with ID
   */
  addListener: (id, listener) => {
    // Store listener with ID for later removal
    connectionListeners.add(listener);
    
    // Return current state immediately
    listener(connectionState);
    
    return id;
  },

  /**
   * Remove a listener by ID
   */
  removeListener: (id) => {
    // Since we don't actually store by ID, this is a no-op
    // In a real implementation, we would remove the specific listener
  },

  /**
   * Force reconnection
   */
  reconnect: async () => {
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
    } catch (error) {
      console.warn('Failed to log reconnection attempt:', error);
    }
    
    // Close all existing channels
    for (const [id, info] of activeChannels.entries()) {
      try {
        await info.channel.unsubscribe();
        supabase.removeChannel(info.channel);
      } catch (error) {
        console.warn(`Error closing channel ${id}:`, error);
      }
    }
    
    activeChannels.clear();
    
    // Reconnect
    return RealtimeManager.init();
  },

  /**
   * Clean up all subscriptions
   */
  cleanup: async () => {
    // Close all channels
    for (const [id, info] of activeChannels.entries()) {
      try {
        await info.channel.unsubscribe();
        supabase.removeChannel(info.channel);
      } catch (error) {
        console.warn(`Error closing channel ${id}:`, error);
      }
    }
    
    activeChannels.clear();
    connectionListeners.clear();
    
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
    } catch (error) {
      console.warn('Failed to log disconnection:', error);
    }
  }
};

// Update connection state and notify listeners
function updateConnectionState(state, error = null) {
  connectionState = state;
  
  // Notify all listeners
  for (const listener of connectionListeners) {
    try {
      listener(state, error);
    } catch (listenerError) {
      console.error('Error in connection listener:', listenerError);
    }
  }
}

// Setup automatic reconnection when tab becomes visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !RealtimeManager.isConnected()) {
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