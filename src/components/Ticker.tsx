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
      className="h-20 overflow-hidden w-full border-b border-neon-purple/20 relative"
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

      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-center relative z-10">
        {customMessage ? (
          <div className="flex items-center space-x-4 w-full">
            {/* Pulsing icon */}
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center relative"
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
              className="text-center text-2xl font-bold flex-1"
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
          </div>
        ) : nextSong && (
          <div className="flex items-center space-x-6 w-full">
            <div className="relative">
              {nextSong.albumArtUrl ? (
                <div className="relative">
                  <img
                    src={nextSong.albumArtUrl}
                    alt="Album art"
                    className="w-16 h-16 rounded-xl object-cover"
                    style={{ 
                      boxShadow: `0 0 25px ${accentColor}60`,
                      border: `2px solid ${accentColor}80`
                    }}
                  />
                  {/* Rotating border effect */}
                  <div 
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: `conic-gradient(from 0deg, ${accentColor}, ${secondaryColor}, ${accentColor})`,
                      padding: '2px',
                      animation: 'rotateBorder 4s linear infinite'
                    }}
                  >
                    <div 
                      className="w-full h-full rounded-xl"
                      style={{ background: 'transparent' }}
                    />
                  </div>
                </div>
              ) : (
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center relative"
                  style={{ 
                    background: `linear-gradient(135deg, ${accentColor}40, ${secondaryColor}40)`,
                    boxShadow: `0 0 25px ${accentColor}60`,
                    border: `2px solid ${accentColor}80`
                  }}
                >
                  <Music className="w-8 h-8" style={{ color: accentColor }} />
                </div>
              )}
              
              {/* Floating equalizer bars */}
              <div className="absolute -right-2 -bottom-2 flex space-x-1">
                <div className="equalizer-bar" style={{ background: accentColor }} />
                <div className="equalizer-bar" style={{ background: secondaryColor }} />
                <div className="equalizer-bar" style={{ background: accentColor }} />
                <div className="equalizer-bar" style={{ background: secondaryColor }} />
              </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-1">
                <span 
                  className="text-sm font-bold tracking-wider px-3 py-1 rounded-full"
                  style={{ 
                    background: `linear-gradient(90deg, ${accentColor}30, ${secondaryColor}30)`,
                    color: accentColor,
                    border: `1px solid ${accentColor}50`,
                    boxShadow: `0 0 15px ${accentColor}30`,
                    animation: 'badgePulse 2s ease-in-out infinite'
                  }}
                >
                  ♪ NEXT UP ♪
                </span>
                <Volume2 
                  className="w-5 h-5"
                  style={{ 
                    color: accentColor,
                    filter: `drop-shadow(0 0 8px ${accentColor})`
                  }}
                />
              </div>
              <div className="flex items-baseline space-x-3">
                <h3 
                  className="text-xl font-bold tracking-wide"
                  style={{
                    background: `linear-gradient(90deg, white, ${accentColor}, white)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: `0 0 20px ${accentColor}60`
                  }}
                >
                  {nextSong.title}
                </h3>
                {nextSong.artist && (
                  <p 
                    className="text-base text-gray-200 font-medium"
                    style={{ textShadow: `0 0 10px ${secondaryColor}40` }}
                  >
                    by {nextSong.artist}
                  </p>
                )}
              </div>
            </div>

            {/* Sound waves visualization */}
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave"
                  style={{
                    background: `linear-gradient(to top, ${accentColor}, ${secondaryColor})`,
                    animationDelay: `${i * 0.1}s`
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

        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes textShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes rotateBorder {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes badgePulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }

        .equalizer-bar {
          width: 3px;
          height: 12px;
          border-radius: 2px;
          animation: equalize 1.5s steps(4, end) infinite;
        }

        .equalizer-bar:nth-child(1) { animation-duration: 1.2s; }
        .equalizer-bar:nth-child(2) { animation-duration: 1.8s; }
        .equalizer-bar:nth-child(3) { animation-duration: 1.4s; }
        .equalizer-bar:nth-child(4) { animation-duration: 1.6s; }

        @keyframes equalize {
          0% { height: 4px; }
          25% { height: 12px; }
          50% { height: 8px; }
          75% { height: 16px; }
          100% { height: 4px; }
        }

        .sound-wave {
          width: 4px;
          height: 20px;
          border-radius: 2px;
          animation: soundWave 1.5s ease-in-out infinite;
        }

        .sound-wave:nth-child(1) { animation-delay: 0s; }
        .sound-wave:nth-child(2) { animation-delay: 0.1s; }
        .sound-wave:nth-child(3) { animation-delay: 0.2s; }
        .sound-wave:nth-child(4) { animation-delay: 0.3s; }
        .sound-wave:nth-child(5) { animation-delay: 0.4s; }

        @keyframes soundWave {
          0%, 100% { height: 8px; opacity: 0.6; }
          50% { height: 24px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}