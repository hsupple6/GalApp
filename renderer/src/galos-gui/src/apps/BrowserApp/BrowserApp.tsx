import './BrowserApp.scss';

import React, { useEffect, useRef, useState } from 'react';

import { aiService } from '../../services/aiService';
import { selectionService } from '../../services/selectionService';
import type { WindowManager } from '../../types/windowManager';
import { BrowserActions } from './browserActions';
import BrowserViewContainer from './BrowserViewContainer';

const isElectron = !!(window as any).electron;
console.debug('isElectron:', isElectron);
console.debug('Electron object:', (window as any).electron);

interface BrowserAppProps {
  initialUrl?: string;
  onClose: () => void;
}

const BrowserApp: React.FC<BrowserAppProps> = ({ initialUrl, onClose }) => {
  const [url, setUrl] = useState(initialUrl || 'https://en.wikipedia.org/wiki/Main_Page');
  const [history, setHistory] = useState([url]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [browserView, setBrowserView] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const webviewRef = useRef<any>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Initialize Electron BrowserView
  useEffect(() => {
    if (!isElectron) {
      console.debug('Not in Electron environment');
      return;
    }

    try {
      console.debug('Initializing BrowserView...');
      const electron = (window as any).electron;

      const view = electron.BrowserView.create({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Set the window ID on the view
      view.setWindowId(url);

      console.debug('Loading initial URL...');
      view.webContents.loadURL(url);
      setBrowserView(view);

      return () => {
        console.debug('Cleaning up BrowserView...');
        try {
          view.destroy();
        } catch (err) {
          console.error('Error destroying BrowserView:', err);
        }
      };
    } catch (error) {
      console.error('Error initializing BrowserView:', error);
    }
  }, [url]);

  const formatUrl = (url: string): string => {
    if (!url.trim()) return 'about:blank';
    if (url.match(/^[a-zA-Z]+:\/\//)) return url;
    if (url.match(/^[\w-]+\.[a-zA-Z]{2,}/)) return `https://${url}`;
    return `https://google.com/search?q=${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUrl = formatUrl(url);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(formattedUrl);

    if (isElectron && webviewRef.current) {
      webviewRef.current.src = formattedUrl;
    } else if (isElectron && browserView) {
      browserView.webContents.loadURL(formattedUrl);
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setUrl(formattedUrl);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousUrl = history[newIndex];

      if (isElectron && browserView) {
        browserView.webContents.loadURL(previousUrl);
      }

      setHistoryIndex(newIndex);
      setUrl(previousUrl);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextUrl = history[newIndex];

      if (isElectron && browserView) {
        browserView.webContents.loadURL(nextUrl);
      }

      setHistoryIndex(newIndex);
      setUrl(nextUrl);
    }
  };

  const handleCopy = (e: ClipboardEvent) => {
    const selection = document.getSelection();
    if (!selection || !selection.toString().trim()) return;

    const isInBrowserUI = selection.anchorNode?.parentElement?.closest('.browser-app');
    if (!isInBrowserUI) return;

    selectionService.setSelection({
      text: selection.toString(),
      source: {
        window: {
          id: 'browser',
          type: 'window',
          appType: 'browser',
          position: { x: 0, y: 0 },
          size: { width: 0, height: 0 },
        },
        type: 'browser',
        metadata: {
          url,
          title: document.title,
        },
      },
    });
  };

  useEffect(() => {
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [url]);

  const browserActions = new BrowserActions(
    isElectron,
    () => browserView,
    () => iframeRef,
    () => ({ title: document.title, url }),
  );

  useEffect(() => {
    if (!browserView) return undefined;

    const browserActions = {
      getText: async (selector: string) => {
        if (isElectron) {
          return browserView.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector}');
              return el ? el.textContent : null;
            })();
          `);
        }
        // For iframe
        return iframeRef.current?.contentWindow?.document.querySelector(selector)?.textContent || null;
      },
      click: async (selector: string) => {
        if (isElectron) {
          return browserView.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector}');
              if (el) {
                el.click();
                return true;
              }
              return false;
            })();
          `);
        }
        const element = iframeRef.current?.contentWindow?.document.querySelector(selector);
        if (element) {
          (element as HTMLElement).click();
          return true;
        }
        return false;
      },
      fillForm: async (selector: string, value: string) => {
        if (isElectron) {
          return browserView.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('${selector}');
              if (el) {
                el.value = ${JSON.stringify(value)};
                el.dispatchEvent(new Event('input'));
                return true;
              }
              return false;
            })();
          `);
        }
        const element = iframeRef.current?.contentWindow?.document.querySelector(selector) as HTMLInputElement;
        if (element) {
          element.value = value;
          element.dispatchEvent(new Event('input'));
          return true;
        }
        return false;
      },
      getPageInfo: async () => ({
        title: isElectron
          ? await browserView.webContents.executeJavaScript('document.title')
          : iframeRef.current?.contentWindow?.document.title || '',
        url: url,
      }),
      waitForElement: async (selector: string, timeout = 5000) => {
        if (isElectron) {
          return browserView.webContents.executeJavaScript(`
            new Promise((resolve) => {
              if (document.querySelector('${selector}')) {
                resolve(true);
                return;
              }
              const observer = new MutationObserver(() => {
                if (document.querySelector('${selector}')) {
                  observer.disconnect();
                  resolve(true);
                }
              });
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
              setTimeout(() => {
                observer.disconnect();
                resolve(false);
              }, ${timeout});
            })
          `);
        }
        // Similar logic for iframe
        return new Promise((resolve) => {
          if (iframeRef.current?.contentWindow?.document.querySelector(selector)) {
            resolve(true);
            return;
          }
          setTimeout(() => resolve(false), timeout);
        });
      },
      executeJavaScript: async (code: string) => {
        if (isElectron) {
          return browserView.webContents.executeJavaScript(code);
        }
        // For iframe, you might want to handle this differently or throw an error
        throw new Error('executeJavaScript not supported in iframe mode');
      },
    };

    return () => {
      return undefined;
    };
  }, [browserView, url]);

  useEffect(() => {
    if (!browserView) return;

    const container = document.querySelector('.browser-content');
    if (!container) return;

    const handleBoundsUpdate = () => {
      const bounds = container.getBoundingClientRect();
      browserView.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      });
    };

    container.addEventListener('browser-update-bounds', handleBoundsUpdate);
    return () => container.removeEventListener('browser-update-bounds', handleBoundsUpdate);
  }, [browserView]);

  return (
    <div className="browser-app">
      <div className="browser-header">
        <div className="browser-controls">
          <button onClick={goBack} disabled={historyIndex <= 0}>
            ←
          </button>
          <button onClick={goForward} disabled={historyIndex >= history.length - 1}>
            →
          </button>
        </div>
        <form onSubmit={handleUrlSubmit} className="url-form">
          <input
            ref={urlInputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Search or enter URL"
          />
          <button type="submit">Go</button>
        </form>
      </div>
      <div className="browser-content">
        {/* Use <webview> in Electron, <iframe> as fallback */}
        {isElectron ? (
          <webview
            ref={webviewRef}
            src={url}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allowpopups={true}
            webpreferences="contextIsolation, nativeWindowOpen, javascript=yes"
            // Add more event handlers as needed
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            title="Browser Content"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BrowserApp;
