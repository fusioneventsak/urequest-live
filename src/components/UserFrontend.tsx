import React, { useState, useMemo, useEffect } from 'react';
import { Search, Music, ThumbsUp, User, AlertTriangle } from 'lucide-react';
import { RequestModal } from './RequestModal';
import { Ticker } from './Ticker';
import { AlbumArtDisplay } from './shared/AlbumArtDisplay';
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
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSongSelect = (song: Song) => {
    setSelectedSong(song);
    setIsRequestModalOpen(true);
  };

  const handleRequestSubmit = async (requesterData: { name: string; photo: string; message?: string }) => {
    if (!selectedSong) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitRequest(selectedSong.title, selectedSong.artist, requesterData);
      setIsRequestModalOpen(false);
      setSelectedSong(null);
    } catch (error) {
      console.error('Error submitting request:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get pending requests sorted by votes
  const pendingRequests = useMemo(() => {
    return requests
      .filter(r => r.status === 'pending' && !r.isLocked && !r.isPlayed)
      .sort((a, b) => b.votes - a.votes);
  }, [requests]);

  return (
    <div className="min-h-screen bg-darker-purple text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-darker-purple/95 backdrop-blur-sm border-b border-neon-purple/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <img 
                src={logoUrl} 
                alt="Band Logo" 
                className="h-10 w-auto rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-bold">Song Requests</h1>
            </div>
          </div>

          <nav className="flex space-x-1 bg-neon-purple/10 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'requests'
                  ? 'bg-neon-pink text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-neon-purple/20'
              }`}
            >
              <Music className="w-4 h-4 mr-2 inline" />
              Request Songs
            </button>
            <button
              onClick={() => setActiveTab('upvote')}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'upvote'
                  ? 'bg-neon-pink text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-neon-purple/20'
              }`}
            >
              <ThumbsUp className="w-4 h-4 mr-2 inline" />
              Upvote
              {pendingRequests.length > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-neon-pink rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Ticker */}
        <Ticker
          nextSong={lockedRequest ? {
            title: lockedRequest.title,
            artist: lockedRequest.artist,
            albumArtUrl: lockedSong?.albumArtUrl
          } : undefined}
          customMessage={undefined} // You can add settings?.custom_message here
          isActive={!!lockedRequest}
        />
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {activeTab === 'requests' ? (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search songs by title, artist, or genre..."
                className="w-full pl-10 pr-4 py-3 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
              />
            </div>

            {/* Song list */}
            {filteredSongs.length > 0 ? (
              <div className="space-y-3">
                {filteredSongs.map((song) => (
                  <div 
                    key={song.id}
                    onClick={() => handleSongSelect(song)}
                    className="glass-effect rounded-lg p-4 flex items-center gap-3 transition-all duration-300 cursor-pointer hover:bg-neon-purple/20 active:bg-neon-purple/30"
                  >
                    <AlbumArtDisplay
                      albumArtUrl={song.albumArtUrl}
                      title={song.title}
                      size="md"
                      showAlbumArt={true} // Explicitly show album art on request page
                      imageClassName="neon-border"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-lg truncate">{song.title}</h3>
                      <p className="text-gray-300 truncate">{song.artist}</p>
                      {song.genre && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {song.genre.split(',').slice(0, 3).map((genre, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs rounded-full bg-neon-purple/20 text-gray-300"
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
              <div className="text-center py-16">
                <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-400 mb-2">
                  {searchTerm ? 'No songs found' : 'No songs available'}
                </h3>
                <p className="text-gray-500">
                  {searchTerm 
                    ? 'Try adjusting your search terms'
                    : 'The band hasn\'t added any songs yet'
                  }
                </p>
              </div>
            )}
          </div>
        ) : (
          // Upvote tab
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Current Requests ({pendingRequests.length})
            </h2>
            
            {pendingRequests.length > 0 ? (
              <div className="space-y-3">
                {pendingRequests.map((request) => {
                  const matchingSong = songs.find(s => 
                    s.title.toLowerCase() === request.title.toLowerCase() && 
                    (!s.artist || !request.artist || s.artist.toLowerCase() === request.artist.toLowerCase())
                  );
                  
                  return (
                    <div 
                      key={request.id}
                      className="glass-effect rounded-lg p-4 flex items-center gap-3"
                    >
                      <AlbumArtDisplay
                        albumArtUrl={matchingSong?.albumArtUrl}
                        title={request.title}
                        size="md"
                        showAlbumArt={true} // Explicitly show album art on request page
                        imageClassName="neon-border"
                      />
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
                        className="neon-button-sm"
                        onClick={() => {
                          // Handle upvote logic here
                          console.log('Upvote request:', request.id);
                        }}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <ThumbsUp className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-400 mb-2">No requests to upvote</h3>
                <p className="text-gray-500">Be the first to request a song!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Request Modal */}
      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
        onSubmit={handleRequestSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}