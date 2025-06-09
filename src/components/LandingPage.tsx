import React, { useState, useRef } from 'react';
import { Camera, User as UserIcon, AlertTriangle, UserCircle } from 'lucide-react';
import { resizeAndCompressImage, getOptimalCameraConstraints, getOptimalFileInputAccept, supportsHighQualityCapture } from '../utils/imageUtils';
import type { User } from '../types';

interface LandingPageProps {
  onComplete: (user: User) => void;
  initialUser?: User | null;
}

// Increased limit to handle smartphone photos after compression
const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB limit for compressed photos (up from 300KB)
const MAX_INPUT_SIZE = 50 * 1024 * 1024; // 50MB max input size (supports all major phone brands)

export function LandingPage({ onComplete, initialUser }: LandingPageProps) {
  const [name, setName] = useState(initialUser?.name || '');
  const [photo, setPhoto] = useState<string>(initialUser?.photo || '');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      // Get optimal camera constraints based on device
      const constraints = getOptimalCameraConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setErrorMessage('Could not access camera. Please check your permissions or try uploading a photo from your gallery instead.');
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      try {
        setIsProcessing(true);
        setErrorMessage(null);
        
        const context = canvasRef.current.getContext('2d');
        if (context) {
          // Set dimensions for the capture - higher resolution for better quality
          const width = 600; // Increased for better quality on all devices
          const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;
          
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          context.drawImage(videoRef.current, 0, 0, width, height);
          
          const photoData = canvasRef.current.toDataURL('image/jpeg', 0.9); // High quality initial capture
          
          try {
            const compressedPhoto = await resizeAndCompressImage(photoData, 300, 300, 0.8);
            
            // Verify compressed photo size before accepting
            const base64Length = compressedPhoto.length - (compressedPhoto.indexOf(',') + 1);
            const size = (base64Length * 3) / 4;
            
            if (size > MAX_PHOTO_SIZE) {
              setErrorMessage(`Image is too large (${Math.round(size/1024)}KB). Maximum size is ${Math.round(MAX_PHOTO_SIZE/1024)}KB. Please try again.`);
              return;
            }
            
            setPhoto(compressedPhoto);
            stopCamera();
          } catch (error) {
            if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage('Error processing your photo. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Error capturing photo:', error);
        setErrorMessage('Error processing your photo. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsProcessing(true);
        setErrorMessage(null);
        
        // Check if file is too large to process (before compression)
        if (file.size > MAX_INPUT_SIZE) {
          setErrorMessage(`Image file is too large (${Math.round(file.size/(1024*1024))}MB). Please select an image under ${Math.round(MAX_INPUT_SIZE/(1024*1024))}MB.`);
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Use higher resolution and quality for compression to maintain image quality
            const compressedPhoto = await resizeAndCompressImage(reader.result as string, 300, 300, 0.8);
            
            // Verify compressed photo size before accepting
            const base64Length = compressedPhoto.length - (compressedPhoto.indexOf(',') + 1);
            const size = (base64Length * 3) / 4;
            
            if (size > MAX_PHOTO_SIZE) {
              setErrorMessage(`Image is still too large after compression (${Math.round(size/1024)}KB). Maximum size is ${Math.round(MAX_PHOTO_SIZE/1024)}KB. Please try a different image.`);
              return;
            }
            
            setPhoto(compressedPhoto);
          } catch (error) {
            if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage('Error processing your photo. Please try a different image.');
            }
          } finally {
            setIsProcessing(false);
          }
        };
        reader.onerror = () => {
          setErrorMessage('Error reading the image file. Please try again.');
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error handling file upload:', error);
        setErrorMessage('An error occurred while processing your photo.');
        setIsProcessing(false);
      }
    }
  };

  // Combined photo upload handler that gives option for camera or file
  const handlePhotoAction = () => {
    // Check if device supports camera
    const supportsCamera = supportsHighQualityCapture();
    
    if (supportsCamera) {
      // On mobile devices, show options
      const action = window.confirm('Would you like to take a photo with your camera? Click OK for camera, Cancel to choose from your photo gallery.');
      
      if (action) {
        startCamera();
      } else {
        fileInputRef.current?.click();
      }
    } else {
      // On desktop, just open file picker
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setErrorMessage('Please enter your name');
      return;
    }
    
    // Create a default avatar if no photo was provided
    const userPhoto = photo || generateDefaultAvatar(name);
    
    // If we have a photo, verify size
    if (photo) {
      const base64Length = photo.length - (photo.indexOf(',') + 1);
      const size = (base64Length * 3) / 4;
      
      if (size > MAX_PHOTO_SIZE) {
        setErrorMessage(`Photo is too large (${Math.round(size/1024)}KB). Maximum size is ${Math.round(MAX_PHOTO_SIZE/1024)}KB. Please try again with a smaller image.`);
        return;
      }
    }
    
    onComplete({ 
      id: initialUser?.id || name.toLowerCase().replace(/\s+/g, '-'), 
      name, 
      photo: userPhoto 
    });
  };
  
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

  return (
    <div className="min-h-screen bg-darker-purple flex items-center justify-center p-4">
      <div className="glass-effect rounded-lg shadow-xl p-8 max-w-md w-full border border-neon-purple/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white neon-text mb-2">
            {initialUser ? 'Edit Profile' : 'Welcome to Song Request'}
          </h1>
          <p className="text-gray-300">
            {initialUser
              ? 'Update your profile information'
              : 'Please introduce yourself before making a request'}
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-6 flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-gray-800"
              placeholder="Enter your name"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Photo <span className="text-neon-pink">(Recommended)</span>
            </label>
            
            {isCapturing ? (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg neon-border"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isProcessing}
                    className="flex-1 neon-button flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 text-sm text-neon-pink hover:text-white transition-colors border border-neon-pink/30 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : photo ? (
              <div className="space-y-4">
                <img
                  src={photo}
                  alt="Preview"
                  className="w-32 h-32 rounded-full mx-auto object-cover neon-border"
                />
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="w-full px-4 py-2 text-sm text-neon-pink hover:text-white transition-colors"
                >
                  Remove Photo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <UserCircle className="w-32 h-32 text-gray-400 mx-auto" />
                </div>
                <p className="text-center text-gray-400 text-sm">
                  No photo selected. A default avatar will be created for you.
                </p>
                <button
                  type="button"
                  onClick={handlePhotoAction}
                  disabled={isProcessing}
                  className="w-full neon-button flex items-center justify-center"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Add Photo'}
                </button>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getOptimalFileInputAccept()}
                  capture="environment"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-gray-400 mt-2">
              All smartphone photos supported (iPhone, Samsung, Google Pixel, etc.). Images will be automatically compressed to save space.
            </p>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || isProcessing}
            className="neon-button w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserIcon className="w-4 h-4 mr-2" />
            {initialUser ? 'Update Profile' : 'Continue to Song Requests'}
          </button>
        </form>
      </div>
    </div>
  );
}