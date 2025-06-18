import React, { useState } from 'react';
import { Music4 } from 'lucide-react';
import { useUiSettings } from '../../hooks/useUiSettings';

interface AlbumArtDisplayProps {
  albumArtUrl?: string;
  title: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  imageClassName?: string;
  imageStyle?: React.CSSProperties;
}

export function AlbumArtDisplay({ 
  albumArtUrl, 
  title, 
  size = 'md', 
  imageClassName = '', 
  imageStyle = {}
}: AlbumArtDisplayProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const { settings } = useUiSettings();
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

  // Size configurations
  const sizeClasses = {
    xs: 'w-14 h-14',
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const handleImageError = () => {
    setImageLoadError(true);
  };

  // Show fallback if no URL provided or image failed to load
  if (!albumArtUrl || imageLoadError) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0`}
        style={{
          boxShadow: `0 0 10px ${accentColor}30`,
          ...imageStyle
        }}
      >
        <Music4 
          className={`${iconSizes[size]}`}
          style={{ color: accentColor }}
        />
      </div>
    );
  }

  return (
    <img
      src={albumArtUrl}
      alt={`${title} album art`}
      className={`${sizeClasses[size]} object-cover rounded-md flex-shrink-0 ${imageClassName}`}
      style={imageStyle}
      onError={handleImageError}
    />
  );
}