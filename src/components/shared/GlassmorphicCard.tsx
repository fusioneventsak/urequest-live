import React, { useRef, useEffect, ReactNode, HTMLAttributes } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

interface GlassmorphicCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  borderColor?: string;
  isHighlighted?: boolean;
  animationDelay?: number;
}

export function GlassmorphicCard({
  children,
  className = '',
  borderColor,
  isHighlighted = false,
  animationDelay,
  ...props
}: GlassmorphicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Apply scroll animation
  useScrollAnimation(cardRef, 'in-view', {
    threshold: 0.1,
    triggerOnce: true
  });
  
  // Apply animation delay if specified
  useEffect(() => {
    if (cardRef.current && animationDelay !== undefined) {
      cardRef.current.style.animationDelay = `${animationDelay}ms`;
    }
  }, [animationDelay]);
  
  return (
    <div
      ref={cardRef}
      className={`glass-effect animate-on-scroll rounded-lg p-4 transition-all duration-300 relative overflow-hidden ${className}`}
      style={{
        borderColor: borderColor,
        boxShadow: isHighlighted ? `0 0 20px ${borderColor}50` : undefined,
        ...props.style
      }}
      {...props}
    >
      {children}
    </div>
  );
}