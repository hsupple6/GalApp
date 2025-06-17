import './WebDocumentApp.scss';

import React, { useEffect, useState } from 'react';

import { webDocumentService } from '../../services/webDocumentService';

// Check if we're running in Electron
const isElectron = !!(window as any).electron;

interface WebDocumentAppProps {
  title: string;
  onClose: () => void;
  url?: string;
  entityId?: string;
}

const WebDocumentApp: React.FC<WebDocumentAppProps> = ({ 
  title, 
  onClose, 
  url: initialUrl,
  entityId 
}) => {
  const [url, setUrl] = useState<string>(initialUrl || '');
  const [isUrlSubmitted, setIsUrlSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [browserView, setBrowserView] = useState<any>(null);

  // Initialize BrowserView for Electron
  useEffect(() => {
    if (isElectron && isUrlSubmitted && url) {
      const { BrowserView, getCurrentWindow } = (window as any).electron;
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });
      
      const currentWindow = getCurrentWindow();
      currentWindow.addBrowserView(view);
      
      // Set initial bounds
      const container = document.querySelector('.web-document-content');
      if (container) {
        const bounds = container.getBoundingClientRect();
        view.setBounds({ 
          x: Math.round(bounds.x), 
          y: Math.round(bounds.y), 
          width: Math.round(bounds.width), 
          height: Math.round(bounds.height) 
        });
      }

      view.webContents.loadURL(url);
      setBrowserView(view);

      // Cleanup function
      return () => {
        currentWindow.removeBrowserView(view);
      };
    }
  }, [isUrlSubmitted, url]);

  // Load existing document if entityId is provided
  useEffect(() => {
    if (entityId) {
      webDocumentService.get(entityId)
        .then(doc => {
          setUrl(doc.skeleton.url);
          setIsUrlSubmitted(true);
        })
        .catch(err => {
          console.error('Error loading web document:', err);
          setError('Failed to load document');
        });
    } else if (initialUrl) {
      setIsUrlSubmitted(true);
    }
  }, [entityId, initialUrl]);

  // Handle window resize for BrowserView
  useEffect(() => {
    if (isElectron && browserView) {
      const handleResize = () => {
        const container = document.querySelector('.web-document-content');
        if (container) {
          const bounds = container.getBoundingClientRect();
          browserView.setBounds({ 
            x: Math.round(bounds.x), 
            y: Math.round(bounds.y), 
            width: Math.round(bounds.width), 
            height: Math.round(bounds.height) 
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [browserView]);

  const createWebDocument = async (url: string) => {
    try {
      return await webDocumentService.create({
        url,
        title: title || 'Web Document'
      });
    } catch (err) {
      console.error('Error creating web document:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      try {
        setError('');
        const webDocument = await createWebDocument(url);
        setIsUrlSubmitted(true);
        
        window.dispatchEvent(new CustomEvent('webDocumentUrlChange', {
          detail: {
            entityId: webDocument._id,
            url
          }
        }));
      } catch (err) {
        setError('Failed to load document. Please try again.');
      }
    }
  };

  if (!isUrlSubmitted) {
    return (
      <div className="web-document-app">
        <form onSubmit={handleSubmit} className="url-input-form">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL (e.g., https://example.com)"
            autoFocus
          />
          <button type="submit">Load</button>
          {error && <div className="error-message">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="web-document-app">
      <div className="web-document-content">
        {!isElectron && (
          <iframe 
            src={url} 
            title={title}
            width="100%" 
            height="100%"
          />
        )}
      </div>
    </div>
  );
};

export default WebDocumentApp; 