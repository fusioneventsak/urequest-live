import React from 'react';
import { Music, Volume2 } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';

interface TickerProps {
  nextSong?: {
    title: string;
    artist?: string;
    albumArtUrl?: string;
  };
  customMessage?: string;
  isActive?: boolean;
}

export function Ticker({ nextSong, customMessage, isActive = true }: TickerProps) {
  const { settings } = useUiSettings();
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  const secondaryColor = settings?.frontend_secondary_accent || '#9d00ff';

  // Don't render anything if not active or no content
  if (!isActive || (!customMessage && !nextSong)) {
    return null;
  }

  return (
    <div 
      className="h-14 overflow-hidden w-full border-b border-neon-purple/20"
      style={{
        background: `linear-gradient(90deg, ${accentColor}20, ${secondaryColor}20, ${accentColor}20)`
      }}
    >
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-center">
        {customMessage ? (
          <div 
            className="text-center text-xl font-bold animate-pulse"
            style={{
              background: `linear-gradient(90deg, ${accentColor}, ${secondaryColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: `0 0 10px ${accentColor}50`,
            }}
          >
            {customMessage}
          </div>
        ) : nextSong && (
          <div className="flex items-center space-x-4">
            <div className="relative">
              {nextSong.albumArtUrl ? (
                <img
                  src={nextSong.albumArtUrl}
                  alt="Album art"
                  className="w-12 h-12 rounded-lg object-cover"
                  style={{ 
                    boxShadow: `0 0 10px ${accentColor}50`,
                    border: `2px solid ${accentColor}50`
                  }}
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${accentColor}20, ${secondaryColor}20)`,
                    boxShadow: `0 0 10px ${accentColor}50`,
                    border: `2px solid ${accentColor}50`
                  }}
                >
                  <Music className="w-6 h-6" style={{ color: accentColor }} />
                </div>
              )}
              <div className="absolute -right-1 -bottom-1 flex space-x-0.5">
                <div className="equalizer-bar" style={{ background: accentColor }} />
                <div className="equalizer-bar" style={{ background: secondaryColor }} />
                <div className="equalizer-bar" style={{ background: accentColor }} />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span 
                  className="text-xs font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{ 
                    background: `linear-gradient(90deg, ${accentColor}20, ${secondaryColor}20)`,
                    color: accentColor,
                    border: `1px solid ${accentColor}30`
                  }}
                >
                  NEXT UP
                </span>
                <Volume2 
                  className="w-4 h-4 animate-pulse"
                  style={{ color: accentColor }}
                />
              </div>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {nextSong.title}
                </h3>
                {nextSong.artist && (
                  <p className="text-sm text-gray-200">by {nextSong.artist}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .equalizer-bar {
          width: 2px;
          height: 8px;
          border-radius: 1px;
          animation: equalize 1.2s steps(4, end) infinite;
        }

        .equalizer-bar:nth-child(1) { animation-duration: 1.2s; }
        .equalizer-bar:nth-child(2) { animation-duration: 1.1s; }
        .equalizer-bar:nth-child(3) { animation-duration: 1.3s; }

        @keyframes equalize {
          0% { height: 3px; }
          50% { height: 8px; }
          100% { height: 3px; }
        }
      `}</style>
    </div>
  );
}