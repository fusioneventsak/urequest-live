import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { RealtimeManager } from '../utils/realtimeManager';

interface ConnectionStatusProps {
  showDetails?: boolean;
  showReconnectButton?: boolean;
  className?: string;
}

export function ConnectionStatus({ 
  showDetails = false, 
  showReconnectButton = true,
  className = ''
}: ConnectionStatusProps) {
  const [connectionStatus, setConnectionStatus] = React.useState<string>(
    RealtimeManager.getConnectionState()
  );
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastReconnectTime, setLastReconnectTime] = React.useState<Date | null>(null);

  // Listen for connection status changes
  React.useEffect(() => {
    const handleConnectionChange = (status: string, err?: Error) => {
      setConnectionStatus(status);
      setIsConnecting(status === 'connecting');
      setHasError(status === 'error');
      
      if (err) {
        setError(err);
      } else if (status === 'connected') {
        setError(null);
      }
    };
    
    // Get initial status
    handleConnectionChange(RealtimeManager.getConnectionState());
    
    // Add listener
    RealtimeManager.addConnectionListener(handleConnectionChange);
    
    return () => {
      RealtimeManager.removeConnectionListener(handleConnectionChange);
    };
  }, []);

  // Handle reconnect button click
  const handleReconnect = () => {
    setIsConnecting(true);
    setLastReconnectTime(new Date());
    
    RealtimeManager.reconnect()
      .catch(err => {
        console.error('Reconnection error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsConnecting(false);
      });
  };

  // Only render the minimal component when details are not requested
  if (!showDetails) {
    return (
      <div className={`flex items-center ${className}`}>
        {connectionStatus === 'connected' ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : isConnecting ? (
          <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}
      </div>
    );
  }

  return (
    <div className={`glass-effect rounded-lg p-3 my-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {connectionStatus === 'connected' ? (
            <div className="flex items-center text-green-400">
              <Wifi className="w-5 h-5 mr-2" />
              <span className="font-medium">Connected</span>
            </div>
          ) : isConnecting ? (
            <div className="flex items-center text-yellow-400">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              <span className="font-medium">Connecting...</span>
            </div>
          ) : hasError ? (
            <div className="flex items-center text-red-400">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span className="font-medium">Connection Error</span>
            </div>
          ) : (
            <div className="flex items-center text-red-400">
              <WifiOff className="w-5 h-5 mr-2" />
              <span className="font-medium">Disconnected</span>
            </div>
          )}
        </div>
        
        {showReconnectButton && (
          <button
            onClick={handleReconnect}
            disabled={isConnecting}
            className={`px-3 py-1 rounded text-xs flex items-center ${
              isConnecting 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-neon-purple/20 text-neon-pink hover:bg-neon-purple/30'
            }`}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isConnecting ? 'animate-spin' : ''}`} />
            Reconnect
          </button>
        )}
      </div>
      
      {hasError && error && (
        <div className="mt-2 px-3 py-2 bg-red-500/10 rounded text-red-400 text-xs">
          {error.message}
        </div>
      )}
      
      {lastReconnectTime && (
        <div className="mt-1 text-xs text-gray-400">
          Last reconnect attempt: {lastReconnectTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}