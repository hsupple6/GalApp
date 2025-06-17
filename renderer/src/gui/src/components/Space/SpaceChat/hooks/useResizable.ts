import { useCallback, useEffect, useState, RefObject } from 'react';

interface UseResizableProps {
  elementRef: RefObject<HTMLElement>;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  direction: 'left' | 'right';
  onWidthChange?: (width: number) => void;
}

export function useResizable({
  elementRef,
  initialWidth,
  minWidth,
  maxWidth,
  direction,
  onWidthChange,
}: UseResizableProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !elementRef.current) return;

      // Calculate new width based on mouse position and resize direction
      const currentRect = elementRef.current.getBoundingClientRect();
      let newWidth;

      if (direction === 'left') {
        // For left direction, resize by dragging left edge
        newWidth = currentRect.right - e.clientX;
      } else {
        // For right direction, resize by dragging right edge
        newWidth = e.clientX - currentRect.left;
      }

      // Constrain width between min and max values
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

      // Update width
      setWidth(newWidth);
      
      // Call the callback if provided
      if (onWidthChange) {
        onWidthChange(newWidth);
      }

      // Apply width to the element
      if (elementRef.current) {
        elementRef.current.style.width = `${newWidth}px`;
      }
    },
    [isDragging, elementRef, minWidth, maxWidth, direction, onWidthChange]
  );

  const stopResize = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResize);
      
      // Add a class to the body to show resize cursor
      document.body.classList.add('resizing');
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
      
      // Remove resize cursor class
      document.body.classList.remove('resizing');
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('resizing');
    };
  }, [isDragging, handleMouseMove, stopResize]);

  // Apply initial width
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.style.width = `${initialWidth}px`;
    }
  }, [elementRef, initialWidth]);

  return {
    width,
    isDragging,
    startResize,
  };
} 