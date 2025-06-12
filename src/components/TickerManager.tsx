import React, { useState } from 'react';
import { Play, Pause, Type, Music } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';

interface TickerManagerProps {
  nextSong?: {
    title: string;
    artist?: string;
  };
  isActive: boolean;
  customMessage: string;
  onUpdateMessage: (message: string) => void;
  onToggleActive: () => void;
}

export function TickerManager({ 
  nextSong, 
  isActive, 
  customMessage, 
  onUpdateMessage, 
  onToggleActive 
}: TickerManagerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { updateSettings } = useUiSettings();

  const handleMessageUpdate = async (message: string) => {
    // Update local state immediately for responsive UI
    onUpdateMessage(message);
    
    try {
      setIsUpdating(true);
      // Update database with new message
      await updateSettings({
        custom_message: message,
        ticker_active: message.trim() !== '', // Auto-activate if message exists
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating custom message:', error);
      // Could add toast notification here
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      setIsUpdating(true);
      
      if (isActive) {
        // STOPPING: Clear the message AND deactivate
        onUpdateMessage(''); // Clear local state immediately
        onToggleActive(); // Toggle local active state immediately
        
        // Clear in database
        await updateSettings({
          custom_message: '', // Clear the message
          ticker_active: false, // Deactivate ticker
          updated_at: new Date().toISOString()
        });
      } else {
        // STARTING: Only activate if there's a message
        if (customMessage.trim()) {
          onToggleActive(); // Toggle local active state immediately
          
          await updateSettings({
            custom_message: customMessage,
            ticker_active: true,
            updated_at: new Date().toISOString()
          });
        } else {
          // No message to activate - could show warning
          console.warn('Cannot activate ticker without a custom message');
        }
      }
    } catch (error) {
      console.error('Error toggling custom message:', error);
      // Revert local state on error
      if (isActive) {
        onToggleActive(); // Revert toggle
        onUpdateMessage(customMessage); // Restore message
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const clearMessage = async () => {
    try {
      setIsUpdating(true);
      
      // Clear everything immediately for instant feedback
      onUpdateMessage('');
      if (isActive) {
        onToggleActive();
      }
      
      // Clear in database
      await updateSettings({
        custom_message: '',
        ticker_active: false,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clearing message:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold neon-text">Ticker Management</h2>
        <div className="flex items-center space-x-3">
          {/* Clear Message Button */}
          {(customMessage.trim() || isActive) && (
            <button
              onClick={clearMessage}
              disabled={isUpdating}
              className="neon-button bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
            >
              Clear Message
            </button>
          )}
          
          {/* Start/Stop Button */}
          <button
            onClick={handleToggleActive}
            disabled={isUpdating || (!isActive && !customMessage.trim())}
            className={`neon-button flex items-center disabled:opacity-50 ${
              isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Updating...
              </>
            ) : isActive ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Stop Custom Message
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Custom Message
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass-effect rounded-lg p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Current Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-neon-purple/10">
              <div className="flex items-center space-x-2 mb-2">
                <Music className="w-5 h-5 text-neon-pink" />
                <span className="font-medium text-white">Next Song</span>
              </div>
              {nextSong ? (
                <p className="text-gray-300">
                  {nextSong.title}
                  {nextSong.artist && <span className="text-gray-400"> by {nextSong.artist}</span>}
                </p>
              ) : (
                <p className="text-gray-400 italic">No song locked</p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-neon-purple/10">
              <div className="flex items-center space-x-2 mb-2">
                <Type className="w-5 h-5 text-neon-pink" />
                <span className="font-medium text-white">Custom Message</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                <p className={`${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {isActive ? 'Active' : 'Inactive'}
                </p>
                {isUpdating && (
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Custom Message
          </label>
          <div className="space-y-2">
            <textarea
              value={customMessage}
              onChange={(e) => handleMessageUpdate(e.target.value)}
              placeholder="Enter a custom message to display in the ticker..."
              className="w-full px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink disabled:opacity-50"
              rows={2}
              disabled={isUpdating}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                When active, this message will override the next song information
              </p>
              <p className="text-xs text-gray-500">
                {customMessage.length} characters
              </p>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-neon-pink hover:text-white transition-colors"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          
          {showPreview && (
            <div className="mt-4 p-4 rounded-lg bg-darker-purple border border-neon-purple/20">
              <p className="text-white text-sm">
                <strong>Ticker will display:</strong>
              </p>
              <p className="text-white mt-2" style={{
                fontSize: `${customMessage.length > 60 ? '12px' : '14px'}`,
                fontStyle: (!isActive || !customMessage) ? 'italic' : 'normal'
              }}>
                {isActive && customMessage ? customMessage : (nextSong
                  ? `🎵 Coming Up Next: ${nextSong.title}${nextSong.artist ? ` by ${nextSong.artist}` : ''} 🎵`
                  : 'No content to display'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}