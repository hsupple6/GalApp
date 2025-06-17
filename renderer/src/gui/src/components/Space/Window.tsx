import './Window.scss';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Rnd, RndResizeStartCallback, RndDragEvent } from 'react-rnd';
import useSpaceStore from '../../stores/spaceStore';

import type { AnyWindowEntity } from '../../types/windows';
import TabGroup from './TabGroup';
import { logger } from '../../utils/logger';

interface WindowProps {
  children?: React.ReactNode;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isSelected?: boolean;
  id: string;
  zIndex: number;
  onClose: () => void;
  onClick: (windowId: string, event: React.MouseEvent) => void;
  onFocus?: () => void;
  onDrag?: (windowId: string, x: number, y: number) => void;
  onDragStop: (x: number, y: number) => void;
  onResizeStop: (width: number, height: number) => void;
  isFocused?: boolean;
  onAddWindow?: () => void;
  
  // Tab props
  tabs?: string[];
  activeTabId?: string;
  onActivateTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;

  // New props for tab content
  entityId?: string;
  tabContents: Record<string, React.ReactNode>;
}

// Function to detect device performance
const getDevicePerformanceLevel = (): 'low' | 'medium' | 'high' => {
  if (typeof window === 'undefined') return 'medium';
  
  // Check for high-end devices
  if (
    window.navigator.hardwareConcurrency >= 8
  ) {
    return 'high';
  }
  
  // Check for low-end devices
  if (
    window.navigator.hardwareConcurrency <= 2
  ) {
    return 'low';
  }
  
  return 'medium';
};

// Determine throttle interval based on performance
// More frequent updates on high-performance devices
const getThrottleInterval = (): number => {
  const level = getDevicePerformanceLevel();
  switch (level) {
    case 'high':
      return 4; // Very smooth dragging for high-end devices (250fps)
    case 'medium':
      return 8; // Smooth dragging for medium devices (120fps)
    case 'low':
      return 12; // Still responsive for low-end devices (83fps)
  }
};

