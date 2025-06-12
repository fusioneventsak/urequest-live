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

      {/* Centered Content Container - extra wide for horizontal layout */}
      <div className="max-w-8xl w-full px-12 relative z-10">
        {customMessage ? (
          <div className="flex items-center justify-center space-x-2">
            {/* Micro pulsing icon for mobile */}
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center relative flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${secondaryColor})`,
                boxShadow: `0 0 10px ${accentColor}40`,
                animation: 'iconPulse 2s ease-in-out infinite'
              }}
            >
              <Volume2 className="w-3 h-3 text-white" />
            </div>
            
            <div 
              className="text-center font-bold flex-1"
              style={{
                background: `linear-gradient(90deg, ${accentColor}, white, ${secondaryColor})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: `0 0 15px ${accentColor}50`,
                animation: 'textShimmer 3s ease-in-out infinite',
                fontSize: `${customMessage.length > 100 ? '6px' : 
                            customMessage.length > 90 ? '7px' : 
                            customMessage.length > 80 ? '8px' : 
                            customMessage.length > 70 ? '9px' : 
                            customMessage.length > 60 ? '10px' : 
                            customMessage.length > 50 ? '11px' :
                            customMessage.length > 40 ? '12px' :
                            customMessage.length > 30 ? '13px' :
                            customMessage.length > 25 ? '14px' :
                            customMessage.length > 20 ? '16px' :
                            customMessage.length > 15 ? '18px' :
                            customMessage.length > 10 ? '20px' : '22px'}`,
                maxWidth: 'calc(100vw - 50px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '1.0',
                letterSpacing: `${customMessage.length > 70 ? '-1px' : 
                               customMessage.length > 50 ? '-0.5px' : 
                               customMessage.length > 30 ? '0px' : '0.3px'}`,
                fontWeight: `${customMessage.length > 60 ? '600' : '700'}`
              }}
            >
              {customMessage}
            </div>

            {/* Ultra-compact audio visualizer */}
            <div className="flex items-center flex-shrink-0">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="sound-wave"
                  style={{
                    background: `linear-gradient(to top, ${accentColor}, ${secondaryColor})`,
                    animationDelay: `${i * 0.3}s`,
                    width: '2px',
                    height: '12px',
                    marginRight: i === 0 ? '1px' : '0'
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

              {/* Compact Badge + Song Info Stacked - Mobile Optimized */}
              <div className="flex flex-col justify-center items-center space-y-1.5 min-w-0">
                {/* Tiny Next Up Badge Above - Mobile Safe */}
                <span 
                  className="text-xs font-normal tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap opacity-80 flex-shrink-0"
                  style={{ 
                    background: `linear-gradient(90deg, ${accentColor}20, ${secondaryColor}20)`,
                    color: 'white',
                    border: `1px solid ${accentColor}30`,
                    fontSize: '9px'
                  }}
                >
                  NEXT UP
                </span>

                {/* Song Info Below - Mobile Responsive */}
                <div className="flex flex-col items-center -space-y-1">
                  <h3 
                    className="font-bold tracking-wide text-white leading-tight text-center whitespace-nowrap"
                    style={{
                      textShadow: `0 2px 10px ${accentColor}60`,
                      fontSize: `${nextSong.title.length > 40 ? '10px' : 
                                  nextSong.title.length > 30 ? '12px' : 
                                  nextSong.title.length > 25 ? '14px' :
                                  nextSong.title.length > 20 ? '15px' : 
                                  nextSong.title.length > 15 ? '16px' : '18px'}`,
                      maxWidth: 'calc(100vw - 250px)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {nextSong.title}
                  </h3>
                  {nextSong.artist && (
                    <p 
                      className="text-gray-300 font-medium leading-tight text-center whitespace-nowrap"
                      style={{ 
                        textShadow: `0 1px 5px ${secondaryColor}40`,
                        fontSize: `${nextSong.artist.length > 35 ? '8px' : 
                                    nextSong.artist.length > 25 ? '9px' :
                                    nextSong.artist.length > 20 ? '10px' :
                                    nextSong.artist.length > 15 ? '11px' : '12px'}`,
                        maxWidth: 'calc(100vw - 250px)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {nextSong.artist}
                    </p>
                  )}
                </div>
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

        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
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