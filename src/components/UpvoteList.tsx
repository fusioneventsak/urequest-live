import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Music4, ThumbsUp, UserCircle } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import { supabase } from '../utils/supabase';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [votedRequests, setVotedRequests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [votingStates, setVotingStates] = useState<Set<string>>(new Set());
  const lastRequestsRef = useRef<SongRequest[]>([]);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Memoize active requests with better performance
  const activeRequests = useMemo(() => {
    if (!requests || requests.length === 0) {
      return [];
    }

    // Only recalculate if requests actually changed
    if (lastRequestsRef.current === requests) {
      return lastRequestsRef.current.filter(request => !request.isPlayed);
    }
    
    lastRequestsRef.current = requests;
    
    return requests
      .filter(request => !request.isPlayed)
      .sort((a, b) => {
        // Locked requests always go first
        if (a.isLocked && !b.isLocked) return -1;
        if (!a.isLocked && b.isLocked) return 1;
        
        // Then sort by votes (descending)
        return (b.votes || 0) - (a.votes || 0);
      });
  }, [requests]);

  // Optimized scroll handler with throttling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (containerRef.current && isMountedRef.current) {
            const maxScroll = Math.max(
              document.documentElement.scrollHeight - window.innerHeight,
              1
            );
            const currentScroll = window.scrollY;
            const progress = Math.min((currentScroll / maxScroll) * 100, 100);
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

  // Fetch user votes only once on mount - with better error handling
  useEffect(() => {
    let isMounted = true;
    
    const fetchUserVotes = async () => {
      if (!currentUserId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        const { data: votes, error } = await supabase
          .from('user_votes')
          .select('request_id')
          .eq('user_id', currentUserId);

        if (error) {
          // Handle common errors gracefully
          if (error.message.includes('relation "user_votes" does not exist')) {
            console.warn('user_votes table does not exist yet - votes will be tracked locally');
            if (isMounted) setIsLoading(false);
            return;
          }
          throw error;
        }

        if (isMounted && votes) {
          setVotedRequests(new Set(votes.map(v => v.request_id)));
        }
      } catch (error) {
        console.error('Error fetching user votes:', error);
        // Don't show error to user - just log it
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserVotes();
    
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Fallback vote handler - uses existing onVote prop instead of database functions
  const handleVote = useCallback(async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId || votedRequests.has(id) || votingStates.has(id)) {
      return;
    }

    // Immediate UI feedback
    setVotingStates(prev => new Set([...prev, id]));
    setVotedRequests(prev => new Set([...prev, id]));

    try {
      // Use the existing onVote function passed from parent
      const success = await onVote(id);

      if (!success) {
        // Revert if vote failed
        if (isMountedRef.current) {
          setVotedRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          toast.error('You have already voted for this request');
        }
      } else {
        toast.success('Vote recorded!');
      }
    } catch (error) {
      console.error('Error recording vote:', error);
      
      // Revert UI state on error
      if (isMountedRef.current) {
        setVotedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to vote';
        toast.error(errorMessage.includes('already voted') ? 
          'You have already voted for this request' : 
          'Failed to vote. Please try again.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setVotingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    }
  }, [currentUserId, votedRequests, votingStates, onVote]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        <span className="ml-3 text-gray-400">Loading votes...</span>
      </div>
    );
  }

  if (!activeRequests || activeRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <Music4 className="mx-auto h-12 w-12 text-gray-500 mb-4" />
        <p className="text-gray-400 text-lg">No active requests to vote on</p>
        <p className="text-gray-500 text-sm mt-2">Be the first to request a song!</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-4 p-4"
    >
      {/* Progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-800 z-50">
        <div 
          className="h-full transition-all duration-150 ease-out"
          style={{ 
            width: `${scrollProgress}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${secondaryColor})`
          }}
        />
      </div>

      {activeRequests.map((request) => {
        const hasVoted = votedRequests.has(request.id);
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
                      // Fallback to icon if image fails
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
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
                  disabled={hasVoted || isVoting || !currentUserId}
                  className={`
                    p-3 rounded-full transition-all duration-200 
                    ${hasVoted 
                      ? 'bg-green-600 text-white cursor-not-allowed' 
                      : isVoting
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:scale-105'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  title={hasVoted ? 'Already voted' : isVoting ? 'Voting...' : 'Vote for this request'}
                >
                  {isVoting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ThumbsUp className={`w-5 h-5 ${hasVoted ? 'fill-current' : ''}`} />
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}