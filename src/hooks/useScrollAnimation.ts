import { useEffect, useRef, RefObject } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Custom hook to add scroll-triggered animations to elements
 * 
 * @param elementRef Reference to the element to observe
 * @param className Class to add when element is in view
 * @param options Configuration options for the intersection observer
 */
export function useScrollAnimation<T extends HTMLElement>(
  elementRef: RefObject<T>,
  className: string = 'in-view',
  options: UseScrollAnimationOptions = {}
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  useEffect(() => {
    const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
    
    // Skip if no element ref or if we're in a reduced motion environment
    if (!elementRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(className);
          
          // If triggerOnce is true, unobserve after animation is triggered
          if (triggerOnce && observerRef.current) {
            observerRef.current.unobserve(entry.target);
          }
        } else if (!triggerOnce) {
          // Remove class when out of view (only if not triggerOnce)
          entry.target.classList.remove(className);
        }
      });
    };
    
    // Create and store the observer
    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin
    });
    
    // Start observing the element
    observerRef.current.observe(elementRef.current);
    
    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [elementRef, className, options]);
}

/**
 * Custom hook to add scroll-triggered animations to multiple elements
 * 
 * @param containerRef Reference to the container element
 * @param selector CSS selector for elements to animate
 * @param className Class to add when element is in view
 * @param options Configuration options for the intersection observer
 */
export function useScrollAnimationGroup<T extends HTMLElement>(
  containerRef: RefObject<T>,
  selector: string,
  className: string = 'in-view',
  options: UseScrollAnimationOptions = {}
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  useEffect(() => {
    const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
    
    // Skip if no container ref or if we're in a reduced motion environment
    if (!containerRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(className);
          
          // If triggerOnce is true, unobserve after animation is triggered
          if (triggerOnce && observerRef.current) {
            observerRef.current.unobserve(entry.target);
          }
        } else if (!triggerOnce) {
          // Remove class when out of view (only if not triggerOnce)
          entry.target.classList.remove(className);
        }
      });
    };
    
    // Create and store the observer
    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin
    });
    
    // Find all matching elements and observe them
    const elements = containerRef.current.querySelectorAll(selector);
    elements.forEach(element => {
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    });
    
    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [containerRef, selector, className, options]);
}