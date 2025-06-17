import React from 'react';
import './GalideUIRenderer.scss';
import { UIViewInfo, useGalideAppStore } from '../store/galideAppStore';
import UIViewRenderer from './UIViewRenderer';

export interface NeurvanaUIRendererProps {
  uiViewId: string | null;
  projectId: string | null;
  windowId?: string;
  spaceId?: string;
}

/**
 * Renders UI views as iframes using the UIViewRenderer component.
 * All UI views are now iframe-based with HTML content or URLs.
 */
const GalideUIRenderer: React.FC<NeurvanaUIRendererProps> = ({ 
  uiViewId, 
  projectId,
  windowId = 'neurvana-ui-renderer',
  spaceId = 'default-space'
}) => {
  // Get all props from the store using provided IDs or defaults
  const { openUIViews } = useGalideAppStore(windowId, spaceId);
  
  // Get the current UI view from the store
  const currentView = openUIViews.find((view: UIViewInfo) => view.id === uiViewId);
  
  console.log('[NeurvanaUIRenderer] openUIViews:', openUIViews);
  console.log('[NeurvanaUIRenderer] currentView:', currentView);
  
  // If no view is selected, show placeholder
  if (!currentView) {
    return (
      <div className="neurvana-ui-placeholder">
        <div className="placeholder-content">
          <h3>No UI View Selected</h3>
          <p>Select a UI View from the Explorer to get started</p>
          <div className="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 7H21" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 12H17" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 16H14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <p className="placeholder-tip">
            <small>You can create a new UI View by right-clicking in the Explorer and selecting "New UI View"</small>
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="neurvana-ui-renderer">
      <UIViewRenderer
        entityId={currentView.id}
        url={currentView.url}
        projectId={projectId || undefined}
        htmlContent={currentView.htmlContent}
      />
    </div>
  );
};

export default GalideUIRenderer; 