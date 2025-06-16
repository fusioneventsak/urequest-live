import { useState, useCallback } from 'react';
import { uploadUserPhoto, generateDefaultAvatar } from '../utils/photoStorage';

/**
 * Hook for managing user photo uploads and storage
 */
export function usePhotoStorage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Upload a photo file to storage
   */
  const uploadPhoto = useCallback(async (file: File, userId: string): Promise<string> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please select a JPEG, PNG, or WebP image file');
      }

      // Check file size (10MB limit before compression)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image file is too large. Please select an image smaller than 10MB');
      }
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + Math.random() * 15;
          return next > 90 ? 90 : next;
        });
      }, 300);
      
      // Upload the photo
      const photoUrl = await uploadUserPhoto(file, userId);
      
      // Complete progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      return photoUrl;
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to upload photo'));
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * Generate a default avatar for users without photos
   */
  const getDefaultAvatar = useCallback((name: string): string => {
    return generateDefaultAvatar(name);
  }, []);

  return {
    uploadPhoto,
    getDefaultAvatar,
    isUploading,
    uploadProgress,
    error
  };
}