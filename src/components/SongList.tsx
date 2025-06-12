import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Music4 } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import type { Song } from '../types';

interface SongListProps {
  songs: Song[];
  onSongSelect: (song: Song) => void;
}

export function SongList({ songs, onSongSelect }: SongListProps) {
  const { settings } = useUiSettings();
  const songBorderColor = settings?.song_border_color || settings?.frontend_accent_color || '#ff00ff';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  const secondaryColor = settings?.frontend_secondary_accent || '#9d00ff';
  const containerRef = useRef<HTMLDivElement>(null);
  const songRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [scrollProgress, setScrollProgress] = useState(0);

  // Intersection observer for scroll animation
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          // Optional: remove the class when out of view
          // entry.target.classList.remove('in-view');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, options);
    
    // Observe all song elements
    songRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, [songs.length]);

  // Track scroll position for parallax effects
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const currentScroll = window.scrollY;
            const progress = (currentScroll / maxScroll) * 100;
            setScrollProgress(progress);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ref callback for song elements
  const setSongRef = useCallback((element: HTMLDivElement | null, id: string) => {
    if (element) {
      songRefs.current.set(id, element);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="grid gap-2 w-full relative p-4"
    >
      {songs.map((song) => (
        <button
          key={song.id}
          ref={(el) => setSongRef(el as HTMLDivElement, song.id)}
          onClick={() => onSongSelect(song)} 
          className="w-full text-left relative group"
        >
          <div 
            className="glass-effect animate-on-scroll rounded-lg p-4 border transition-all duration-300 relative overflow-hidden h-[88px] flex items-center"
            style={{
              borderColor: songBorderColor,
              boxShadow: `0 0 8px ${songBorderColor}50`,
              background: `linear-gradient(135deg, 
                rgba(255, 255, 255, 0.1), 
                rgba(255, 255, 255, 0.05), 
                rgba(255, 255, 255, 0.02)
              )`,
            }}
          >

            <div className="relative flex items-center gap-3 w-full">
              {song.albumArtUrl ? (
                <img
                  src={song.albumArtUrl}
                  alt={`${song.title} album art`}
                  className="w-12 h-12 object-cover rounded-md neon-border flex-shrink-0"
                  style={{
                    boxShadow: `0 0 10px ${songBorderColor}30`,
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const container = e.currentTarget.parentElement;
                    if (container) {
                      const fallback = document.createElement('div');
                      fallback.className = "w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0";
                      const icon = document.createElement('div');
                      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
                      fallback.appendChild(icon);
                      container.prepend(fallback);
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0"
                  style={{
                    boxShadow: `0 0 10px ${songBorderColor}30`,
                  }}
                >
                  <Music4 className="w-6 h-6 text-neon-pink" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{song.title}</h3>
                <p className="text-gray-300 text-sm truncate">{song.artist}</p>
                {song.genre && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {song.genre.split(',').slice(0, 2).map((genre, index) => (
                      <span
                        key={index}
                        className="px-1.5 py-0.5 text-xs rounded-full truncate"
                        style={{
                          backgroundColor: `${accentColor}20`,
                          color: accentColor,
                        }}
                      >
                        {genre.trim()}
                      </span>
                    ))}
                    {song.genre.split(',').length > 2 && (
                      <span className="text-xs text-gray-400">+{song.genre.split(',').length - 2}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSongSelect(song);
                  }}
                  className="px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap text-sm font-extrabold tracking-wide uppercase"
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  REQUEST
                </button>
              </div>
            </div>
          </div>
        </button>
      ))}

      {songs.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          No songs available to request
        </div>
      )}
    </div>
  );
}