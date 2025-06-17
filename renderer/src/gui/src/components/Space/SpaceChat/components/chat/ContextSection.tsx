import './ContextSection.scss';

import React from 'react';
import { useContextStore } from '../../store/contextStore';
import useSpaceStore from '../../../../../stores/spaceStore';
import { ContextSelector } from './ContextSelector';
import useEntityStore from '../../../../../stores/entityStore';
import { WindowWithApplicationState } from '../../../../../types/appState';
import { getAppTitleByType, getWindowTitle } from '../../../../../components/Space/utils/windowUtils';

interface ContextSectionProps {
  isVisible: boolean;
  onRemove: (id: string) => void;
  onNotification?: (message: string) => void;
}

// Helper function to get a friendly window type name
const getWindowContext = (window: any) => {
  if (!window) return null;

  const windowWithState = window as WindowWithApplicationState;
  const type = windowWithState.appType || windowWithState.type || windowWithState.skeleton?.type || 'Unknown';

  // Check for application state, specifically for DocsApp
  if (windowWithState.applicationState?.docs) {
    const docsState = windowWithState.applicationState.docs;

    // If we're editing a document, use its name
    if (docsState.currentState === 'editing' && docsState.currentDocName) {
      return {
        type: 'Document',
        name: docsState.currentDocName,
      };
    }

    // If we have an activeDocId but no currentDocName, try to find it in recentDocs
    if (docsState.activeDocId && docsState.recentDocs) {
      const activeDoc = docsState.recentDocs.find((doc) => doc.docId === docsState.activeDocId);
      if (activeDoc && activeDoc.name) {
        return {
          type: 'Document',
          name: activeDoc.name,
        };
      }
    }
  }

  // Default fallback to normal window name/title
  const name = windowWithState.name || windowWithState.title || windowWithState.skeleton?.name || type;
  return {
    type,
    name,
  };
};

export const ContextSection: React.FC<ContextSectionProps> = ({ isVisible, onRemove, onNotification }) => {
  const { context, removeWindowContent, pastedContext, setPastedContext, addWindowToContext } = useContextStore();
  const spaceStore = useSpaceStore();

  if (!isVisible) {
    return null;
  }

  const handleRemoveContext = (windowId: string) => {
    removeWindowContent(windowId);
    onRemove(windowId);
  };

  const handleClearPastedContext = () => {
    setPastedContext(null);
  };

  const handleSelectEntity = (itemId: string) => {
    // Always add to context using the context store's method
    addWindowToContext(itemId);

    if (onNotification) {
      // Get entity information to show in the notification
      const window = spaceStore.windows[itemId];
      const entity = window
        ? null
        : useEntityStore.getState().entities.find((e) => e.id === itemId || e._id === itemId);

      if (window) {
        const windowName = (window as any).name || (window as any).title || itemId;
        onNotification(`Added ${windowName} to context`);
      } else if (entity) {
        onNotification(`Added ${entity.name} (${entity.entityType}) to context`);
      } else {
        onNotification(`Added item to context`);
      }
    }
  };

  // Truncate long text with ellipsis
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Format a line range nicely
  const formatLineRange = (metadata: any) => {
    if (!metadata?.lineRange) return '';

    const { startLine, endLine } = metadata.lineRange;
    if (startLine === endLine) {
      return `Line ${startLine}`;
    }
    return `Lines ${startLine}-${endLine}`;
  };

  return (
    <div className="context-section">
      <div className="context-header">
        <div className="context-header-title">Context</div>
        <ContextSelector onSelectEntity={handleSelectEntity} />
      </div>

      {/* Show pasted context if it exists */}

      <div className="context-items">
        {pastedContext && (
          <div className="pasted-context context-item">
            <div className="pasted-context-header">
              <span className="pasted-context-title">
                <span>{pastedContext.source.window.title || 'Document'}</span>
                {pastedContext.source.metadata.nodeRange && (
                  <span className="pasted-context-range">
                    Lines {pastedContext.source.metadata.nodeRange.startLine}-
                    {pastedContext.source.metadata.nodeRange.endLine}
                  </span>
                )}
              </span>
              <button className="context-item-remove" onClick={handleClearPastedContext} title="Clear pasted context">
                <span className="clear-context-button-text">×</span>
              </button>
            </div>
            <div className="pasted-context-content">{pastedContext.text}</div>
          </div>
        )}
        {/* Show window contents */}
        {Object.entries(context.windowContents).map(([windowId, content]) => {
          // Get the window to check for component property
          const window = spaceStore.windows[windowId];
          const displayTitle = window ? getWindowTitle(window) : content.title || windowId;

          return (
            <div key={windowId} className="context-item">
              <div className="context-item-content">
                <div className="context-item-title">
                  <span>{displayTitle}</span>
                </div>
                <div className="context-item-subtitle">
                  <span>{getAppTitleByType(content.appType || window?.component || '')}</span>
                </div>
              </div>
              <button
                className="context-item-remove"
                onClick={() => handleRemoveContext(windowId)}
                title="Remove from context"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContextSection;
