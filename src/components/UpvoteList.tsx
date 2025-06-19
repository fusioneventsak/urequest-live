import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Music4, ThumbsUp, UserCircle } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import type { SongRequest } from '../types';
import toast from 'react-hot-toast';

interface UpvoteListProps {
  requests: SongRequest[];
  onVote: (id: string) => Promise<boolean>;
  currentUserId: string;
}

export function UpvoteList({ requests, onVote, currentUserId }: UpvoteListProps) {
  const { settings } = useUiSettings();
  const songBorderColor = settings?.song_border_color || settings?.frontend_accent_color || '#ff00ff';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  const secondaryColor = settings?.frontend_secondary_accent || '#9d00ff';
  const [votingStates, setVotingStates] = useState<Set<string>>(new Set());

  // DEBUG: Log what we receive
  console.log('🔍 UpvoteList received:', {
    requestsLength: requests?.length || 0,
    requests: requests?.map(r => ({
      id: r.id,
      title: r.title,
      isPlayed: r.isPlayed,
      votes: r.votes,
      requesters: r.requesters?.length || 0
    })) || []
  });

  // Simple filtering - just show requests that aren't marked as played
  const activeRequests = useMemo(() => {
    if (!requests || !Array.isArray(requests)) {
      console.log('⚠️ No requests or not an array:', requests);
      return [];
    }

    // Filter out played requests, but be more lenient about the condition
    const filtered = requests.filter(request => {
      const isActive = !request.isPlayed && request.isPlayed !== true;
      console.log(`Request "${request.title}": isPlayed=${request.isPlayed}, isActive=${isActive}`);
      return isActive;
    });

    console.log('✅ Filtered active requests:', filtered.length);

    // Sort by votes (highest first), then by locked status
    return filtered.sort((a, b) => {
      // Locked requests go first
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
      
      // Then by votes (descending)
      return (b.votes || 0) - (a.votes || 0);
    });
  }, [requests]);

  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId || votingStates.has(id)) {
      console.log('Vote blocked:', { currentUserId, isVoting: votingStates.has(id) });
      return;
    }

    setVotingStates(prev => new Set([...prev, id]));

    try {
      console.log('Attempting to vote for request:', id);
      const success = await onVote(id);
      
      if (success) {
        toast.success('Vote recorded!');
      } else {
        toast.error('You have already voted for this request');
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to vote. Please try again.');
    } finally {
      setVotingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Always show debug info at the top
  return (
    <div className="space-y-4 p-4">
      {/* DEBUG INFO */}
      <div className="bg-gray-800 p-3 rounded text-xs text-gray-300">
        <div>Total requests: {requests?.length || 0}</div>
        <div>Active requests: {activeRequests.length}</div>
        <div>Current user: {currentUserId || 'None'}</div>
        {requests?.length > 0 && (
          <div className="mt-2">
            <div>All requests:</div>
            {requests.map(r => (
              <div key={r.id} className="ml-2">
                • {r.title} (played: {r.isPlayed ? 'yes' : 'no'}, votes: {r.votes || 0})
              </div>
            ))}
          </div>
        )}
      </div>

      {activeRequests.length === 0 ? (
        <div className="text-center py-12">
          <Music4 className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <p className="text-gray-400 text-lg">No active requests to vote on</p>
          <p className="text-gray-500 text-sm mt-2">
            {requests?.length > 0 
              ? `Found ${requests.length} total requests, but none are active for voting`
              : 'No requests found - be the first to request a song!'
            }
          </p>
        </div>
      ) : (
        activeRequests.map((request) => {
          const isVoting = votingStates.has(request.id);
          const requesters = Array.isArray(request.requesters) ? request.requesters : [];
          const mainRequester = requesters[0];
          const additionalCount = Math.max(0, requesters.length - 1);

          return (
            <div
              key={request.id}
              className={`
                relative overflow-hidden rounded-xl p-6 transition-all duration-300
                ${request.isLocked 
                  ? 'bg-gradient-to-r from-purple-900/40 to-pink-900/40 ring-2 ring-purple-400' 
                  : 'bg-gray-900/80 hover:bg-gray-800/80'
                }
                backdrop-blur-sm border border-gray-700/50
              `}
              style={{
                borderColor: request.isLocked ? accentColor : undefined,
                boxShadow: request.isLocked ? `0 0 20px ${accentColor}20` : undefined
              }}
            >
              {/* Locked indicator */}
              {request.isLocked && (
                <div className="absolute top-2 right-2">
                  <span 
                    className="px-2 py-1 text-xs font-semibold rounded-full"
                    style={{ 
                      backgroundColor: `${accentColor}20`, 
                      color: accentColor,
                      border: `1px solid ${accentColor}40`
                    }}
                  >
                    NEXT UP
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* Song info */}
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  {mainRequester?.photo ? (
                    <img
                      src={mainRequester.photo}
                      alt={`${mainRequester.name}'s photo`}
                      className="w-12 h-12 rounded-full object-cover border-2"
                      style={{ borderColor: songBorderColor }}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center border-2"
                      style={{ borderColor: songBorderColor, backgroundColor: `${accentColor}20` }}
                    >
                      <UserCircle className="w-8 h-8" style={{ color: accentColor }} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-lg truncate">
                      {request.title}
                    </h3>
                    {request.artist && (
                      <p className="text-gray-300 truncate">by {request.artist}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-400">
                        {mainRequester?.name || 'Anonymous'}
                      </span>
                      {additionalCount > 0 && (
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                          +{additionalCount} more
                        </span>
                      )}
                    </div>
                    {mainRequester?.message && (
                      <p className="text-sm text-gray-400 mt-1 italic truncate">
                        "{mainRequester.message}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Vote section */}
                <div className="flex items-center space-x-3 ml-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {request.votes || 0}
                    </div>
                    <div className="text-xs text-gray-400">
                      {(request.votes || 0) === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleVote(request.id, e)}
                    disabled={isVoting || !currentUserId}
                    className={`
                      p-3 rounded-full transition-all duration-200 
                      ${isVoting
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:scale-105'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    title={isVoting ? 'Voting...' : 'Vote for this request'}
                  >
                    {isVoting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ThumbsUp className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}