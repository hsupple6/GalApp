import './ElectronWindow.scss';

import React, { useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';

import { ElectronWindow as IElectronWindow } from '../../stores/electronWindowStore';
import useSpaceStore from '../../stores/spaceStore';
import { useWindowBehaviors } from '../Space/hooks/useWindowBehaviors';

interface ElectronWindowProps {
  window: IElectronWindow;
  onBoundsChange: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onClose: () => void;
  onFocus: () => void;
  isFocused: boolean;
}

export const ElectronWindow: React.FC<ElectronWindowProps> = ({
  window: electronWindow,
  onBoundsChange,
  onClose,
  onFocus,
  isFocused,
}) => {
  const electronRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { 
    activeWindowId,
    windowStates,
    windowZIndexes,
    bringWindowToFront
  } = useSpaceStore();
  
  const windowBehaviors = useWindowBehaviors({
    spaceWidth: globalThis.window.innerWidth,
    spaceHeight: globalThis.window.innerHeight
  });

  useEffect(() => {
    const electron = (globalThis.window as any).electron;
    if (!electron?.BrowserView || !contentRef.current) return;

    // Create BrowserView
    electronRef.current = electron.BrowserView.create({
      id: electronWindow.id,
      bounds: {
        ...electronWindow.bounds,
        x: Math.round(electronWindow.bounds.x),
        y: Math.round(electronWindow.bounds.y + 32), // Account for header height
        height: Math.round(electronWindow.bounds.height - 32),
      },
      url: electronWindow.url,
    });

    return () => {
      electronRef.current?.destroy();
    };
  }, [electronWindow.id, electronWindow.url]);

  useEffect(() => {
    if (!electronRef.current) return;
    electronRef.current.setBounds({
      ...electronWindow.bounds,
      x: Math.round(electronWindow.bounds.x),
      y: Math.round(electronWindow.bounds.y + 32), // Account for header height
      height: Math.round(electronWindow.bounds.height - 32),
    });
  }, [electronWindow.bounds]);

  return (
    <Rnd
      style={{
        zIndex: windowZIndexes[electronWindow.id] || 0,
        position: 'relative',
      }}
      position={{ x: electronWindow.bounds.x, y: electronWindow.bounds.y }}
      size={{ width: electronWindow.bounds.width, height: electronWindow.bounds.height }}
      onDragStop={(e, d) => {
        onBoundsChange({ ...electronWindow.bounds, x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onBoundsChange({
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        });
      }}
      onMouseDown={onFocus}
    >
      <div className={`electron-window ${isFocused ? 'focused' : ''}`}>
        <div className="window-header">
          <span className="window-title">{electronWindow.title}</span>
          <button onClick={onClose}>×</button>
        </div>
        <div ref={contentRef} className="window-content" />
      </div>
    </Rnd>
  );
};
