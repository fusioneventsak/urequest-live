// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';
import { UserFrontend } from './components/UserFrontend';
import { BackendLogin } from './components/BackendLogin';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { useUiSettings } from './hooks/useUiSettings';
import { useSongSync } from './hooks/useSongSync';
import { useRequestSync } from './hooks/useRequestSync';
import { useSetListSync } from './hooks/useSetListSync';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Song, SongRequest, RequestFormData, SetList, User } from './types';
import { LogOut } from 'lucide-react';

// Import the backend components
import { SongLibrary } from './components/SongLibrary';
import { SetListManager } from './components/SetListManager';
import { QueueView } from './components/QueueView';
import { SettingsManager } from './components/SettingsManager';
import { LogoManager } from './components/LogoManager';
import { ColorCustomizer } from './components/ColorCustomizer';
import { LogoDebugger } from './components/LogoDebugger';
import { TickerManager } from './components/TickerManager';
import { BackendTabs } from './components/BackendTabs';
import { LandingPage } from './components/LandingPage';
import { Logo } from './components/shared/Logo';
import { KioskPage } from './components/KioskPage';

const DEFAULT_BAND_LOGO = "https://www.fusion-events.ca/wp-content/uploads/2025/03/ulr-wordmark.png";
const BACKEND_PATH = "backend";
const KIOSK_PATH = "kiosk";
const MAX_PHOTO_SIZE = 250 * 1024; // 250KB limit for database storage
const MAX_REQUEST_RETRIES = 3;

