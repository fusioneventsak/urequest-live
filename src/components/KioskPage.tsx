import React, { useState, useEffect, useMemo } from 'react';
import { Music4, Search, AlertTriangle, Send, ThumbsUp, Music } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useUiSettings } from '../hooks/useUiSettings';
import { Logo } from './shared/Logo';
import { Ticker } from './Ticker';
import { LoadingSpinner } from './shared/LoadingSpinner';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { UpvoteList } from './UpvoteList';
import QRCode from 'qrcode.react';
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
  const [activeTab, setActiveTab] = useState<'requests' | 'upvote'>('requests');
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
        setSelectedSong(null);
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
    }
  };

  // Handle upvoting
  const handleVote = async (requestId: string) => {
    try {
      setIsSubmitting(true);

      // Directly increment votes in database without validation
      // since kiosk mode doesn't track voters
      const { data, error: getError } = await supabase
        .from('requests')
        .select('votes')
        .eq('id', requestId)
        .single();
        
      if (getError) throw getError;
      
      // Update votes count
      const currentVotes = data?.votes || 0;
      const { error: updateError } = await supabase
        .from('requests')
        .update({ votes: currentVotes + 1 })
        .eq('id', requestId);
        
      if (updateError) throw updateError;
        
      toast.success('Vote added!');
    } catch (error) {
      console.error('Error voting for request:', error);
      toast.error('Failed to vote for this request. Please try again.');
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

  // Get current URL for QR code
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <ErrorBoundary>
      <div className="frontend-container min-h-screen flex flex-col">
        {/* Header with logo and band name */}
        <header 
          className="px-6 pt-10 pb-4 text-center relative"
          style={{ backgroundColor: headerBgColor }}
        >
          {settings?.show_qr_code && (
            <div className="absolute right-4 top-4 p-2 bg-white rounded-lg shadow-md">
              <QRCode 
                value={currentUrl} 
                size={100} 
                bgColor="#ffffff"
                fgColor="#000000"
                level="L"
                includeMargin={false}
              />
              <div className="text-black text-xs mt-1 text-center font-medium">
                Scan to Request
              </div>
            </div>
          )}
          
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
          {isSubmitting && !selectedSong ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg\" message="Processing..." />
            </div>
          ) : activeTab === 'requests' ? (
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
                        e.stopPropagation(); // Prevent triggering the parent div's onClick
                        setSelectedSong(song);
                      }}
                      className="px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap text-sm font-extrabold tracking-wide uppercase"
                      style={{
                        backgroundColor: accentColor,
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
            // Upvote list tab content
            <div className="space-y-3">
              {requests.filter(r => !r.isPlayed).length > 0 ? (
                requests
                  .filter(r => !r.isPlayed)
                  .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                  .map((request) => (
                    <div
                      key={request.id}
                      className="glass-effect rounded-lg p-4 relative overflow-hidden transition-all duration-300 flex items-center cursor-pointer hover:bg-neon-purple/20 active:bg-neon-purple/30"
                      style={{
                        borderColor: songBorderColor,
                        borderWidth: '1px',
                        boxShadow: `0 0 8px ${songBorderColor}50`,
                      }}
                      onClick={() => handleVote(request.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-lg truncate">
                          {request.title}
                        </h3>
                        {request.artist && (
                          <p className="text-gray-300 text-sm truncate mb-2">{request.artist}</p>
                        )}
                        
                        {/* Requesters section */}
                        {request.requesters && request.requesters.length > 0 && (
                          <div className="flex items-center gap-1">
                            {request.requesters.slice(0, 3).map((requester, index) => (
                              <div 
                                key={`${requester.id}-${index}`}
                                className="flex-shrink-0"
                                title={requester.name}
                              >
                                <img
                                  src={requester.photo}
                                  alt={requester.name}
                                  className="w-6 h-6 rounded-full border"
                                  style={{ borderColor: accentColor }}
                                  onError={(e) => {
                                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                                  }}
                                />
                              </div>
                            ))}
                            {request.requesters.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{request.requesters.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-2">
                        <div 
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${accentColor}20` }}
                        >
                          <span className="text-xs" style={{ color: accentColor }}>
                            {request.votes || 0}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the parent div's onClick
                            handleVote(request.id);
                          }}
                          disabled={isSubmitting}
                          className={`px-2 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 font-semibold flex-shrink-0 text-white text-xs ${
                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          style={{ 
                            backgroundColor: accentColor,
                            border: `1px solid ${accentColor}`,
                          }}
                          title="Upvote this request"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>UPVOTE</span>
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No active requests to vote on
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
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