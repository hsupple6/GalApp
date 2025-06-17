import { spaceCRDTService } from '../../../services/crdt/spaceCRDTService';
import type { BaseEntityType } from '../../../types/entities';
import type { AnyWindowEntity, WindowEntity } from '../../../types/windows';
import { generateWindowId } from '../utils/windowUtils';

export interface WindowHandlerDependencies {
  addWindow: (window: WindowEntity) => void;
  windowManager: {
    bringToFront: (windowId: string) => void;
    windows: Record<string, AnyWindowEntity>;
  };
  spaceId: string;
  updateWindow: (windowId: string, updates: Partial<AnyWindowEntity>) => void;
  groupSelected: (windowIds: string[]) => void;
}

export const createWindowHandlers = (deps: WindowHandlerDependencies) => {
  const { addWindow, windowManager, spaceId, updateWindow, groupSelected } = deps;

  const createBlankWindow = (position?: { x: number; y: number }) => {
    const windowId = generateWindowId();
    const window: WindowEntity = {
      id: windowId,
      type: 'window',
      component: 'blank',
      title: 'Blank Window',
      position: position || { x: 100, y: 100 },
      size: { width: 400, height: 300 },
      props: {}
    };
    
    addWindow(window);
    windowManager.bringToFront(windowId);
    return windowId;
  };

  const createNoteWindow = () => {
    const windowId = generateWindowId();
    const window: WindowEntity = {
      id: windowId,
      type: 'window',
      position: { x: 100, y: 100 },
      size: { width: 800, height: 600 },
      appType: 'notes',
    };

    addWindow(window);
    windowManager.bringToFront(windowId);
    return windowId;
  };

  const createEntityBrowserWindow = () => {
    const windowId = generateWindowId();
    const window: WindowEntity = {
      id: windowId,
      type: 'window',
      component: 'EntityBrowser',
      title: 'Entity Browser',
      props: {
        windowId,
        spaceId
      },
      position: { x: 100, y: 100 },
      size: { width: 400, height: 600 }
    };

    addWindow(window);
    windowManager.bringToFront(windowId);
    return windowId;
  };

  const createWebDocumentWindow = (url: string, entity: BaseEntityType) => {
    const windowId = generateWindowId();
    const window: WindowEntity = {
      id: windowId,
      type: 'window',
      position: { x: 100, y: 100 },
      size: { width: 800, height: 600 },
      appType: 'webdoc',
      entity,
    };

    addWindow(window);
    windowManager.bringToFront(windowId);
    return windowId;
  };

  const addTab = (sourceWindowId: string) => {
    const sourceWindow = deps.windowManager.windows[sourceWindowId] as WindowEntity;
    if (!sourceWindow) return;

    const newTabId = generateWindowId();
    const newTab: WindowEntity = {
      id: newTabId,
      type: 'window',
      component: 'blank',
      title: 'New Tab',
      position: sourceWindow.position,
      size: sourceWindow.size,
      isTab: true,
      props: {
        onSelect: (selection: { type: string, entity?: BaseEntityType }) => {
          console.log('Tab onSelect called with:', selection);
          // Update the window based on selection
          switch (selection.type) {
            case 'note':
              deps.updateWindow(newTabId, {
                component: 'note',
                title: 'New Note',
                appType: 'notes'
              });
              break;
            
            case 'browser':
              deps.updateWindow(newTabId, {
                component: 'browser',
                title: 'New Browser',
                appType: 'browser'
              });
              break;

            case 'entity-browser':
              deps.updateWindow(newTabId, {
                component: 'EntityBrowser',
                title: 'Entity Browser',
                props: {
                  windowId: newTabId,
                  spaceId: deps.spaceId
                }
              });
              break;

            case 'entity':
              if (selection.entity) {
                deps.updateWindow(newTabId, {
                  appType: selection.entity.type,
                  entity: selection.entity,
                  title: selection.entity.name
                });
              }
              break;
          }
        }
      }
    };

    console.log('Creating new tab with:', newTab);
    addWindow(newTab);

    if (sourceWindow.tabs) {
      console.log('Adding tab to existing tabbed window:', sourceWindow.id);
      deps.updateWindow(sourceWindowId, {
        tabs: [...sourceWindow.tabs, newTabId],
        activeTabId: newTabId
      });
    } else {
      console.log('Converting window to tabbed window:', sourceWindow.id);
      deps.updateWindow(sourceWindowId, {
        tabs: [sourceWindowId, newTabId],
        activeTabId: newTabId,
        isParentWindow: true
      });
    }
  };

  return {
    createBlankWindow,
    createNoteWindow,
    createEntityBrowserWindow,
    createWebDocumentWindow,
    addTab,
  };
}; 