const Window: React.FC<WindowProps> = ({
  children,
  title,
  position,
  size,
  isSelected,
  id,
  zIndex,
  onClose,
  onClick,
  onFocus,
  onDrag,
  onDragStop,
  onResizeStop,
  isFocused,
  onAddWindow,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  entityId,
  tabContents,
}) => {
  const [showFocusStyle, setShowFocusStyle] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const lastPosition = useRef({ x: position?.x || 0, y: position?.y || 0 });
  const dragStartPosition = useRef({ x: 0, y: 0 });
  
  // Track our own window position state to avoid constant re-renders
  const [localPosition, setLocalPosition] = useState(position);
  
  // Update local position when props change
  useEffect(() => {
    // CRITICAL FIX: Don't update from props during dragging
    // This prevents the window from fighting between local drag position and props updates
    if (isDragging || isResizing) {
      return;
    }
    
    // Only update if there's a meaningful change
    if (Math.abs((localPosition?.x || 0) - position.x) > 0.1 || 
        Math.abs((localPosition?.y || 0) - position.y) > 0.1) {
      logger.log(`[Window] ${id} position updated from props: (${position.x}, ${position.y})`);
      setLocalPosition(position);
      
      // Update our tracking reference as well
      lastPosition.current = { x: position.x, y: position.y };
    }
  }, [position.x, position.y, id, localPosition, isDragging, isResizing]);
  
  // Handle the start of dragging
  const handleDragStart = useCallback((e: RndDragEvent, d: { x: number, y: number }) => {
    // Check if the click target is within the window header buttons
    const target = e.target as HTMLElement;
    if (target.closest('.window-header-buttons')) {
      logger.log(`[Window][handleDragStart] Prevented drag start - clicked on header button`);
      return false; // Prevent drag operation
    }

    logger.log(`[Window][handleDragStart] Window ${id} drag starting at (${d.x}, ${d.y})`);
    
    // Set the global flag to true before any drag operations
    (window as any).__windowDragging = true;
    setIsDragging(true);
    
    // Remember where we started
    dragStartPosition.current = { x: d.x, y: d.y };
    lastPosition.current = { x: d.x, y: d.y };
  }, [id]);

  // Handle drag events during the drag operation
  const handleDrag = useCallback((e: RndDragEvent, d: { x: number, y: number }) => {
    // CRITICAL: Always update local position immediately for smooth visual feedback
    setLocalPosition(d);
    
    // PERFORMANCE FIX: Remove aggressive throttling since Space.tsx now handles 
    // drag positions locally without CRDT updates. This ensures the window 
    // follows the cursor smoothly even during fast drag movements.
    
    if (onDrag) {
      // Call onDrag on every event - it's now cheap since Space.tsx 
      // only updates local dragPositions state
      onDrag(id, d.x, d.y);
    }

    // Update position reference for next calculation
    lastPosition.current = { x: d.x, y: d.y };
  }, [id, onDrag]);

  // Handle the end of dragging
  const handleDragStop = useCallback((e: any, d: { x: number, y: number }) => {
    logger.log(`[Window][handleDragStop] Window ${id} stopped at (${d.x}, ${d.y})`);
    
    // Reset the global flag
    (window as any).__windowDragging = false;
    setIsDragging(false);
    setIsResizing(false);
    
    // Always notify parent component about the final position
    if (onDragStop) {
      onDragStop(d.x, d.y);
    }
    
    // Reset last position for next drag
    lastPosition.current = { x: d.x, y: d.y };
  }, [id, onDragStop]);

  useEffect(() => {
    if (isFocused) {
      setShowFocusStyle(true);
      const timer = setTimeout(() => {
        setShowFocusStyle(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  // Add debug properties to window object
  (window as any).__DEBUG_WINDOW_ID__ = id;
  (window as any).__DEBUG_PARENT_ID__ = tabs?.[0] || null;

  const handleCloseTab = (tabId: string) => {
    if (tabs?.length === 2) {
      // If only 2 tabs left, closing one should remove tab properties
      onClose();
    } else if (tabs) {
      // Remove this tab from the tabs array
      const newTabs = tabs.filter(id => id !== tabId);
      onActivateTab?.(newTabs[0]);  // Activate first remaining tab
      // Parent component should handle updating the window
    }
  };

  const handleClose = () => {
    if (tabs) {
      // Close all tab windows when closing a tabbed window
      tabs.forEach(tabId => onCloseTab?.(tabId));
    }
    onClose();
  };

  // Add test debug function
  useEffect(() => {
    // For testing - attach the window component to global window object
    (window as any).windowComponents = (window as any).windowComponents || {};
    (window as any).windowComponents[id] = {
      id,
      updatePosition: (x: number, y: number) => {
        logger.log(`[TEST] Manual window update: ${id} to position (${x}, ${y})`);
        if (onDrag) {
          onDrag(id, x, y);
        }
      }
    };
    
    return () => {
      delete (window as any).windowComponents[id];
    };
  }, [id, onDrag]);

  // Cleanup effect (simplified since we removed frameRequestRef)
  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Fix the onResizeStart handler with proper typing
  const handleResizeStart: RndResizeStartCallback = useCallback((
    e,
    dir,
    refEl
  ) => {
    logger.log(`[Window][handleResizeStart] Window ${id} resize starting`);
    
    // Set the global flag to true before any resize operations
    (window as any).__windowDragging = true;
    setIsResizing(true);
  }, [id]);

  // Create inline styles for dragging state to avoid CSS class lag
  const getDraggingStyles = useCallback(() => {
    if (!isDragging && !isResizing) return {};
    
    const baseStyles = {
      boxShadow: showFocusStyle 
        ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 1.5px #009dff'
        : '0 20px 40px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.2)',
      zIndex: (zIndex * 2) + 1000,
    };

    // Remove the scale transform to fix the zoom issue
    // The original code applied transform: 'scale(1.02)' during dragging
    // which caused the unnecessary zoom effect
    return baseStyles;
  }, [isDragging, isResizing, showFocusStyle, zIndex]);

  return (
    <Rnd
      style={{ zIndex: zIndex * 2 }}
      minWidth={200}
      minHeight={150}
      onMouseDown={onFocus}
      position={localPosition}
      size={size}
      dragHandleClassName="window-header"
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={handleResizeStart}
      onResize={(e, direction, ref, delta, position) => {
        // Update position immediately during resize
        setLocalPosition(position);
        
        if (onDrag) {
          onDrag(id, position.x, position.y);
        }
        lastPosition.current = position;
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        handleDragStop(e, position);
        onResizeStop(ref.offsetWidth, ref.offsetHeight);
      }}
      enableResizing={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true,
      }}
    >
      <div
        className={`window ${isSelected ? 'selected' : ''} ${showFocusStyle ? 'focused' : ''}`}
        data-window-id={id}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          '--window-z-index': zIndex * 2,
          ...getDraggingStyles()
        } as React.CSSProperties & { '--window-z-index': number }}
      >
        <div className="window-header">
          <div
            className="select-handle"
            onMouseDown={(e) => {
              e.stopPropagation();
              onClick(id, e);
            }}
          />
          <span className="window-title">{title}</span>
          
          {tabs && (
            <TabGroup
              windowIds={tabs}
              activeId={activeTabId || tabs[0]}
              onActivate={onActivateTab}
              onCloseTab={handleCloseTab}
            />
          )}

          <div className="window-header-buttons">
            <button className="systemButton systemAddButton" onClick={onAddWindow}>
              +
            </button>
            <button className="systemButton systemCloseButton" onClick={handleClose}>
              ×
            </button>
          </div>
        </div>

        <div className="window-content" onClick={(e) => e.stopPropagation()}>
          {tabs ? (
            <div className="tabbed-window-content">
              {tabs.map((tabId) => (
                <div
                  key={tabId}
                  style={{
                    display: tabId === activeTabId ? 'block' : 'none',
                    height: '100%',
                  }}
                >
                  {tabContents[tabId === id ? `${id}-${entityId}` : tabId]}
                </div>
              ))}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </Rnd>
  );
};

export default Window;
