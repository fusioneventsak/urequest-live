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
      className="h-16 sm:h-20 overflow-hidden w-full border-b border-neon-purple/20 relative flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, 
          rgba(0, 0, 0, 0.85) 0%, 
          rgba(20, 20, 30, 0.9) 25%,
          rgba(15, 15, 25, 0.95) 50%,
          rgba(20, 20, 30, 0.9) 75%,
          rgba(0, 0, 0, 0.85) 100%
        )`,
        backdropFilter: 'blur(20px) saturate(150%)',
        borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
        borderBottom: `1px solid ${accentColor}40`,
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          inset 0 -1px 0 rgba(0, 0, 0, 0.2),
          0 4px 20px rgba(0, 0, 0, 0.3)
        `
      }}
    >
      {/* Enhanced animated background pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 25% 50%, ${accentColor}15 0%, transparent 60%),
            radial-gradient(ellipse at 75% 50%, ${secondaryColor}15 0%, transparent 60%),
            linear-gradient(90deg, 
              transparent 0%, 
              ${accentColor}08 25%, 
              ${secondaryColor}08 50%, 
              ${accentColor}08 75%, 
              transparent 100%
            )
          `,
          animation: 'ambientFlow 12s ease-in-out infinite'
        }}
      />
      
      {/* Realistic glass reflection */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          background: `linear-gradient(
            125deg,
            transparent 0%,
            transparent 30%,
            rgba(255, 255, 255, 0.02) 40%,
            rgba(255, 255, 255, 0.08) 45%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.08) 55%,
            rgba(255, 255, 255, 0.02) 60%,
            transparent 70%,
            transparent 100%
          )`,
          animation: 'glassReflection 8s ease-in-out infinite',
          transform: 'skewX(-20deg)'
        }}
      />

      {/* Secondary subtle reflection */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(
            80deg,
            transparent 0%,
            transparent 60%,
            rgba(255, 255, 255, 0.03) 70%,
            rgba(255, 255, 255, 0.06) 75%,
            rgba(255, 255, 255, 0.03) 80%,
            transparent 90%,
            transparent 100%
          )`,
          animation: 'secondaryReflection 6s ease-in-out infinite reverse'
        }}
      />

      {/* Centered Content Container */}
      <div className="max-w-7xl w-full px-4 sm:px-8 relative z-10">
        {customMessage ? (
          <div className="flex items-center justify-center space-x-3 sm:space-x-4">
            {/* Pulsing icon */}
            <div 
              className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center relative flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
                boxShadow: `0 0 20px ${accentColor}60`,
                animation: 'iconPulse 2s ease-in-out infinite'
              }}
            >
              <Volume2 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              
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
              className="text-center text-lg sm:text-2xl font-bold"
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
              {[...Array(4)].map((_, i) => (
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
          <div className="flex items-center justify-center space-x-4 sm:space-x-8">
            {/* Audio visualizer - left side (hidden on mobile) */}
            <div className="hidden sm:flex items-center space-x-1 flex-shrink-0">
              {[...Array(3)].map((_, i) => (
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

            {/* Center content: Clean layout optimized for mobile */}
            <div className="flex items-center space-x-3 sm:space-x-6 min-w-0 flex-1 justify-center">
              {/* Album Art */}
              <div className="flex-shrink-0">
                {nextSong.albumArtUrl ? (
                  <img
                    src={nextSong.albumArtUrl}
                    alt="Album art"
                    className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg object-cover"
                    style={{ 
                      boxShadow: `0 4px 20px ${accentColor}40`,
                      border: `2px solid ${accentColor}`
                    }}
                  />
                ) : (
                  <div 
                    className="w-10 h-10 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentColor}20, ${secondaryColor}20)`,
                      border: `2px solid ${accentColor}`
                    }}
                  >
                    <Music className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: accentColor }} />
                  </div>
                )}
              </div>

              {/* Song Info - Responsive sizing */}
              <div className="flex flex-col justify-center items-center space-y-1 min-w-0 flex-1">
                {/* Next Up Badge - Always visible, smaller on mobile */}
                <span 
                  className="text-xs font-normal tracking-wide px-2 py-0.5 rounded whitespace-nowrap opacity-90"
                  style={{ 
                    background: `linear-gradient(90deg, ${accentColor}25, ${secondaryColor}25)`,
                    color: 'white',
                    border: `1px solid ${accentColor}40`,
                    fontSize: '10px',
                    lineHeight: '1.2'
                  }}
                >
                  NEXT UP
                </span>

                {/* Song Info - Responsive text sizing */}
                <div className="flex flex-col items-center space-y-0 min-w-0 w-full">
                  <h3 
                    className="font-bold tracking-wide text-white leading-tight text-center truncate w-full"
                    style={{
                      textShadow: `0 2px 10px ${accentColor}60`,
                      fontSize: 'clamp(12px, 4vw, 18px)', // Responsive font size
                      maxWidth: '100%'
                    }}
                  >
                    {nextSong.title}
                  </h3>
                  {nextSong.artist && (
                    <p 
                      className="text-gray-300 font-medium leading-tight text-center truncate w-full"
                      style={{ 
                        textShadow: `0 1px 5px ${secondaryColor}40`,
                        fontSize: 'clamp(10px, 3vw, 14px)', // Responsive font size
                        maxWidth: '100%'
                      }}
                    >
                      {nextSong.artist}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Audio visualizer - right side (hidden on mobile) */}
            <div className="hidden sm:flex items-center space-x-1 flex-shrink-0">
              {[...Array(3)].map((_, i) => (
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
        @keyframes ambientFlow {
          0%, 100% { 
            transform: translateX(-5px) scale(1); 
            opacity: 0.3; 
          }
          33% { 
            transform: translateX(5px) scale(1.02); 
            opacity: 0.4; 
          }
          66% { 
            transform: translateX(-3px) scale(0.98); 
            opacity: 0.35; 
          }
        }

        @keyframes glassReflection {
          0% { 
            transform: translateX(-150%) skewX(-20deg); 
            opacity: 0;
          }
          10% { 
            opacity: 1;
          }
          90% { 
            opacity: 1;
          }
          100% { 
            transform: translateX(250%) skewX(-20deg); 
            opacity: 0;
          }
        }

        @keyframes secondaryReflection {
          0%, 100% { 
            transform: translateX(-100%); 
            opacity: 0;
          }
          50% { 
            transform: translateX(200%); 
            opacity: 0.6;
          }
        }

        @keyframes iconPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px ${accentColor}60; }
          50% { transform: scale(1.1); box-shadow: 0 0 30px ${accentColor}80; }
        }

        @keyframes textShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes ripple {
          0% { 
            transform: scale(1); 
            opacity: 0.6; 
          }
          100% { 
            transform: scale(2); 
            opacity: 0; 
          }
        }

        .sound-wave, .sound-wave-left, .sound-wave-right {
          width: 2px;
          height: 12px;
          border-radius: 1px;
          animation: soundWave 1.8s ease-in-out infinite;
        }

        @media (min-width: 640px) {
          .sound-wave, .sound-wave-left, .sound-wave-right {
            width: 3px;
            height: 20px;
            border-radius: 2px;
          }
        }

        .sound-wave-left:nth-child(1) { animation-delay: 0s; height: 10px; }
        .sound-wave-left:nth-child(2) { animation-delay: 0.15s; height: 16px; }
        .sound-wave-left:nth-child(3) { animation-delay: 0.3s; height: 12px; }

        .sound-wave-right:nth-child(1) { animation-delay: 0.3s; height: 12px; }
        .sound-wave-right:nth-child(2) { animation-delay: 0.15s; height: 16px; }
        .sound-wave-right:nth-child(3) { animation-delay: 0s; height: 10px; }

        @media (min-width: 640px) {
          .sound-wave-left:nth-child(1) { height: 16px; }
          .sound-wave-left:nth-child(2) { height: 22px; }
          .sound-wave-left:nth-child(3) { height: 18px; }

          .sound-wave-right:nth-child(1) { height: 18px; }
          .sound-wave-right:nth-child(2) { height: 22px; }
          .sound-wave-right:nth-child(3) { height: 16px; }
        }

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