import React, { useState } from 'react';
import { X, Music4, AlertTriangle } from 'lucide-react';
import type { Song, User } from '../types';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  onSubmit: (data: any) => Promise<boolean>;
  currentUser: User;
}

export function RequestModal({
  isOpen,
  onClose,
  song,
  onSubmit,
  currentUser
}: RequestModalProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate user data
      if (!currentUser.name) {
        throw new Error('User name is required');
      }

      // Check photo size before submitting
      if (currentUser.photo) {
        const base64Length = currentUser.photo.length - (currentUser.photo.indexOf(',') + 1);
        const size = (base64Length * 3) / 4;
        
        // 300KB limit
        if (size > 300 * 1024) {
          throw new Error(`Your profile photo is too large (${Math.round(size/1024)}KB). Please go back and update your profile with a smaller image (max 300KB).`);
        }
      }
      
      // Ensure message is properly trimmed and truncated
      const truncatedMessage = message.trim().slice(0, 100);
      
      const requestData = {
        title: song.title,
        artist: song.artist || '',
        requestedBy: currentUser.name,
        userPhoto: currentUser.photo,
        message: truncatedMessage,
        userId: currentUser.id || currentUser.name
      };

      console.log("Submitting request with data:", requestData);
      
      const success = await onSubmit(requestData);

      if (success) {
        setMessage('');
        onClose();
      } else {
        throw new Error('Failed to submit request. Please try again.');
      }
    } catch (error) {
      console.error('Error in request modal:', error);
      
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('rate limit')) {
          errorMessage = 'Too many requests. Please try again later.';
        } else if (error.message.includes('duplicate')) {
          errorMessage = 'This song has already been requested.';
        } else if (error.message.includes('photo is too large')) {
          errorMessage = error.message;
        } else if (error.message.includes('User name is required')) {
          errorMessage = 'Please provide your name before submitting a request.';
        } else if (error.message.includes('already requested')) {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-effect rounded-lg p-6 w-full max-w-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Request Song</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-6 flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-start space-x-4 mb-6">
          {song.albumArtUrl ? (
            <img
              src={song.albumArtUrl}
              alt={`${song.title} album art`}
              className="w-24 h-24 object-cover rounded-lg neon-border"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg flex items-center justify-center bg-neon-purple/10 neon-border">
              <Music4 className="w-12 h-12 text-neon-pink" />
            </div>
          )}
          <div>
            <h3 className="font-medium text-white text-lg">{song.title}</h3>
            <p className="text-gray-300 text-base">{song.artist || 'Unknown Artist'}</p>
            {song.genre && (
              <div className="mt-2 flex flex-wrap gap-2">
                {song.genre.split(',').map((genre, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded-full bg-neon-purple/10 text-neon-pink"
                  >
                    {genre.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Message for the band (optional, max 100 characters)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 100))}
              className="w-full px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
              placeholder="Add a message..."
              rows={2}
              maxLength={100}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-400 mt-1">
              {message.length}/100 characters
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap text-sm font-extrabold tracking-wide uppercase disabled:opacity-50"
              style={{
                backgroundColor: 'var(--frontend-accent-color, #ff00ff)'
              }}
            >
              {isSubmitting ? 'SUBMITTING...' : 'REQUEST'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}