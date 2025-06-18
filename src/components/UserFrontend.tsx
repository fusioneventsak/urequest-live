import React, { useState, useMemo, useEffect } from 'react';
import { Search, Music, ThumbsUp, User, AlertTriangle, Music4, Send } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import { Logo } from './shared/Logo';
import { Ticker } from './Ticker';
import { ErrorBoundary } from './shared/ErrorBoundary';
import type { Song, SongRequest, SetList } from '../types';

interface UserFrontendProps {
  songs: Song[];
  requests: SongRequest[];
  activeSetList: SetList | null;
  logoUrl: string;
  onSubmitRequest: (title: string, artist: string, requesterData: { name: string; photo: string; message?: string }) => Promise<void>;
}

export function UserFrontend({ songs, requests, activeSetList, logoUrl, onSubmitRequest }: UserFrontendProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'upvote'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestName, setRequestName] = useState('');
  const { settings } = useUiSettings();

  // Get colors from settings
  const headerBgColor = settings?.frontend_header_bg || '#13091f';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  const songBorderColor = settings?.song_border_color || settings?.frontend_accent_color || '#ff00ff';
  const navBgColor = settings?.nav_bg_color || '#0f051d';
  const highlightColor = settings?.highlight_color || '#ff00ff';

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
      console.log(`Using songs from active set list: ${activeSetList.name} (${activeSetList.songs.length} songs)`);
      return activeSetList.songs;
    }
    console.log(`No active set list, showing all ${songs.length} songs`);
    return songs;
  }, [songs, activeSetList]);

  // Log when active set list changes
  useEffect(() => {
    if (activeSetList) {
      console.log(`Active set list updated in UserFrontend: ${activeSetList.name} (${activeSetList.id})`);
    } else {
      console.log('No active set list in UserFrontend');
    }
  }, [activeSetList]);
  
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

  // Get pending requests sorted by votes
  const pendingRequests = useMemo(() => {
    return requests
      .filter(r => r.status === 'pending' && !r.isLocked && !r.isPlayed)
      .sort((a, b) => b.votes - a.votes);
  }, [requests]);

  // Generate default avatar
  const generateDefaultAvatar = (name: string): string => {
    const initials = name.split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
    
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
      const requesterData = {
        name: requestName.trim(),
        photo: generateDefaultAvatar(requestName.trim()),
        message: requestMessage.trim().slice(0, 100) || '',
      };

      await onSubmitRequest(song.title, song.artist, requesterData);
      setRequestMessage('');
      setRequestName('');
      setSelectedSong(null);
    } catch (error) {
      console.error('Error submitting request:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
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
      <div className="frontend-container min-h-screen flex flex-col">
        {/* Header with logo and band name - same as kiosk but no QR */}
        <header 
          className="px-6 pt-10 pb-4 text-center relative"
          style={{ backgroundColor: headerBgColor }}
        >
          <Logo 
            url={logoUrl}
            className="h-24 mx-auto mb-6"
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

          {activeTab === 'requests' && (
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
          )}
        </div>

        {/* Song list or upvote list */}
        <div className="flex-1 overflow-y-auto px-6 pb-24">
          {activeTab === 'requests' ? (
            filteredSongs.length > 0 ? (
              <div className="space-y-3">
                {filteredSongs.map((song) => (
                  <div 
                    key={song.id}
                    onClick={() => setSelectedSong(song)}
                    className="glass-effect rounded-lg p-4 flex items-center gap-3 transition-all duration-300 cursor-pointer hover:bg-neon-purple/20 active:bg-neon-purple/30"
                    style={{
                      borderColor: songBorderColor,
                      borderWidth: '1px',
                      boxShadow: `0 0 8px ${songBorderColor}30`,
                    }}
                  >
                    {/* Direct image like in kiosk */}
                    <div className="w-16 h-16 flex-shrink-0 relative">
                      {song.albumArtUrl ? (
                        <img
                          src={song.albumArtUrl}
                          alt={`${song.title} album art`}
                          className="w-16 h-16 object-cover rounded-md"
                          style={{ boxShadow: `0 0 10px ${songBorderColor}30` }}
                          onError={(e) => {
                            // Fallback to music icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-16 h-16 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0"
                        style={{ 
                          display: song.albumArtUrl ? 'none' : 'flex',
                          boxShadow: `0 0 10px ${accentColor}30`
                        }}
                      >
                        <Music4 className="w-8 h-8" style={{ color: accentColor }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-xl truncate">{song.title}</h3>
                      <p className="text-gray-300 text-base truncate">{song.artist}</p>
                      {song.genre && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {song.genre.split(',').slice(0, 2).map((genre, i) => (
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
                          {song.genre.split(',').length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{song.genre.split(',').length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSong(song);
                      }}
                      className="px-3 py-1.5 rounded-lg text-white transition-all duration-200 whitespace-nowrap text-sm font-extrabold tracking-wide uppercase transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: accentColor,
                        textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.3)',
                        boxShadow: `0 4px 15px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
                        border: `1px solid rgba(255,255,255,0.1)`,
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`
                      }}
                    >
                      REQUEST
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-gray-400">
                {searchTerm ? (
                  <>No songs found matching <span className="text-white">{searchTerm}</span></>
                ) : (
                  <>No songs available to request</>
                )}
              </div>
            )
          ) : (
            // Upvote tab
            <div className="space-y-3">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((request) => {
                  const matchingSong = songs.find(s => 
                    s.title.toLowerCase() === request.title.toLowerCase() && 
                    (!s.artist || !request.artist || s.artist.toLowerCase() === request.artist.toLowerCase())
                  );
                  
                  return (
                    <div 
                      key={request.id}
                      className="glass-effect rounded-lg p-4 flex items-center gap-3"
                      style={{
                        borderColor: songBorderColor,
                        borderWidth: '1px',
                        boxShadow: `0 0 8px ${songBorderColor}50`,
                      }}
                    >
                      {/* Direct image like in working upvote section */}
                      <div className="w-16 h-16 flex-shrink-0 relative">
                        {matchingSong?.albumArtUrl ? (
                          <img
                            src={matchingSong.albumArtUrl}
                            alt={`${request.title} album art`}
                            className="w-16 h-16 object-cover rounded-md"
                            onError={(e) => {
                              // Fallback to music icon if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="w-16 h-16 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0"
                          style={{ 
                            display: matchingSong?.albumArtUrl ? 'none' : 'flex',
                            boxShadow: `0 0 10px ${accentColor}30`
                          }}
                        >
                          <Music4 className="w-8 h-8" style={{ color: accentColor }} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-lg truncate">{request.title}</h3>
                        <p className="text-gray-300 truncate">{request.artist}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-gray-400">
                            {request.votes} {request.votes === 1 ? 'vote' : 'votes'}
                          </span>
                          <span className="text-sm text-gray-400">
                            {request.requesters.length} {request.requesters.length === 1 ? 'requester' : 'requesters'}
                          </span>
                        </div>
                        {request.requesters.length > 0 && (
                          <div className="flex items-center mt-2">
                            <div className="flex -space-x-2">
                              {request.requesters.slice(0, 3).map((requester, index) => (
                                <div
                                  key={index}
                                  className="w-6 h-6 rounded-full bg-neon-purple/20 border-2 border-darker-purple flex items-center justify-center"
                                >
                                  {requester.photo ? (
                                    <img
                                      src={requester.photo}
                                      alt={requester.name}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-3 h-3 text-gray-400" />
                                  )}
                                </div>
                              ))}
                            </div>
                            {request.requesters.length > 3 && (
                              <span className="ml-2 text-xs text-gray-400">
                                +{request.requesters.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        className="px-2 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 font-semibold flex-shrink-0 text-white text-xs"
                        style={{ 
                          backgroundColor: accentColor,
                          border: `1px solid ${accentColor}`,
                        }}
                        onClick={() => {
                          console.log('Upvote request:', request.id);
                        }}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>UPVOTE</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No active requests to vote on
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation - same as kiosk */}
        <nav 
          className="fixed bottom-0 left-0 right-0 border-t border-neon-purple/20"
          style={{ backgroundColor: navBgColor }}
        >
          <div className="max-w-7xl mx-auto px-4 flex justify-between">
            <button
              onClick={() => setActiveTab('requests')}
              className="flex-1 py-4 flex flex-col items-center space-y-1"
              style={{ color: activeTab === 'requests' ? highlightColor : 'rgb(156 163 175)' }}
            >
              <Music className="w-6 h-6" />
              <span className="text-sm">Requests</span>
            </button>
            <button
              onClick={() => setActiveTab('upvote')}
              className="flex-1 py-4 flex flex-col items-center space-y-1"
              style={{ color: activeTab === 'upvote' ? highlightColor : 'rgb(156 163 175)' }}
            >
              <ThumbsUp className="w-6 h-6" />
              <span className="text-sm">Upvote</span>
            </button>
          </div>
        </nav>

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
                {/* Direct image in modal too */}
                <div className="w-20 h-20 flex-shrink-0 relative">
                  {selectedSong.albumArtUrl ? (
                    <img
                      src={selectedSong.albumArtUrl}
                      alt={`${selectedSong.title} album art`}
                      className="w-20 h-20 object-cover rounded-md"
                      style={{ boxShadow: `0 0 10px ${songBorderColor}50` }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-20 h-20 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0"
                    style={{ 
                      display: selectedSong.albumArtUrl ? 'none' : 'flex',
                      boxShadow: `0 0 10px ${accentColor}30`
                    }}
                  >
                    <Music4 className="w-10 h-10" style={{ color: accentColor }} />
                  </div>
                </div>
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