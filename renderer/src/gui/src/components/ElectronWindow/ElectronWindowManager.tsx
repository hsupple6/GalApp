import React from 'react';

import { useElectronWindowStore } from '../../stores/electronWindowStore';
import { ElectronWindow } from './ElectronWindow';

export const ElectronWindowManager: React.FC = () => {
  const { windows, updateWindow, removeWindow, setZIndex } = useElectronWindowStore();
  const [activeWindowId, setActiveWindowId] = React.useState<string | null>(null);
  const [maxZIndex, setMaxZIndex] = React.useState(0);

  const handleFocus = (windowId: string) => {
    setActiveWindowId(windowId);
    const newZIndex = maxZIndex + 1;
    setMaxZIndex(newZIndex);
    setZIndex(windowId, newZIndex);

    const electron = (window as any).electron;
    if (electron?.BrowserView?.reorder) {
      electron.BrowserView.reorder();
    }
  };

  return (
    <>
      {Object.values(windows).map((window) => (
        <ElectronWindow
          key={window.id}
          window={window}
          onBoundsChange={(bounds) => updateWindow(window.id, { bounds })}
          onClose={() => removeWindow(window.id)}
          onFocus={() => handleFocus(window.id)}
          isFocused={activeWindowId === window.id}
        />
      ))}
    </>
  );
}; 