import React, { useEffect, useRef, useState, useMemo } from 'react';
import './UIViewRenderer.scss';
import * as neurvanaService from '../services/galideService';
import { BaseEntityType } from '../../../types';

interface UIViewRendererProps {
  entityId: string;
  url?: string;
  projectId?: string;
  htmlContent?: string;
}

interface UIMessage {
  type: string;
  payload: any;
}

const UIViewRenderer: React.FC<UIViewRendererProps> = ({ entityId, url: propsUrl, projectId, htmlContent: propsHtmlContent }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [uiEntity, setUiEntity] = useState<BaseEntityType | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(propsHtmlContent || null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Update internal htmlContent if props change
  useEffect(() => {
    if (propsHtmlContent) {
      setHtmlContent(propsHtmlContent);
      setIsLoading(false);
    }
  }, [propsHtmlContent]);
  
  // Fetch the entity directly to get potential HTML content
  useEffect(() => {
    const fetchEntity = async () => {
      // If we already have HTML content from props, no need to fetch
      if (propsHtmlContent) return;
      
      try {
        setIsLoading(true);
        const entity = await neurvanaService.getUIView(entityId);
        setUiEntity(entity);
        
        // Store HTML content if available
        if (entity.skeleton?.htmlContent) {
          setHtmlContent(entity.skeleton.htmlContent);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('[UIViewRenderer] Failed to fetch UI entity:', error);
        setLoadError(true);
        setIsLoading(false);
      }
    };
    
    if (entityId) {
      fetchEntity();
    }
  }, [entityId, propsHtmlContent]);
  
  // Get the URL either from props or from the entity
  const url = propsUrl || uiEntity?.skeleton?.url;
  
  // Reset initialization state when entityId or url changes
  useEffect(() => {
    setHasInitialized(false);
    setLoadError(false);
  }, [entityId, url]);

  // Fix the URL path if needed to ensure it works
  const resolvedUrl = useMemo(() => {
    
    if (!url) return undefined;
    
    // Don't modify URLs that already have origin
    if (url.startsWith('http')) {
      return url;
    }
    
    // For absolute paths, prepend origin if needed
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    
    // For relative paths, handle differently
    if (url.startsWith('./') || url.startsWith('../')) {
      // In this case, let's just use an absolute path
      // Strip relative prefix and use as absolute path
      const pathPart = url.replace(/^\.\.\//g, '/').replace(/^\.\//g, '/');
      return `${window.location.origin}${pathPart}`;
    }
    
    // Default case - just return as is
    return url;
  }, [url]);
  
  
  // Handle iframe load errors
  const handleIframeError = () => {
    setLoadError(true);
  };
  
  // When the iframe loads successfully
  const handleIframeLoad = () => {
    setLoadError(false);
  };
  
  // Function to retry loading the entity
  const handleRetry = () => {
    setLoadError(false);
    setIsLoading(true);
    
    // Only refetch if we don't have HTML content from props
    if (!propsHtmlContent) {
      // Trigger a refetch of the entity by updating the timestamp
      fetchEntity();
    }
  };
  
  // Helper function to fetch entity - extracted for reuse
  const fetchEntity = async () => {
    try {
      setIsLoading(true);
      const entity = await neurvanaService.getUIView(entityId);
      setUiEntity(entity);
      
      // Store HTML content if available
      if (entity.skeleton?.htmlContent) {
        setHtmlContent(entity.skeleton.htmlContent);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('[UIViewRenderer] Failed to fetch UI entity:', error);
      setLoadError(true);
      setIsLoading(false);
    }
  };
  
  // Generate a fallback HTML content based on entity ID
  const getFallbackHtml = () => {
    return `
      <html>
        <head>
          <title>UI View ${entityId}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 20px;
              background-color: #f5f5f5;
              color: #333;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            h1 { color: #0066cc; margin-bottom: 10px; }
            .loading { 
              display: inline-block;
              width: 50px;
              height: 50px;
              border: 3px solid rgba(0,102,204,0.3);
              border-radius: 50%;
              border-top-color: #0066cc;
              animation: spin 1s ease-in-out infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .note { 
              background: #e6f7ff; 
              padding: 15px; 
              border-radius: 4px; 
              max-width: 80%;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="loading"></div>
          <h1>UI View</h1>
          <p>Loading UI component...</p>
          <div class="note">
            <p>Entity ID: ${entityId}</p>
          </div>
        </body>
      </html>
    `;
  };
  
  // Get the error page HTML
  const getErrorHtml = () => {
    return `
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 20px;
              background-color: #f5f5f5;
              color: #333;
              text-align: center;
            }
            h1 { color: #0066cc; }
            .note { 
              background: #e6f7ff; 
              padding: 15px; 
              border-radius: 4px;
              margin: 20px auto;
              max-width: 80%;
              text-align: left;
            }
            pre { 
              background: #f0f0f0; 
              padding: 10px; 
              border-radius: 4px; 
              white-space: pre-wrap;
              word-break: break-all;
            }
            button {
              background-color: #0066cc;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h1>UI Load Error</h1>
          <p>There was a problem loading the UI component.</p>
          <div class="note">
            <strong>Note:</strong> The UI file could not be loaded.
            <pre>URL: ${resolvedUrl || 'No URL provided'}</pre>
            <pre>Entity ID: ${entityId}</pre>
          </div>
          <hr>
          <p><strong>Troubleshooting:</strong></p>
          <ol style="text-align: left; max-width: 80%; margin: 0 auto;">
            <li>Check if the file exists at the specified path</li>
            <li>Verify URL path is correct</li>
            <li>Check browser console for CORS or other errors</li>
          </ol>
          <button onclick="window.parent.postMessage({type: 'UI_RETRY'}, '*')">
            Retry Loading
          </button>
        </body>
      </html>
    `;
  };
  
  // Set up message listener for the retry button in the error page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'UI_RETRY') {
        handleRetry();
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);
  
  // If the iframe fails to load, render fallback HTML using srcdoc
  useEffect(() => {
    if (iframeRef.current) {
      if (loadError) {
        // Show error page
        iframeRef.current.srcdoc = getErrorHtml();
      } else if (htmlContent) {
        // If we have HTML content, use it directly
        console.log('[UIViewRenderer] Using HTML content from entity');
        iframeRef.current.srcdoc = htmlContent;
      } else if (!resolvedUrl) {
        // If we don't have a URL or HTML content yet, show loading state
        console.log('[UIViewRenderer] Using fallback content while loading');
        iframeRef.current.srcdoc = getFallbackHtml();
      }
    }
  }, [loadError, resolvedUrl, entityId, htmlContent]);
  
  // Add a retry button in the UI
  const renderRetryButton = () => {
    if (loadError) {
      return (
        <button 
          className="retry-button"
          onClick={handleRetry}
        >
          Retry Loading
        </button>
      );
    }
    return null;
  };
  
  // Render the iframe with either URL or HTML content
  return (
    <div className="uiview-renderer">
      <iframe
        ref={iframeRef}
        className="uiview-iframe"
        src={htmlContent ? undefined : resolvedUrl}
        onError={handleIframeError}
        onLoad={handleIframeLoad}
        title={`UI View ${entityId}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        allow="clipboard-read; clipboard-write"
      />
      {renderRetryButton()}
    </div>
  );
};

export default UIViewRenderer; 