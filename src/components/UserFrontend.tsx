import React, { useState, useEffect, useMemo } from 'react';
import { Music4, ThumbsUp, UserCircle } from 'lucide-react';
import { Logo } from './shared/Logo';
import { SongList } from './SongList';
import { UpvoteList } from './UpvoteList';
import { RequestModal } from './RequestModal';
import { LandingPage } from './LandingPage';
import { Ticker } from './Ticker';
import { useUiSettings } from '../hooks/useUiSettings';
import type { Song, SongRequest, User } from '../types';

interface UserFrontendProps {
  songs: Song[];
  requests: SongRequest[];
  activeSetList: {
    id: string;
    name: string;
    songs: Song[];
  } | null;
  currentUser: User;
  onSubmitRequest: (data: any) => Promise<boolean>;
  onVoteRequest: (id: string) => Promise<boolean>;
  onUpdateUser: (user: User) => void;
  logoUrl: string;
  isAdmin: boolean;
  onLogoClick: () => void;
  onBackendAccess: () => void;
}

export function UserFrontend({
  songs,
  requests,
  activeSetList,
  currentUser,
  onSubmitRequest,
  onVoteRequest,
  onUpdateUser,
  logoUrl,
  isAdmin,
  onLogoClick,
  onBackendAccess
}: UserFrontendProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'upvote'>('requests');
  const { settings } = useUiSettings();

  // Get colors from settings
  const navBgColor = settings?.nav_bg_color || '#0f051d';
  const highlightColor = settings?.highlight_color || '#ff00ff';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

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
      // Debug album art in setlist songs
      console.log('UserFrontend setlist songs with album art:', activeSetList.songs.filter(s => s.albumArtUrl).length);
      console.log('UserFrontend first setlist song:', activeSetList.songs[0]);
      return activeSetList.songs;
    }
    console.log(`No active set list, showing all ${songs.length} songs`);
    console.log('UserFrontend all songs with album art:', songs.filter(s => s.albumArtUrl).length);
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

  const handleProfileUpdate = (updatedUser: User) => {
    onUpdateUser(updatedUser);
    setIsEditingProfile(false);
  };

  // Show profile editing page when isEditingProfile is true OR no currentUser
  if (isEditingProfile || !currentUser || !currentUser.name) {
    return (
      <LandingPage 
        onComplete={handleProfileUpdate}
        initialUser={currentUser}
      />
    );
  }

  return (
    <div className="frontend-container min-h-screen">
      {/* Header */}
      <header 
        className="border-b border-neon-purple/20"
        style={{ backgroundColor: navBgColor }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-12">
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="user-profile flex items-center group"
              title="Edit Profile"
            >
              <img 
                src={currentUser.photo} 
                alt={currentUser.name} 
                className="w-6 h-6 rounded-full object-cover border-2 group-hover:border-opacity-100 border-opacity-75 transition-all"
                style={{ borderColor: highlightColor }}
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                }}
              />
              <div 
                className="user-profile-badge opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: highlightColor }}
              >
                <UserCircle className="w-3 h-3" />
              </div>
            </button>

            <Logo 
              url={logoUrl}
              onClick={onLogoClick}
              className="h-8"
            />

            {isAdmin && (
              <button
                onClick={onBackendAccess}
                className="admin-access-button"
                style={{ 
                  borderColor: accentColor,
                  color: accentColor 
                }}
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker
        nextSong={lockedRequest ? {
          title: lockedRequest.title,
          artist: lockedRequest.artist,
          albumArtUrl: lockedSong?.albumArtUrl
        } : undefined}
        customMessage={settings?.custom_message}
        isActive={!!settings?.custom_message || !!lockedRequest}
      />

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6">
        {/* Tab navigation */}
        <nav className="mb-6">
          <div className="tab-container">
            <button
              onClick={() => setActiveTab('requests')}
              className={`tab ${activeTab === 'requests' ? 'tab-active' : 'tab-inactive'}`}
              style={activeTab === 'requests' ? { 
                backgroundColor: highlightColor,
                borderColor: highlightColor 
              } : {}}
            >
              <Music4 className="tab-icon" />
              Request Songs
            </button>
            <button
              onClick={() => setActiveTab('upvote')}
              className={`tab ${activeTab === 'upvote' ? 'tab-active' : 'tab-inactive'}`}
              style={activeTab === 'upvote' ? { 
                backgroundColor: highlightColor,
                borderColor: highlightColor 
              } : {}}
            >
              <ThumbsUp className="tab-icon" />
              Upvote Requests
            </button>
          </div>
        </nav>

        {/* Tab content */}
        <div className="pb-20">
          {activeTab === 'requests' ? (
            <>
              {/* Search bar */}
              <div className="relative px-4 mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search songs by title, artist, or genre..."
                  className="w-full pl-4 pr-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                />
              </div>

              {filteredSongs.length > 0 ? (
                <SongList 
                  songs={filteredSongs}
                  onSongSelect={handleSongSelect}
                />
              ) : (
                <div className="text-center p-8 text-gray-400">
                  {searchTerm ? (
                    <>No songs found matching "<span className='text-white'>{searchTerm}</span>"</>
                  ) : (
                    <>No songs available to request</>
                  )}
                </div>
              )}
            </>
          ) : (
            <UpvoteList 
              requests={requests}
              onVote={onVoteRequest}
              currentUserId={currentUser.id || currentUser.name}
            />
          )}
        </div>
      </main>

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
            <Music4 className="w-6 h-6" />
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

      {/* Request Modal */}
      {selectedSong && (
        <RequestModal
          isOpen={isRequestModalOpen}
          onClose={() => {
            setIsRequestModalOpen(false);
            setSelectedSong(null);
          }}
          song={selectedSong}
          onSubmit={onSubmitRequest}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}