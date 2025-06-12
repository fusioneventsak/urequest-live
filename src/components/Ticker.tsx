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
      className="h-20 overflow-hidden w-full border-b border-neon-purple/20 relative flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${accentColor}25, ${secondaryColor}25, ${accentColor}15)`,
      }}
    >
      {/* Animated background pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, ${accentColor}30 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, ${secondaryColor}30 0%, transparent 50%),
            linear-gradient(90deg, transparent 0%, ${accentColor}10 50%, transparent 100%)
          `,
          animation: 'tickerFlow 8s ease-in-out infinite'
        }}
      />
      
      {/* Reflective sweep animation */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(
            110deg,
            transparent 0%,
            transparent 40%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.2) 55%,
            rgba(255, 255, 255, 0.1) 60%,
            transparent 70%,
            transparent 100%
          )`,
          animation: 'reflectiveSweep 4s ease-in-out infinite'
        }}
      />

      {/* Centered Content Container - extra wide for horizontal layout */}
      <div className="max-w-8xl w-full px-12 relative z-10">
        {customMessage ? (
          <div className="flex items-center justify-center space-x-4">
            {/* Pulsing icon */}
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center relative flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
                boxShadow: `0 0 20px ${accentColor}60`,
                animation: 'iconPulse 2s ease-in-out infinite'
              }}
            >
              <Volume2 className="w-6 h-6 text-white" />
              
              {/* Ripple effect */}
              <div 
                className="absolute inset-0 rounded-full border-2 opacity-60"
                style={{
                  borderColor: accentColor,
                  animation: 'ripple 2s ease-out infinite'
                }}
              />
            </div>
            
            <div 
              className="text-center text-2xl font-bold"
              style={{
                background: `linear-gradient(90deg, ${accentColor}, white, ${secondaryColor})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: `0 0 30px ${accentColor}80`,
                animation: 'textShimmer 3s ease-in-out infinite'
              }}
            >
              {customMessage}
            </div>

            {/* Audio visualizer bars */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave"
                  style={{
                    background: `linear-gradient(to top, ${accentColor}, ${secondaryColor})`,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          </div>
        ) : nextSong && (
            <div className="flex items-center justify-center space-x-12">
            {/* Audio visualizer - left side */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave-left"
                  style={{
                    background: `linear-gradient(to top, ${accentColor}, ${secondaryColor})`,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>

            {/* Center content: Clean vertical layout for mobile */}
            <div className="flex items-center space-x-6">
              {/* Bigger Album Art with Accent Border */}
              <div className="flex-shrink-0">
                {nextSong.albumArtUrl ? (
                  <img
                    src={nextSong.albumArtUrl}
                    alt="Album art"
                    className="w-16 h-16 rounded-lg object-cover"
                    style={{ 
                      boxShadow: `0 4px 20px ${accentColor}40`,
                      border: `2px solid ${accentColor}`
                    }}
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentColor}20, ${secondaryColor}20)`,
                      border: `2px solid ${accentColor}`
                    }}
                  >
                    <Music className="w-7 h-7" style={{ color: accentColor }} />
                  </div>
                )}
              </div>

              {/* Compact Badge + Song Info Stacked - Centered */}
              <div className="flex flex-col justify-center items-center space-y-2 min-w-0">
                {/* Song Info Above - Centered */}
                <div className="flex flex-col items-center -space-y-1">
                  <h3 
                    className="text-xl font-bold tracking-wide whitespace-nowrap text-white leading-tight text-center"
                    style={{
                      textShadow: `0 2px 10px ${accentColor}60`
                    }}
                  >
                    {nextSong.title}
                  </h3>
                  {nextSong.artist && (
                    <p 
                      className="text-sm text-gray-300 font-medium whitespace-nowrap leading-tight text-center"
                      style={{ textShadow: `0 1px 5px ${secondaryColor}40` }}
                    >
                      {nextSong.artist}
                    </p>
                  )}
                </div>

                {/* Tiny Next Up Badge Below - Centered */}
                <span 
                  className="text-xs font-normal tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap opacity-80"
                  style={{ 
                    background: `linear-gradient(90deg, ${accentColor}20, ${secondaryColor}20)`,
                    color: 'white',
                    border: `1px solid ${accentColor}30`,
                    fontSize: '10px'
                  }}
                >
                  NEXT UP
                </span>
              </div>
            </div>

            {/* Audio visualizer - right side */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave-right"
                  style={{
                    background: `linear-gradient(to top, ${secondaryColor}, ${accentColor})`,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes tickerFlow {
          0%, 100% { transform: translateX(-10px) scale(1); opacity: 0.8; }
          50% { transform: translateX(10px) scale(1.05); opacity: 1; }
        }

        @keyframes reflectiveSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px ${accentColor}60; }
          50% { transform: scale(1.1); box-shadow: 0 0 30px ${accentColor}80; }
        }

        @keyframes textShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .sound-wave, .sound-wave-left, .sound-wave-right {
          width: 3px;
          height: 20px;
          border-radius: 2px;
          animation: soundWave 1.8s ease-in-out infinite;
        }

        .sound-wave-left:nth-child(1) { animation-delay: 0s; height: 16px; }
        .sound-wave-left:nth-child(2) { animation-delay: 0.15s; height: 22px; }
        .sound-wave-left:nth-child(3) { animation-delay: 0.3s; height: 18px; }
        .sound-wave-left:nth-child(4) { animation-delay: 0.45s; height: 24px; }

        .sound-wave-right:nth-child(1) { animation-delay: 0.45s; height: 24px; }
        .sound-wave-right:nth-child(2) { animation-delay: 0.3s; height: 18px; }
        .sound-wave-right:nth-child(3) { animation-delay: 0.15s; height: 22px; }
        .sound-wave-right:nth-child(4) { animation-delay: 0s; height: 16px; }

        @keyframes soundWave {
          0%, 100% { 
            transform: scaleY(0.4);
            opacity: 0.7; 
          }
          50% { 
            transform: scaleY(1);
            opacity: 1; 
          }
        }
      `}</style>
    </div>
  );
}