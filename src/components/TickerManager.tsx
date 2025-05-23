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
  const { updateSettings } = useUiSettings();

  const handleMessageUpdate = async (message: string) => {
    onUpdateMessage(message);
    try {
      await updateSettings({
        custom_message: message,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating custom message:', error);
    }
  };

  const handleToggleActive = async () => {
    onToggleActive();
    try {
      await updateSettings({
        custom_message: isActive ? '' : customMessage,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error toggling custom message:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold neon-text">Ticker Management</h2>
        <button
          onClick={handleToggleActive}
          className={`neon-button flex items-center ${
            isActive ? 'bg-red-500 hover:bg-red-600' : ''
          }`}
        >
          {isActive ? (
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
              <p className={`${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </p>
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
              className="w-full px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
              rows={2}
            />
            <p className="text-sm text-gray-400">
              When active, this message will override the next song information
            </p>
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
              <p className="text-white">
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