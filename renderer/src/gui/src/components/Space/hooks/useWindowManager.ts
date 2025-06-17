// import { Dispatch, SetStateAction, useCallback, useState } from 'react';

// import type { AnyWindowEntity } from '../../../types/windows';

// export interface WindowState {
//   position: { x: number; y: number };
//   size: { width: number; height: number };
// }

// interface WindowManagerOptions {
//   cycleWindows: (direction: 'forward' | 'backward') => void;
//   groupSelected: () => void;
//   ungroup: (groupId: string) => void;
//   updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => void;
//   selectedIds: string[];
//   entities: Record<string, AnyWindowEntity>;
//   spaceId: string;
// }

// export interface WindowManager {
//   openWindows: string[];
//   activeWindowId: string | null;
//   windowZedIndexes: Record<string, number>;
//   windowStates: Record<string, WindowState>;
//   setOpenWindows: Dispatch<SetStateAction<string[]>>;
//   setActiveWindowId: Dispatch<SetStateAction<string | null>>;
//   setWindowStates: Dispatch<SetStateAction<Record<string, WindowState>>>;
//   bringToFront: (windowId: string) => void;
//   handleKeyboardShortcuts: (
//     event: KeyboardEvent,
//     activeWindowId: string | null,
//     spaceWidth: number,
//     spaceHeight: number,
//     options: WindowManagerOptions,
//   ) => void;
// }

// export const useWindowManager = () => {
//   const [openWindows, setOpenWindows] = useState<string[]>([]);
//   const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
//   const [windowStates, setWindowStates] = useState<Record<string, WindowState>>({});
//   const [windowZedIndexes, setWindowZedIndexes] = useState<Record<string, number>>({});

//   const bringToFront = useCallback(async (windowId: string) => {
//     // delay window activation, since double-click events could interrupt it
//     await new Promise<void>((resolve) => setTimeout(resolve, 100));
//     console.log('[useWindowManager] bringToFront', { windowId });
//     setWindowZedIndexes((prevWindowZedIndexes) => {
//       const maxZedIndex = Math.max(0, ...Object.values(prevWindowZedIndexes));

//       const newZIndexes = {
//         ...prevWindowZedIndexes,
//         [windowId]: maxZedIndex + 1,
//       };

//       const sortedZedIndexes = Object.entries(newZIndexes)
//         .sort(([, aVal]: [string, number], [, bVal]: [string, number]) => aVal - bVal)
//         .reduce((acc: Record<string, number>, [key, val]: [string, number], idx) => {
//           return { ...acc, [key]: idx + 1 };
//         }, {});

//       // Update both regular windows and BrowserViews
//       const electron = (window as any).electron;
//       if (electron?.BrowserView?.reorder) {
//         // Pass all z-indexes to ensure proper stacking
//         electron.BrowserView.reorder(sortedZedIndexes);
//       }

//       return newZIndexes;
//     });

//     setActiveWindowId(windowId);
//   }, []);

//   const snapWindowToQuadrant = useCallback(
//     (
//       windowId: string,
//       quadrant: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
//       spaceWidth: number,
//       spaceHeight: number,
//       updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => void,
//     ) => {
//       let newX = 0;
//       let newY = 0;
//       const newWidth = spaceWidth / 2;
//       const newHeight = spaceHeight / 2;

//       switch (quadrant) {
//         case 'top-left':
//           newX = 0;
//           newY = 0;
//           break;
//         case 'top-right':
//           newX = spaceWidth / 2;
//           newY = 0;
//           break;
//         case 'bottom-left':
//           newX = 0;
//           newY = spaceHeight / 2;
//           break;
//         case 'bottom-right':
//           newX = spaceWidth / 2;
//           newY = spaceHeight / 2;
//           break;
//       }

//       updateWindow(windowId, {
//         position: { x: newX, y: newY },
//         size: { width: newWidth, height: newHeight },
//       });
//     },
//     [],
//   );

