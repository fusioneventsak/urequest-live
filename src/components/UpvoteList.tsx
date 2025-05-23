import React, { useState, useRef, useEffect } from 'react';
import { Music4, ThumbsUp, UserCircle } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import { supabase } from '../utils/supabase';
import type { SongRequest } from '../types';

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

  // Fetch user's votes
  useEffect(() => {
    const fetchUserVotes = async () => {
      if (!currentUserId) return;

      try {
        setIsLoading(true);
        const { data: votes, error } = await supabase
          .from('user_votes')
          .select('request_id')
          .eq('user_id', currentUserId);

        if (error) throw error;

        if (votes) {
          setVotedRequests(new Set(votes.map(v => v.request_id)));
        }
      } catch (error) {
        console.error('Error fetching user votes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVotes();
  }, [currentUserId]);

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

  // Handle voting
  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId || votedRequests.has(id)) return;

    try {
      const success = await onVote(id);
      if (success) {
        // Add vote to database
        const { error } = await supabase
          .from('user_votes')
          .insert({ request_id: id, user_id: currentUserId });

        if (error) throw error;

        // Update local state
        setVotedRequests(prev => new Set([...prev, id]));
      }
    } catch (error) {
      console.error('Error recording vote:', error);
    }
  };

  // Filter out played requests and sort by votes
  const activeRequests = requests
    .filter(request => !request.isPlayed)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0));

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading votes...
      </div>
    );
  }

  if (activeRequests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No active requests to vote on
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="grid gap-4 p-4"
    >
      {activeRequests.map((request) => {
        const hasVoted = votedRequests.has(request.id);
        const requesters = Array.isArray(request.requesters) ? request.requesters : [];
        
        return (
          <div
            key={request.id}
            className="glass-effect rounded-lg p-4 relative overflow-hidden transition-all duration-300 h-[88px] flex items-center"
            style={{
              borderColor: songBorderColor,
              borderWidth: '2px',
              boxShadow: `0 0 10px ${songBorderColor}50`,
              background: `linear-gradient(135deg, 
                rgba(255, 255, 255, 0.1), 
                rgba(255, 255, 255, 0.05), 
                rgba(255, 255, 255, 0.02)
              )`,
            }}
          >
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  linear-gradient(
                    135deg,
                    transparent 0%,
                    rgba(255, 255, 255, 0.02) 15%,
                    rgba(255, 255, 255, 0.05) 30%,
                    rgba(255, 255, 255, 0.08) 45%,
                    rgba(255, 255, 255, 0.05) 60%,
                    rgba(255, 255, 255, 0.02) 75%,
                    transparent 100%
                  )
                `,
                transform: `translateX(${-50 + scrollProgress}%)`,
                transition: 'transform 1s ease-out',
                opacity: 0.4,
              }}
            />

            <div className="relative flex items-center gap-4 w-full">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center bg-neon-purple/20 flex-shrink-0"
                style={{
                  boxShadow: `0 0 10px ${songBorderColor}30`,
                }}
              >
                <Music4 className="w-6 h-6" style={{ color: accentColor }} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-base truncate">
                  {request.title}
                </h3>
                {request.artist && (
                  <p className="text-gray-300 text-sm truncate mb-2">{request.artist}</p>
                )}
                
                {/* Requesters section */}
                {requesters.length > 0 && (
                  <div className="flex items-center gap-2">
                    {requesters.slice(0, 3).map((requester, index) => (
                      <div 
                        key={`${requester.id}-${index}`}
                        className="flex-shrink-0"
                        title={`${requester.name}${requester.message ? `: "${requester.message}"` : ''}`}
                      >
                        {requester.photo ? (
                          <img
                            src={requester.photo}
                            alt={requester.name}
                            className="w-6 h-6 rounded-full border-2"
                            style={{ borderColor: accentColor }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const container = e.currentTarget.parentElement;
                              if (container) {
                                const fallback = document.createElement('div');
                                fallback.className = "w-6 h-6 rounded-full flex items-center justify-center bg-neon-purple/20 flex-shrink-0";
                                fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
                                container.prepend(fallback);
                              }
                            }}
                          />
                        ) : (
                          <UserCircle className="w-6 h-6 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                    {requesters.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{requesters.length - 3}
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
                  onClick={(e) => handleVote(request.id, e)}
                  disabled={hasVoted}
                  className={`px-2 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 font-semibold flex-shrink-0 text-white text-xs ${
                    hasVoted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'
                  }`}
                  style={{ 
                    backgroundColor: hasVoted ? '#666' : accentColor,
                    border: `1px solid ${hasVoted ? '#666' : accentColor}`,
                  }}
                  title={hasVoted ? 'Already voted' : 'Upvote this request'}
                >
                  <ThumbsUp className="w-3 h-3" />
                  <span>{hasVoted ? 'VOTED' : 'UPVOTE'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}