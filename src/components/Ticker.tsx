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

      {/* Centered Content Container - matches song container width */}
      <div className="max-w-6xl w-full px-6 relative z-10">
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
          <div className="flex items-center justify-center space-x-8">
            {/* Audio visualizer - left side */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave-left"
                  style={{
                    background: `linear-gradient(to top, ${accentColor}, ${secondaryColor})`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>

            {/* Center content: Album art + Next Up + Song info */}
            <div className="flex flex-col items-center space-y-2">
              {/* Album Art */}
              <div className="relative">
                {nextSong.albumArtUrl ? (
                  <div className="relative">
                    <img
                      src={nextSong.albumArtUrl}
                      alt="Album art"
                      className="w-14 h-14 rounded-xl object-cover"
                      style={{ 
                        boxShadow: `0 0 25px ${accentColor}60`,
                        border: `2px solid ${accentColor}80`
                      }}
                    />
                    {/* Rotating border effect */}
                    <div 
                      className="absolute inset-0 rounded-xl opacity-60"
                      style={{
                        background: `conic-gradient(from 0deg, ${accentColor}, ${secondaryColor}, ${accentColor})`,
                        padding: '1px',
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
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentColor}40, ${secondaryColor}40)`,
                      boxShadow: `0 0 25px ${accentColor}60`,
                      border: `2px solid ${accentColor}80`
                    }}
                  >
                    <Music className="w-7 h-7" style={{ color: accentColor }} />
                  </div>
                )}
                
                {/* Floating equalizer dots */}
                <div className="absolute -right-1 -bottom-1 flex space-x-1">
                  <div className="equalizer-dot" style={{ background: accentColor }} />
                  <div className="equalizer-dot" style={{ background: secondaryColor }} />
                  <div className="equalizer-dot" style={{ background: accentColor }} />
                </div>
              </div>

              {/* Next Up Badge and Song Info */}
              <div className="flex flex-col items-center space-y-1 text-center">
                <span 
                  className="text-xs font-bold tracking-wider px-3 py-1 rounded-full"
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
                
                <div className="flex flex-col items-center space-y-0">
                  <h3 
                    className="text-lg font-bold tracking-wide"
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
                      className="text-sm text-gray-200 font-medium"
                      style={{ textShadow: `0 0 10px ${secondaryColor}40` }}
                    >
                      by {nextSong.artist}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Audio visualizer - right side */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave-right"
                  style={{
                    background: `linear-gradient(to top, ${secondaryColor}, ${accentColor})`,
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

        .equalizer-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          animation: equalizeDot 1.5s ease-in-out infinite;
        }

        .equalizer-dot:nth-child(1) { animation-duration: 1.2s; }
        .equalizer-dot:nth-child(2) { animation-duration: 1.8s; }
        .equalizer-dot:nth-child(3) { animation-duration: 1.4s; }

        @keyframes equalizeDot {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 1; }
        }

        .sound-wave, .sound-wave-left, .sound-wave-right {
          width: 3px;
          height: 16px;
          border-radius: 2px;
          animation: soundWave 1.5s ease-in-out infinite;
        }

        .sound-wave-left:nth-child(1) { animation-delay: 0.4s; height: 12px; }
        .sound-wave-left:nth-child(2) { animation-delay: 0.3s; height: 18px; }
        .sound-wave-left:nth-child(3) { animation-delay: 0.2s; height: 14px; }
        .sound-wave-left:nth-child(4) { animation-delay: 0.1s; height: 20px; }
        .sound-wave-left:nth-child(5) { animation-delay: 0s; height: 16px; }

        .sound-wave-right:nth-child(1) { animation-delay: 0s; height: 16px; }
        .sound-wave-right:nth-child(2) { animation-delay: 0.1s; height: 20px; }
        .sound-wave-right:nth-child(3) { animation-delay: 0.2s; height: 14px; }
        .sound-wave-right:nth-child(4) { animation-delay: 0.3s; height: 18px; }
        .sound-wave-right:nth-child(5) { animation-delay: 0.4s; height: 12px; }

        .sound-wave:nth-child(1) { animation-delay: 0s; }
        .sound-wave:nth-child(2) { animation-delay: 0.15s; }
        .sound-wave:nth-child(3) { animation-delay: 0.3s; }
        .sound-wave:nth-child(4) { animation-delay: 0.45s; }
        .sound-wave:nth-child(5) { animation-delay: 0.6s; }
        .sound-wave:nth-child(6) { animation-delay: 0.75s; }

        @keyframes soundWave {
          0%, 100% { 
            height: 8px; 
            opacity: 0.6; 
            transform: scaleY(0.6);
          }
          50% { 
            height: 24px; 
            opacity: 1; 
            transform: scaleY(1.2);
          }
        }
      `}</style>
    </div>
  );
}