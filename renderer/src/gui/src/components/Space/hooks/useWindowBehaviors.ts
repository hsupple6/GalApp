import { useCallback } from 'react';
import useSpaceStore from '../../../stores/spaceStore';
import type { AnyWindowEntity, WindowEntity } from '../../../types/windows';
import { generateWindowId } from '../utils/windowUtils';

export interface WindowBehaviorOptions {
  spaceWidth?: number;
  spaceHeight?: number;
}

export const useWindowBehaviors = ({ spaceWidth = window.innerWidth, spaceHeight = window.innerHeight }: WindowBehaviorOptions) => {
  const store = useSpaceStore();

  const snapWindowToQuadrant = useCallback(
    (windowId: string, quadrant: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
      const newWidth = spaceWidth / 2;
      const newHeight = spaceHeight / 2;
      const newPosition = {
        x: quadrant.includes('right') ? spaceWidth / 2 : 0,
        y: quadrant.includes('bottom') ? spaceHeight / 2 : 0
      };

      store.setWindowState(windowId, {
        position: newPosition,
        size: { width: newWidth, height: newHeight }
      });
    },
    [spaceWidth, spaceHeight, store]
  );

  const snapWindowToSide = useCallback(
    (windowId: string, direction: 'left' | 'right') => {
      store.setWindowState(windowId, {
        position: {
          x: direction === 'left' ? 0 : spaceWidth / 2,
          y: 0,
        },
        size: {
          width: spaceWidth / 2,
          height: spaceHeight,
        },
      });
    },
    [spaceWidth, spaceHeight, store]
  );

  const cycleWindows = useCallback(
    (direction: 'forward' | 'backward') => {
      const windowIds = Object.keys(store.windows);
      if (windowIds.length <= 1) return;

      const currentIndex = store.activeWindowId ? windowIds.indexOf(store.activeWindowId) : -1;
      const nextIndex = direction === 'forward'
        ? (currentIndex + 1) % windowIds.length
        : (currentIndex - 1 + windowIds.length) % windowIds.length;

      store.bringWindowToFront(windowIds[nextIndex]);
    },
    [store]
  );

  const handleKeyboardShortcuts = useCallback(
    (event: KeyboardEvent) => {
      if (!store.activeWindowId) return;

      // Snap to sides
      if (event.shiftKey) {
        if (event.key === 'ArrowLeft') {
          snapWindowToSide(store.activeWindowId, 'left');
        } else if (event.key === 'ArrowRight') {
          snapWindowToSide(store.activeWindowId, 'right');
        }
      }

      // Snap to quadrants
      if (event.shiftKey) {
        switch (event.code) {
          case 'Digit1':
            snapWindowToQuadrant(store.activeWindowId, 'top-left');
            break;
          case 'Digit2':
            snapWindowToQuadrant(store.activeWindowId, 'top-right');
            break;
          case 'Digit3':
            snapWindowToQuadrant(store.activeWindowId, 'bottom-left');
            break;
          case 'Digit4':
            snapWindowToQuadrant(store.activeWindowId, 'bottom-right');
            break;
        }
      }

      // Window cycling
      if (event.metaKey || event.ctrlKey) {
        if (event.key === ']') {
          event.preventDefault();
          cycleWindows('forward');
        } else if (event.key === '[') {
          event.preventDefault();
          cycleWindows('backward');
        }
      }
    },
    [store.activeWindowId, snapWindowToSide, snapWindowToQuadrant, cycleWindows]
  );

  const openWebDocument = useCallback((url: string) => {
    const windowId = generateWindowId();
    const newWindow: WindowEntity = {
      id: windowId,
      type: 'window',
      position: { x: spaceWidth / 2 - 400, y: spaceHeight / 2 - 300 },
      size: { width: 800, height: 600 },
      appType: 'webdoc',
      title: 'Web Document',
    };

    return {
      window: newWindow,
      windowId,
    };
  }, [spaceWidth, spaceHeight]);

  return {
    snapWindowToQuadrant,
    snapWindowToSide,
    cycleWindows,
    handleKeyboardShortcuts,
    openWebDocument,
  };
}; 