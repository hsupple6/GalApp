import React, { useCallback } from 'react';

import BrowserApp from '../../../apps/BrowserApp/BrowserApp';
import ChatApp from '../../../apps/ChatApp/ChatApp';
import ConsoleApp from '../../../apps/ConsoleApp';
import EntityBrowser from '../../../apps/EntityBrowserApp/EntityBrowserApp';
import { ImageViewerApp } from '../../../apps/ImageViewerApp/ImageViewerApp';
import NotesApp from '../../../apps/NotesApp/components/NotesApp';
import { PDFiumApp } from '../../../apps/PDFiumApp/PDFiumApp';
import SettingsApp from '../../../apps/SettingsApp/SettingsApp';
import WebDocumentApp from '../../../apps/WebDocumentApp/WebDocumentApp';
import type { BaseEntityType } from '../../../types/entities';
import type { WindowEntity } from '../../../types/windows';
import { generateWindowId, getAppTitle, getAppTypeByEntity } from '../utils/windowUtils';
import useSpaceStore from '../../../stores/spaceStore';

interface WindowRenderingProps {
  handleRemoveWindow: (windowId: string) => void;
}

interface EntityWithMetadata extends BaseEntityType {
  metadata?: {
    url?: string;
  };
}

interface WindowEntityWithMetadata extends WindowEntity {
  entity?: EntityWithMetadata;
}

export const useWindowRendering = ({ handleRemoveWindow }: WindowRenderingProps) => {
  const { 
    windows,
    activeWindowId,
    windowStates,
    windowZIndexes
  } = useSpaceStore();

  // const defaultPDFEntity: PDFEntity = {
  //   _id: '',
  //   name: '',
  //   type: 'pdfium' as const,
  //   entityType: 'File',
  //   created_at: new Date().toISOString(),
  //   updated_at: new Date().toISOString(),
  // };

  const renderImageViewerApp = useCallback(
    (entity: BaseEntityType) => {
      return (
        <ImageViewerApp
          title={getAppTitle(getAppTypeByEntity(entity) || '')}
          onClose={() => handleRemoveWindow(entity.id)}
          entity={entity}
        />
      );
    },
    [handleRemoveWindow],
  );

  const renderPDFiumApp = useCallback(
    (entity: BaseEntityType, windowId: string) => {
      return (
        <PDFiumApp
          title={getAppTitle(getAppTypeByEntity(entity) || '')}
          onClose={() => handleRemoveWindow(entity.id)}
          entity={entity}
          windowId={windowId}
        />
      );
    },
    [handleRemoveWindow],
  );

  const openWebDocument = useCallback((url: string) => {
    const windowId = generateWindowId();
    const newWindow: WindowEntity = {
      id: windowId,
      type: 'window',
      position: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 },
      size: { width: 800, height: 600 },
      appType: 'webdoc',
      title: 'Web Document',
    };

    return {
      window: newWindow,
      windowId,
    };
  }, []);

  const renderWindowContent = useCallback(
    (windowEntity: WindowEntity) => {
      if (windowEntity.component) return windowEntity.component;

      const appType = windowEntity.appType;

      if (!appType) return <div>No App Type</div>;

      switch (appType) {
        case 'chat':
          return <ChatApp title={getAppTitle(appType)} onClose={() => handleRemoveWindow(windowEntity.id)} />;
        case 'system':
          return (
            <EntityBrowser 
              windowId={windowEntity.id}
              spaceId={windowEntity.props?.spaceId || 'default'}
              title={getAppTitle(appType)} 
              onClose={() => handleRemoveWindow(windowEntity.id)} 
            />
          );
        case 'console':
          return <ConsoleApp title={getAppTitle(appType)} onClose={() => handleRemoveWindow(windowEntity.id)} />;
        // case 'pdf':
        //   return <PDFApp title={getAppTitle(appType)} onClose={() => handleRemoveWindow(windowEntity.id)} />;
        case 'notes':
          return (
            <NotesApp 
              noteId={windowEntity.entity?._id} 
              windowId={windowEntity.id}
              spaceId={windowEntity.props?.spaceId || 'default'}
              onClose={() => handleRemoveWindow(windowEntity.id)} 
            />
          );
        case 'pdfium':
          return renderPDFiumApp(windowEntity.entity, windowEntity.id);
        case 'imageviewer':
          return renderImageViewerApp(windowEntity.entity);
        case 'browser':
          return (
            <BrowserApp
              initialUrl={windowEntity.entity?.url}
              onClose={() => handleRemoveWindow(windowEntity.id)}
            />
          );
        case 'webdoc':
          return (
            <WebDocumentApp
              title={getAppTitle(appType)}
              onClose={() => handleRemoveWindow(windowEntity.id)}
              url={windowEntity.entity?.metadata?.url}
              entityId={windowEntity.entity?._id}
            />
          );
        case 'settings':
          return <SettingsApp title={getAppTitle(appType)} onClose={() => handleRemoveWindow(windowEntity.id)} />;
        default:
          return <div>Unknown App Type</div>;
      }
    },
    [handleRemoveWindow, renderPDFiumApp],
  );

  return {
    renderWindowContent,
    openWebDocument,
  };
};