//   const snapWindowToSide = useCallback(
//     (windowId: string, direction: 'left' | 'right', spaceWidth: number, viewportHeight: number) => {
//       return {
//         position: {
//           x: direction === 'left' ? 0 : spaceWidth / 2,
//           y: 0,
//         },
//         size: {
//           width: spaceWidth / 2,
//           height: viewportHeight,
//         },
//       };
//     },
//     [],
//   );

//   const cycleWindows = useCallback(
//     (direction: 'forward' | 'backward') => {
//       if (openWindows.length <= 1) return;

//       const currentIndex = activeWindowId ? openWindows.indexOf(activeWindowId) : -1;

//       const nextIndex =
//         direction === 'forward'
//           ? (currentIndex + 1) % openWindows.length
//           : (currentIndex - 1 + openWindows.length) % openWindows.length;

//       bringToFront(openWindows[nextIndex]);
//     },
//     [openWindows, activeWindowId, bringToFront],
//   );

//   const handleKeyboardShortcuts = useCallback(
//     (
//       event: KeyboardEvent,
//       activeWindowId: string | null,
//       spaceWidth: number,
//       spaceHeight: number,
//       options: WindowManagerOptions,
//     ) => {
//       // Snap to sides
//       if (activeWindowId) {
//         if (event.shiftKey && event.key === 'ArrowLeft') {
//           const { position, size } = snapWindowToSide(activeWindowId, 'left', spaceWidth, window.innerHeight);
//           options.updateWindow(activeWindowId, { position, size });
//         } else if (event.shiftKey && event.key === 'ArrowRight') {
//           const { position, size } = snapWindowToSide(activeWindowId, 'right', spaceWidth, window.innerHeight);
//           options.updateWindow(activeWindowId, { position, size });
//         }
//       }

//       // Snap to quadrants
//       if (activeWindowId && event.shiftKey) {
//         switch (event.code) {
//           case 'Digit1':
//             snapWindowToQuadrant(activeWindowId, 'top-left', spaceWidth, spaceHeight, options.updateWindow);
//             break;
//           case 'Digit2':
//             snapWindowToQuadrant(activeWindowId, 'top-right', spaceWidth, spaceHeight, options.updateWindow);
//             break;
//           case 'Digit3':
//             snapWindowToQuadrant(activeWindowId, 'bottom-left', spaceWidth, spaceHeight, options.updateWindow);
//             break;
//           case 'Digit4':
//             snapWindowToQuadrant(activeWindowId, 'bottom-right', spaceWidth, spaceHeight, options.updateWindow);
//             break;
//         }
//       }

//       // Window cycling
//       if (event.metaKey || event.ctrlKey) {
//         if (event.key === ']') {
//           event.preventDefault();
//           options.cycleWindows('forward');
//         } else if (event.key === '[') {
//           event.preventDefault();
//           options.cycleWindows('backward');
//         }
//       }

//       // Group/Ungroup Windows
//       if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
//         event.preventDefault();
//         const selectedWindow = options.selectedIds.length === 1 ? options.entities[options.selectedIds[0]] : null;
//         if (selectedWindow?.tabs) {
//           // Remove tabs from window
//           options.updateWindow(selectedWindow.id, {
//             tabs: undefined,
//             activeTabId: undefined,
//             isParentWindow: undefined
//           });
//         } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g') {
//           event.preventDefault();
//           if (options.selectedIds.length >= 2) {
//             options.groupSelected();
//           }
//         }
//       }
//     },
//     [snapWindowToSide, snapWindowToQuadrant],
//   );

//   return {
//     openWindows,
//     setOpenWindows,
//     activeWindowId,
//     setActiveWindowId,
//     windowStates,
//     setWindowStates,
//     windowZedIndexes,
//     bringToFront,
//     snapWindowToQuadrant,
//     snapWindowToSide,
//     cycleWindows,
//     handleKeyboardShortcuts,
//   };
// };

export {}