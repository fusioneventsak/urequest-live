import React from 'react';
import { useRealtimeConnection } from '../hooks/useRealtimeConnection';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
  showReconnectButton?: boolean;
}

export function ConnectionStatus({ 
  className = '', 
  showReconnectButton = true 
}: ConnectionStatusProps) {
  const { isConnected, isConnecting, reconnect, connectionAttempts } = useRealtimeConnection();
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <div className="flex items-center text-green-400 text-sm">
          <Wifi className="w-4 h-4 mr-1" />
          <span>Connected</span>
        </div>
      ) : (
        <div className="flex items-center text-red-400 text-sm">
          <WifiOff className="w-4 h-4 mr-1" />
          <span>
            {isConnecting 
              ? 'Connecting...' 
              : connectionAttempts > 0 
                ? `Disconnected (${connectionAttempts})` 
                : 'Disconnected'}
          </span>
        </div>
      )}
      
      {showReconnectButton && (
        <button
          onClick={() => reconnect()}
          disabled={isConnecting}
          className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-neon-purple/20 transition-colors"
          title="Reconnect"
        >
          <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}