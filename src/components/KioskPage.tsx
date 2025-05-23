import React, { useState, useEffect, useMemo } from 'react';
import { Music4, Search, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useUiSettings } from '../hooks/useUiSettings';
import { Logo } from './shared/Logo';
import { Ticker } from './Ticker';
import { LoadingSpinner } from './shared/LoadingSpinner';
import { ErrorBoundary } from './shared/ErrorBoundary';
import toast from 'react-hot-toast';
import type { Song, SongRequest } from '../types';

interface KioskPageProps {
  songs: Song[];
  requests: SongRequest[];
  activeSetList: {
    id: string;
    name: string;
    songs: Song[];
  } | null;
  logoUrl: string;
  onSubmitRequest: (data: any) => Promise<boolean>;
}

export function KioskPage({
  songs,
  requests,
  activeSetList,
  logoUrl,
  onSubmitRequest
}: KioskPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestName, setRequestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { settings } = useUiSettings();

  // Get colors from settings
  const headerBgColor = settings?.frontend_header_bg || '#13091f';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  const songBorderColor = settings?.song_border_color || settings?.frontend_accent_color || '#ff00ff';

  // Get the locked request for the ticker
  const lockedRequest = useMemo(() => {
    return requests.find(r => r.isLocked && !r.isPlayed);
  }, [requests]);
  
  // Find the corresponding song to get the album art
  const lockedSong = useMemo(() => {
    if (!lockedRequest) return null;
    return songs.find(s => 
      s.title.toLowerCase() === lockedRequest.title.toLowerCase() && 
      (!s.artist || !lockedRequest.artist || s.artist.toLowerCase() === lockedRequest.artist.toLowerCase())
    );
  }, [lockedRequest, songs]);

  // Get available songs - if active set list exists, only show songs from that set list
  const availableSongs = useMemo(() => {
    if (activeSetList && activeSetList.songs && activeSetList.songs.length > 0) {
      return activeSetList.songs;
    }
    return songs;
  }, [songs, activeSetList]);

  // Filter available songs based on search term
  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) return availableSongs;
    
    const searchLower = searchTerm.toLowerCase();
    return availableSongs.filter(song => {
      return (
        song.title.toLowerCase().includes(searchLower) ||
        song.artist.toLowerCase().includes(searchLower) ||
        (song.genre?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [availableSongs, searchTerm]);

  // Generate default avatar
  const generateDefaultAvatar = (name: string): string => {
    // Generate a simple SVG with the user's initials
    const initials = name.split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
    
    // Random pastel background color
    const hue = Math.floor(Math.random() * 360);
    const bgColor = `hsl(${hue}, 70%, 80%)`;
    const textColor = '#333';
      
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
        <rect width="100" height="100" fill="${bgColor}" />
        <text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" 
              fill="${textColor}" text-anchor="middle" dominant-baseline="central">${initials}</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // Handle song request
  const handleRequestSong = async (song: Song) => {
    if (!requestName.trim()) {
      setError('Please enter your name before requesting a song');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const requestData = {
        title: song.title,
        artist: song.artist || '',
        requestedBy: requestName.trim(),
        userPhoto: generateDefaultAvatar(requestName.trim()),
        message: requestMessage.trim().slice(0, 100) || '',
      };

      const success = await onSubmitRequest(requestData);
      if (success) {
        toast.success('Your request has been added to the queue!');
        setRequestMessage(''); // Clear the message field after successful submission
        setRequestName(''); // Clear the name field after successful submission
      } else {
        throw new Error('Failed to submit request');
      }
    } catch (error) {
      console.error('Error in kiosk request:', error);
      
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Too many requests. Please try again later.';
        } else if (error.message.includes('already requested')) {
          // We're allowing duplicate requests on kiosk, so this shouldn't happen
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setSelectedSong(null);
    }
  };

  // Reset error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <ErrorBoundary>
      <div className="frontend-container min-h-screen max-h-screen overflow-hidden flex flex-col">
        {/* Header with logo and band name */}
        <header 
          className="px-6 pt-6 pb-4 text-center"
          style={{ backgroundColor: headerBgColor }}
        >
          <Logo 
            url={logoUrl}
            className="h-24 mx-auto mb-2"
          />
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: accentColor, textShadow: `0 0 10px ${accentColor}` }}
          >
            {settings?.band_name || 'Band Request Hub'}
          </h1>
          
          {activeSetList && (
            <div className="mb-2 inline-flex items-center py-1 px-4 rounded-full"
              style={{ 
                backgroundColor: `${accentColor}15`,
                border: `1px solid ${accentColor}30`
              }}
            >
              <span className="text-sm" style={{ color: accentColor }}>
                Now playing songs from: <span className="font-bold">{activeSetList.name}</span>
              </span>
            </div>
          )}
        </header>

        {/* Ticker for next song */}
        <Ticker 
          nextSong={lockedRequest ? {
            title: lockedRequest.title,
            artist: lockedRequest.artist,
            albumArtUrl: lockedSong?.albumArtUrl
          } : undefined}
          customMessage={settings?.custom_message}
          isActive={!!settings?.custom_message || !!lockedRequest}
        />

        {/* Main content area */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs by title, artist, or genre..."
              className="w-full pl-10 pr-4 py-3 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
            />
          </div>
        </div>

        {/* Song list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isSubmitting ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" message="Submitting request..." />
            </div>
          ) : filteredSongs.length > 0 ? (
            <div className="space-y-3">
              {filteredSongs.map((song) => (
                <div 
                  key={song.id}
                  className="glass-effect rounded-lg p-4 flex items-center gap-3 cursor-pointer transition-all duration-300"
                  style={{
                    borderColor: songBorderColor,
                    borderWidth: '1px',
                    boxShadow: `0 0 8px ${songBorderColor}30`,
                  }}
                  onClick={() => setSelectedSong(song)}
                >
                  {song.albumArtUrl ? (
                    <img
                      src={song.albumArtUrl}
                      alt={`${song.title} album art`}
                      className="w-16 h-16 object-cover rounded-md"
                      style={{ boxShadow: `0 0 10px ${songBorderColor}30` }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const container = e.currentTarget.parentElement;
                        if (container) {
                          const fallback = document.createElement('div');
                          fallback.className = "w-16 h-16 rounded-md flex items-center justify-center bg-neon-purple/20";
                          fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
                          container.prepend(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md flex items-center justify-center bg-neon-purple/20">
                      <Music4 
                        className="w-8 h-8" 
                        style={{ color: accentColor }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-xl truncate">{song.title}</h3>
                    <p className="text-gray-300 text-base truncate">{song.artist}</p>
                    {song.genre && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {song.genre.split(',').map((genre, i) => (
                          <span 
                            key={i} 
                            className="px-2 py-0.5 text-xs rounded-full truncate"
                            style={{
                              backgroundColor: `${accentColor}20`,
                              color: accentColor,
                            }}
                          >
                            {genre.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-400">
              {searchTerm ? (
                <>No songs found matching "<span className="text-white">{searchTerm}</span>"</>
              ) : (
                <>No songs available to request</>
              )}
            </div>
          )}
        </div>

        {/* Request modal */}
        {selectedSong && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSong(null)} />
            <div className="relative glass-effect rounded-lg p-6 w-full max-w-lg">
              <button
                onClick={() => setSelectedSong(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-4">Request Song</h2>

              <div className="flex items-start space-x-4 mb-6">
                {selectedSong.albumArtUrl ? (
                  <img
                    src={selectedSong.albumArtUrl}
                    alt={`${selectedSong.title} album art`}
                    className="w-20 h-20 object-cover rounded-lg"
                    style={{ boxShadow: `0 0 10px ${songBorderColor}50` }}
                  />
                ) : (
                  <div 
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${accentColor}20` }}
                  >
                    <Music4 
                      className="w-10 h-10" 
                      style={{ color: accentColor }}
                    />
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-white text-lg">{selectedSong.title}</h3>
                  <p className="text-gray-300 text-base">{selectedSong.artist || 'Unknown Artist'}</p>
                  {selectedSong.genre && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedSong.genre.split(',').map((genre, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs rounded-full"
                          style={{ 
                            backgroundColor: `${accentColor}20`,
                            color: accentColor
                          }}
                        >
                          {genre.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Your Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                    required
                    maxLength={50}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Message for the band (optional, max 100 characters)
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value.slice(0, 100))}
                    className="w-full px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                    placeholder="Add a message..."
                    rows={2}
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {requestMessage.length}/100 characters
                  </p>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setSelectedSong(null)}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRequestSong(selectedSong)}
                    disabled={isSubmitting || !requestName.trim()}
                    className="px-4 py-2 rounded-lg text-white transition-colors whitespace-nowrap flex items-center space-x-2 disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}