function App() {
  // Authentication state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBackend, setIsBackend] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  
  // Backend tab state
  const [activeBackendTab, setActiveBackendTab] = useState<'requests' | 'setlists' | 'songs' | 'settings'>('requests');
  
  // App data state
  const [songs, setSongs] = useState<Song[]>([]);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [activeSetList, setActiveSetList] = useState<SetList | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickerMessage, setTickerMessage] = useState<string>('');
  const [isTickerActive, setIsTickerActive] = useState(false);
  
  // Track network state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAppActive, setIsAppActive] = useState(true);
  
  // Ref to track if component is mounted
  const mountedRef = useRef(true);
  const requestInProgressRef = useRef(false);
  const requestRetriesRef = useRef(0);
  
  // UI Settings
  const { settings, updateSettings } = useUiSettings();
  
  // Initialize data synchronization
  const { isLoading: isFetchingSongs } = useSongSync(setSongs);
  const { isLoading: isFetchingRequests, reconnect: reconnectRequests } = useRequestSync(setRequests);
  const { isLoading: isFetchingSetLists, refetch: refreshSetLists } = useSetListSync(setSetLists);

  // Enhanced photo compression function with aggressive compression for database storage
  const compressPhoto = useCallback((file: File, maxSizeKB: number = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // More aggressive size limits for database storage
          const maxWidth = 400;  // Reduced from 800
          const maxHeight = 400; // Reduced from 800
          let { width, height } = img;

          // Calculate new dimensions maintaining aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw with better quality settings
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }

          // Start with lower quality and be more aggressive
          let quality = 0.7; // Start lower
          let result: string;

          do {
            result = canvas.toDataURL('image/jpeg', quality);
            const sizeKB = (result.length * 3) / 4 / 1024;
            
            console.log(`Compression attempt: ${Math.round(sizeKB)}KB at quality ${quality.toFixed(2)}`);
            
            if (sizeKB <= maxSizeKB || quality <= 0.05) {
              break;
            }
            
            quality -= 0.05; // Smaller steps for more precision
          } while (quality > 0.05);

          const finalSizeKB = (result.length * 3) / 4 / 1024;
          console.log(`Final compressed size: ${Math.round(finalSizeKB)}KB`);

          // If still too large, try WebP format (better compression)
          if (finalSizeKB > maxSizeKB) {
            quality = 0.6;
            do {
              result = canvas.toDataURL('image/webp', quality);
              const sizeKB = (result.length * 3) / 4 / 1024;
              
              if (sizeKB <= maxSizeKB || quality <= 0.1) {
                break;
              }
              
              quality -= 0.1;
            } while (quality > 0.1);
          }

          resolve(result);
        } catch (error) {
          reject(new Error('Failed to compress image'));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      // Don't show errors for aborted requests or unmounted components
      const errorMessage = event.reason?.message || String(event.reason);
      if (errorMessage.includes('aborted') || 
          errorMessage.includes('Component unmounted') ||
          errorMessage.includes('channel closed')) {
        // Silently handle these errors
        event.preventDefault();
        return;
      }
      
      // Show toast for network errors
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || 
          errorMessage.includes('network')) {
        toast.error('Network connection issue. Please check your internet connection.');
        event.preventDefault();
        return;
      }
      
      // Show generic error for other unhandled errors
      toast.error('An error occurred. Please try again later.');
      event.preventDefault();
    };

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
      setIsOnline(true);
      
      // Attempt to reconnect and refresh data
      reconnectRequests();
      refreshSetLists();
      
      toast.success('Network connection restored');
    };

    const handleOffline = () => {
      console.log('🌐 Network connection lost');
      setIsOnline(false);
      toast.error('Network connection lost. You can still view cached content.');
    };

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsAppActive(isVisible);
      
      if (isVisible) {
        console.log('📱 App is now active. Refreshing data...');
        // Refresh data when app becomes visible again
        reconnectRequests();
        refreshSetLists();
      } else {
        console.log('📱 App is now inactive');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reconnectRequests, refreshSetLists]);

  // Track component mounted state
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if we should show the backend or kiosk view
  useEffect(() => {
    const checkPathSpecialCases = () => {
      const path = window.location.pathname.toLowerCase();
      const isBackendPath = path === `/${BACKEND_PATH}` || path.startsWith(`/${BACKEND_PATH}/`);
      const isKioskPath = path === `/${KIOSK_PATH}` || path.startsWith(`/${KIOSK_PATH}/`);
      setIsBackend(isBackendPath);
      setIsKiosk(isKioskPath);
    };

    checkPathSpecialCases();
    window.addEventListener('popstate', checkPathSpecialCases);

    return () => {
      window.removeEventListener('popstate', checkPathSpecialCases);
    };
  }, []);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for backend auth in localStorage first
        const hasAuth = localStorage.getItem('backendAuth') === 'true';
        setIsAdmin(hasAuth);
        
        // Check for stored user
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try {
            setCurrentUser(JSON.parse(savedUser));
          } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
          }
        }
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  // Update active set list when set lists change
  useEffect(() => {
    const active = setLists.find(sl => sl.isActive);
    setActiveSetList(active || null);
  }, [setLists]);

  // Handle navigation to backend
  const navigateToBackend = useCallback(() => {
    window.history.pushState({}, '', `/${BACKEND_PATH}`);
    setIsBackend(true);
    setIsKiosk(false);
  }, []);
  
  // Handle navigation to frontend
  const navigateToFrontend = useCallback(() => {
    window.history.pushState({}, '', '/');
    setIsBackend(false);
    setIsKiosk(false);
  }, []);

  // Handle navigation to kiosk mode
  const navigateToKiosk = useCallback(() => {
    window.history.pushState({}, '', `/${KIOSK_PATH}`);
    setIsBackend(false);
    setIsKiosk(true);
  }, []);

  // Handle admin login
  const handleAdminLogin = useCallback(() => {
    localStorage.setItem('backendAuth', 'true');
    setIsAdmin(true);
  }, []);

  // Handle admin logout
  const handleAdminLogout = useCallback(() => {
    localStorage.removeItem('backendAuth');
    localStorage.removeItem('backendUser');
    setIsAdmin(false);
    navigateToFrontend();
    toast.success('Logged out successfully');
  }, [navigateToFrontend]);
  
  // Handle user update with enhanced photo support
  const handleUserUpdate = useCallback(async (user: User, photoFile?: File) => {
    try {
      let finalUser = { ...user };

      // Handle photo upload if provided
      if (photoFile) {
        try {
          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (!allowedTypes.includes(photoFile.type)) {
            throw new Error('Please select a JPEG, PNG, or WebP image file');
          }

          // Check file size (10MB limit before compression)
          if (photoFile.size > 10 * 1024 * 1024) {
            throw new Error('Image file is too large. Please select an image smaller than 10MB');
          }

          // Compress the photo to 200KB limit for database storage
          const compressedPhoto = await compressPhoto(photoFile, 200);
          finalUser.photo = compressedPhoto;

          toast.success('📱 Photo uploaded and optimized for database storage!');
        } catch (photoError) {
          console.error('Photo processing error:', photoError);
          toast.error(photoError instanceof Error ? photoError.message : 'Failed to process photo');
          return;
        }
      }

      // Validate final user data
      if (!finalUser.name.trim()) {
        toast.error('Please enter your name');
        return;
      }

      // Enhanced photo size validation for database storage
      if (finalUser.photo && finalUser.photo.startsWith('data:')) {
        const base64Length = finalUser.photo.length - (finalUser.photo.indexOf(',') + 1);
        const sizeKB = (base64Length * 3) / 4 / 1024;
        
        // 250KB limit for database storage
        if (sizeKB > 250) {
          toast.error(`Profile photo is too large (${Math.round(sizeKB)}KB). Maximum size is 250KB for database storage.`);
          return;
        }
      }

      // Update user state and save to localStorage
      setCurrentUser(finalUser);
      
      try {
        localStorage.setItem('currentUser', JSON.stringify(finalUser));
      } catch (e) {
        console.error('Error saving user to localStorage:', e);
        // Still proceed even if localStorage fails
        toast.warning('Profile updated but could not be saved locally');
      }
      
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  }, [compressPhoto]);

  // Handle logo click
  const onLogoClick = useCallback(() => {
    // Empty function to handle logo clicks
  }, []);

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

  // Handle song request submission with retry logic and enhanced photo support
  const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
    if (requestInProgressRef.current) {
      console.log('Request already in progress, please wait...');
      toast.error('A request is already being processed. Please wait a moment and try again.');
      return false;
    }
    
    requestInProgressRef.current = true;
    
    try {
      console.log('Submitting request:', data);
      
      // Enhanced photo size validation for database storage
      if (data.userPhoto && data.userPhoto.startsWith('data:')) {
        const base64Length = data.userPhoto.length - (data.userPhoto.indexOf(',') + 1);
        const sizeKB = (base64Length * 3) / 4 / 1024;
        
        // 250KB limit for database storage
        if (sizeKB > 250) {
          throw new Error(`Your profile photo is too large (${Math.round(sizeKB)}KB). Please go back and update your profile with a smaller image (max 250KB).`);
        }
      }

      // First check if the song is already requested - use maybeSingle() instead of single()
      const { data: existingRequest, error: checkError } = await supabase
        .from('requests')
        .select('id, title')
        .eq('title', data.title)
        .eq('is_played', false)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
        throw checkError;
      }

      let requestId: string;

      if (existingRequest) {
        // For kiosk mode, we always add a new requester even if song is already requested
        requestId = existingRequest.id;
        
        // Add requester to existing request
        const { error: requesterError } = await supabase
          .from('requesters')
          .insert({
            request_id: requestId,
            name: data.requestedBy,
            photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
            message: data.message?.trim().slice(0, 100) || '',
            created_at: new Date().toISOString()
          });

        if (requesterError) throw requesterError;
      } else {
        // Create new request
        const { data: newRequest, error: requestError } = await supabase
          .from('requests')
          .insert({
            title: data.title,
            artist: data.artist || '',
            votes: 0,
            status: 'pending',
            is_locked: false,
            is_played: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (requestError) throw requestError;
        if (!newRequest) throw new Error('Failed to create request');

        requestId = newRequest.id;

        // Add requester to the new request
        const { error: requesterError } = await supabase
          .from('requesters')
          .insert({
            request_id: requestId,
            name: data.requestedBy,
            photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
            message: data.message?.trim().slice(0, 100) || '',
            created_at: new Date().toISOString()
          });

        if (requesterError) throw requesterError;
      }

      // Reset retry count on success
      requestRetriesRef.current = 0;
      
      toast.success('Your request has been added to the queue!');
      return true;
    } catch (error) {
      console.error('Error submitting request:', error);
      
      // If we get channel closed errors, attempt to reconnect
      if (error instanceof Error && 
          (error.message.includes('channel') || 
           error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError'))) {
        
        reconnectRequests();
        
        // Try to retry the request automatically
        if (requestRetriesRef.current < MAX_REQUEST_RETRIES) {
          requestRetriesRef.current++;
          
          const delay = Math.pow(2, requestRetriesRef.current) * 1000; // Exponential backoff
          console.log(`Automatically retrying request in ${delay/1000} seconds (attempt ${requestRetriesRef.current}/${MAX_REQUEST_RETRIES})...`);
          
          setTimeout(() => {
            if (mountedRef.current) {
              requestInProgressRef.current = false;
              handleSubmitRequest(data).catch(console.error);
            }
          }, delay);
          
          return false;
        }
      }
      
      if (error instanceof Error) {
        const errorMsg = error.message.includes('rate limit') 
          ? 'Too many requests. Please try again later.'
          : error.message || 'Failed to submit request. Please try again.';
        toast.error(errorMsg);
      } else {
        toast.error('Failed to submit request. Please try again.');
      }
      
      // Reset retry count on giving up
      requestRetriesRef.current = 0;
      
      return false;
    } finally {
      requestInProgressRef.current = false;
    }
  }, [reconnectRequests, compressPhoto]);

  // Handle request vote with error handling
  const handleVoteRequest = useCallback(async (id: string): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Cannot vote while offline. Please check your internet connection.');
      return false;
    }
    
    try {
      if (!currentUser || !currentUser.id) {
        throw new Error('You must be logged in to vote');
      }

      // Check if user already voted
      const { data: existingVote, error: checkError } = await supabase
        .from('user_votes')
        .select('id')
        .eq('request_id', id)
        .eq('user_id', currentUser.id || currentUser.name)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
        throw checkError;
      }

      if (existingVote) {
        toast.error('You have already voted for this request');
        return false;
      }

      // Get current votes
      const { data, error: getError } = await supabase
        .from('requests')
        .select('votes')
        .eq('id', id)
        .single();
        
      if (getError) throw getError;
      
      // Update votes count
      const currentVotes = data?.votes || 0;
      const { error: updateError } = await supabase
        .from('requests')
        .update({ votes: currentVotes + 1 })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      // Record vote to prevent duplicates
      const { error: voteError } = await supabase
        .from('user_votes')
        .insert({
          request_id: id,
          user_id: currentUser.id || currentUser.name,
          created_at: new Date().toISOString()
        });
        
      if (voteError) throw voteError;
        
      toast.success('Vote added!');
      return true;
    } catch (error) {
      console.error('Error voting for request:', error);
      
      if (error instanceof Error && error.message.includes('already voted')) {
        toast.error(error.message);
      } else if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to vote for this request. Please try again.');
      }
      
      return false;
    }
  }, [currentUser, isOnline]);

  // Handle locking a request (marking it as next)
  const handleLockRequest = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const requestToUpdate = requests.find(r => r.id === id);
      if (!requestToUpdate) return;
      
      // Toggle the locked status
      const newLockedState = !requestToUpdate.isLocked;
      
      // If locking, unlock all others first
      if (newLockedState) {
        const { error: unlockError } = await supabase
          .from('requests')
          .update({ is_locked: false })
          .neq('id', id);
          
        if (unlockError) throw unlockError;
      }
      
      // Update this request's lock status
      const { error } = await supabase
        .from('requests')
        .update({ is_locked: newLockedState })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success(newLockedState ? 'Request locked as next song' : 'Request unlocked');
    } catch (error) {
      console.error('Error toggling request lock:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update request. Please try again.');
      }
    }
  }, [requests, isOnline]);

  // Handle marking a request as played
  const handleMarkPlayed = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Update the request as played
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false
        })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success('Request marked as played');
    } catch (error) {
      console.error('Error marking request as played:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update request. Please try again.');
      }
    }
  }, [isOnline]);

  // Handle resetting the request queue
  const handleResetQueue = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot reset queue while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Count requests to be cleared
      const pendingRequests = requests.filter(r => !r.isPlayed).length;
      
      // Reset all pending requests
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false,
          votes: 0
        })
        .eq('is_played', false);
        
      if (error) throw error;
      
      // Log the reset
      const { error: logError } = await supabase
        .from('queue_reset_logs')
        .insert({
          set_list_id: activeSetList?.id,
          reset_type: 'manual',
          requests_cleared: pendingRequests
        });
        
      if (logError) console.error('Error logging queue reset:', logError);

      // Clear rate limits with proper WHERE clause
      const { error: votesError } = await supabase
        .from('user_votes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      if (votesError) console.error('Error clearing vote limits:', votesError);
      
      toast.success('Request queue cleared and rate limits reset');
    } catch (error) {
      console.error('Error resetting queue:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to clear queue. Please try again.');
      }
    }
  }, [requests, activeSetList, isOnline]);

  // Handle adding a new song
  const handleAddSong = useCallback((song: Omit<Song, 'id'>) => {
    setSongs(prev => [...prev, { ...song, id: uuidv4() }]);
  }, []);

  // Handle updating a song
  const handleUpdateSong = useCallback((updatedSong: Song) => {
    setSongs(prev => prev.map(song => 
      song.id === updatedSong.id ? updatedSong : song
    ));
  }, []);

  // Handle deleting a song
  const handleDeleteSong = useCallback((id: string) => {
    setSongs(prev => prev.filter(song => song.id !== id));
  }, []);

  // Handle creating a new set list
  const handleCreateSetList = useCallback(async (newSetList: Omit<SetList, 'id'>) => {
    if (!isOnline) {
      toast.error('Cannot create set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Extract songs from the set list to handle separately
      const { songs, ...setListData } = newSetList;
      
      // Convert camelCase to snake_case for database
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      // Insert the set list
      const { data, error } = await supabase
        .from('set_lists')
        .insert(dbSetListData)
        .select();
        
      if (error) throw error;
      
      if (data && songs && songs.length > 0) {
        // Insert songs with positions
        const songMappings = songs.map((song, index) => ({
          set_list_id: data[0].id,
          song_id: song.id,
          position: index
        }));
        
        const { error: songError } = await supabase
          .from('set_list_songs')
          .insert(songMappings);
          
        if (songError) throw songError;
      }
      
      toast.success('Set list created successfully');
      refreshSetLists(); // Refresh to get latest data
    } catch (error) {
      console.error('Error creating set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to create set list. Please try again.');
      }
    }
  }, [refreshSetLists, isOnline]);

  // Handle updating a set list
  const handleUpdateSetList = useCallback(async (updatedSetList: SetList) => {
    if (!isOnline) {
      toast.error('Cannot update set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const { id, songs, ...setListData } = updatedSetList;
      
      // Convert camelCase to snake_case for database
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      // Update set list data
      const { error } = await supabase
        .from('set_lists')
        .update(dbSetListData)
        .eq('id', id);
        
      if (error) throw error;
      
      // Clear existing songs
      const { error: deleteError } = await supabase
        .from('set_list_songs')
        .delete()
        .eq('set_list_id', id);
        
      if (deleteError) throw deleteError;
      
      // Insert updated songs
      if (songs && songs.length > 0) {
        const songMappings = songs.map((song, index) => ({
          set_list_id: id,
          song_id: song.id,
          position: index
        }));
        
        const { error: insertError } = await supabase
          .from('set_list_songs')
          .insert(songMappings);
          
        if (insertError) throw insertError;
      }
      
      toast.success('Set list updated successfully');
      refreshSetLists(); // Refresh to get latest data
    } catch (error) {
      console.error('Error updating set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update set list. Please try again.');
      }
    }
  }, [refreshSetLists, isOnline]);

  // Handle deleting a set list
  const handleDeleteSetList = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot delete set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Set list songs will be deleted via cascade
      const { error } = await supabase
        .from('set_lists')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success('Set list deleted successfully');
    } catch (error) {
      console.error('Error deleting set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to delete set list. Please try again.');
      }
    }
  }, [isOnline]);

  // Handle activating/deactivating a set list
  const handleSetActive = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Get the current set list
      const setList = setLists.find(sl => sl.id === id);
      if (!setList) return;
      
      // Toggle active state
      const newActiveState = !setList.isActive;
      
      // Update in database (using snake_case for database field names)
      const { error } = await supabase
        .from('set_lists')
        .update({ is_active: newActiveState })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success(newActiveState 
        ? 'Set list activated successfully' 
        : 'Set list deactivated successfully');
        
      // Force refresh set lists to ensure we get latest data with proper isActive state
      refreshSetLists();
    } catch (error) {
      console.error('Error toggling set list active state:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update set list. Please try again.');
      }
    }
  }, [setLists, refreshSetLists, isOnline]);

  // Handle updating logo URL
  const handleLogoUpdate = useCallback(async (url: string) => {
    if (!isOnline) {
      toast.error('Cannot update logo while offline. Please check your internet connection.');
      return;
    }
    
    try {
      await updateSettings({
        band_logo_url: url,
        updated_at: new Date().toISOString()
      });
      
      toast.success('Logo updated successfully');
    } catch (error) {
      console.error('Error updating logo:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update logo. Please try again.');
      }
    }
  }, [updateSettings, isOnline]);

  // Determine what page to show
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-darker-purple flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading application..." />
      </div>
    );
  }

  // Show login page if accessing backend and not authenticated
  if (isBackend && !isAdmin) {
    return <BackendLogin onLogin={handleAdminLogin} />;
  }

  // Show kiosk page if accessing /kiosk
  if (isKiosk) {
    return (
      <ErrorBoundary>
        <KioskPage 
          songs={songs}
          requests={requests}
          activeSetList={activeSetList}
          logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
          onSubmitRequest={handleSubmitRequest}
        />
      </ErrorBoundary>
    );
  }

  // Show backend if accessing /backend and authenticated
  if (isBackend && isAdmin) {
    // Define lockedRequest variable before using it
    const lockedRequest = requests.find(r => r.isLocked && !r.isPlayed);
    
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-darker-purple">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <header className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <Logo 
                    url={settings?.band_logo_url || DEFAULT_BAND_LOGO}
                    className="h-12 mr-4"
                  />
                  <h1 className="text-3xl font-bold neon-text mb-2">
                    Band Request Hub
                  </h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  {!isOnline && (
                    <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-sm flex items-center">
                      <span className="mr-1">●</span>
                      Offline Mode
                    </div>
                  )}
                  <button 
                    onClick={navigateToFrontend}
                    className="neon-button"
                  >
                    Exit to Public View
                  </button>
                  <button 
                    onClick={navigateToKiosk}
                    className="neon-button"
                  >
                    Kiosk View
                  </button>
                  <button 
                    onClick={handleAdminLogout}
                    className="px-4 py-2 text-red-400 hover:bg-red-400/20 rounded-md flex items-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
              
              <p className="text-gray-300 max-w-2xl mt-2 mb-4">
                Manage your set lists, song library, and customize the request system all in one place.
              </p>
            </header>

            <BackendTabs 
              activeTab={activeBackendTab}
              onTabChange={setActiveBackendTab}
            />

            <div className="space-y-8">
              {activeBackendTab === 'requests' && (
                <ErrorBoundary>
                  <div className="glass-effect rounded-lg p-6">
                    <h2 className="text-xl font-semibold neon-text mb-4">Current Request Queue</h2>
                    <QueueView 
                      requests={requests}
                      onLockRequest={handleLockRequest}
                      onMarkPlayed={handleMarkPlayed}
                      onResetQueue={handleResetQueue}
                    />
                  </div>

                  <ErrorBoundary>
                    <TickerManager 
                      nextSong={lockedRequest
                        ? {
                            title: lockedRequest.title,
                            artist: lockedRequest.artist
                          }
                        : undefined
                      }
                      isActive={isTickerActive}
                      customMessage={tickerMessage}
                      onUpdateMessage={setTickerMessage}
                      onToggleActive={() => setIsTickerActive(!isTickerActive)}
                    />
                  </ErrorBoundary>
                </ErrorBoundary>
              )}

              {activeBackendTab === 'setlists' && (
                <ErrorBoundary>
                  <SetListManager 
                    songs={songs}
                    setLists={setLists}
                    onCreateSetList={handleCreateSetList}
                    onUpdateSetList={handleUpdateSetList}
                    onDeleteSetList={handleDeleteSetList}
                    onSetActive={handleSetActive}
                  />
                </ErrorBoundary>
              )}

              {activeBackendTab === 'songs' && (
                <ErrorBoundary>
                  <SongLibrary 
                    songs={songs}
                    onAddSong={handleAddSong}
                    onUpdateSong={handleUpdateSong}
                    onDeleteSong={handleDeleteSong}
                  />
                </ErrorBoundary>
              )}

              {activeBackendTab === 'settings' && (
                <>
                  <ErrorBoundary>
                    <LogoManager 
                      isAdmin={isAdmin}
                      currentLogoUrl={settings?.band_logo_url || null}
                      onLogoUpdate={handleLogoUpdate}
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <ColorCustomizer isAdmin={isAdmin} />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <SettingsManager />
                  </ErrorBoundary>
                </>
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Show landing page if no user is set up
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LandingPage onComplete={handleUserUpdate} />
      </ErrorBoundary>
    );
  }

  // Show main frontend
  return (
    <ErrorBoundary>
      <UserFrontend 
        songs={songs}
        requests={requests}
        activeSetList={activeSetList}
        currentUser={currentUser}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        onUpdateUser={handleUserUpdate}
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        isAdmin={isAdmin}
        onLogoClick={onLogoClick}
        onBackendAccess={navigateToBackend}
      />
    </ErrorBoundary>
  );
}

export default App;