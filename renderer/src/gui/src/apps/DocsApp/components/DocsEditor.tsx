import './DocsEditor.scss';

import React, { useEffect, useImperativeHandle, forwardRef, useState, useRef, useCallback } from 'react';
import { useDocsAppStore } from '../store/docsAppStore';
import YProsemirrorEditor from './DocsYProsemirrorEditor';
import DocumentRibbon from './DocumentRibbon';
import { entityService } from '../../../services/entityService';
import * as Y from 'yjs';

export interface DocsEditorRef {
  streamContent: (content: string) => void;
}

interface DocsEditorProps {
  docId: string;
  onBack?: () => void;
  onClose?: () => void;
  windowId: string;
  spaceId: string;
}

const DocsEditor = forwardRef<DocsEditorRef, DocsEditorProps>(
  ({ docId, onBack, onClose, windowId, spaceId }, ref) => {
    const { 
      initialize,
      editorView,
      editorViewGetCurrentText,
      recentDocs,
      docId: activeDocId,
      ydoc,
      zoomLevel,
      zoomIn: storeZoomIn,
      zoomOut: storeZoomOut,
      resetZoom: storeResetZoom,
      setZoomLevel
    } = useDocsAppStore(windowId, spaceId);

    const [activeTab, setActiveTab] = useState('home');
    const [wordCount, setWordCount] = useState(0);
    const [documentTitle, setDocumentTitle] = useState('Untitled Document');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Store ydoc in ref when it changes
    useEffect(() => {
      if (ydoc) {
        ydocRef.current = ydoc;
      }
    }, [ydoc]);

    // Close menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsMenuOpen(false);
        }
      };

      if (isMenuOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isMenuOpen]);

    // Export to Word function
    const exportToWord = useCallback(async () => {
      try {
        const textContent = editorViewGetCurrentText();
        const cleanTitle = documentTitle.replace(/[^a-zA-Z0-9-_\s]/g, ''); // Remove special characters for filename
        
        // Convert text to HTML with proper paragraph formatting
        const htmlContent = textContent
          .split('\n')
          .map(line => line.trim() === '' ? '<p>&nbsp;</p>' : `<p>${line}</p>`)
          .join('');
        
        // Create a full HTML document with proper Word-compatible structure
        const fullHtml = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    <style>
        body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; margin: 1in; }
        p { margin: 0 0 12pt 0; }
        h1 { font-size: 16pt; font-weight: bold; margin: 24pt 0 12pt 0; }
        h2 { font-size: 14pt; font-weight: bold; margin: 18pt 0 10pt 0; }
        h3 { font-size: 12pt; font-weight: bold; margin: 14pt 0 8pt 0; }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

        // Create a Word-compatible MHTML format
        const mhtmlContent = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_01D7E1BB.5B5B5B50"

------=_NextPart_01D7E1BB.5B5B5B50
Content-Location: file:///C:/document.html
Content-Transfer-Encoding: quoted-printable
Content-Type: text/html; charset="utf-8"

${fullHtml}

------=_NextPart_01D7E1BB.5B5B5B50--`;

        // Create blob and download as .doc file (Word can open MHTML saved as .doc)
        const blob = new Blob([mhtmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${cleanTitle || 'Document'}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setIsMenuOpen(false);
        console.log('[DocsEditor] Document exported successfully');
      } catch (error) {
        console.error('[DocsEditor] Error exporting document:', error);
      }
    }, [editorViewGetCurrentText, documentTitle]);

    // Memoized zoom handlers to avoid recreating on each render
    const zoomIn = useCallback(() => {
      storeZoomIn();
    }, [storeZoomIn]);

    const zoomOut = useCallback(() => {
      storeZoomOut();
    }, [storeZoomOut]);

    const resetZoom = useCallback(() => {
      storeResetZoom();
    }, [storeResetZoom]);

    // Handle keyboard shortcuts for zoom
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Only if Ctrl/Cmd is pressed
        if (e.ctrlKey || e.metaKey) {
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomIn();
          } else if (e.key === '-') {
            e.preventDefault();
            zoomOut();
          } else if (e.key === '0') {
            e.preventDefault();
            resetZoom();
          }
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoomIn, zoomOut, resetZoom]);

    // Function to count words in text
    const countWords = (text: string): number => {
      // Split by whitespace and filter out empty strings
      return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .length;
    };

    // Update document title based on recentDocs and activeDocId
    useEffect(() => {
      if (activeDocId && recentDocs.length > 0) {
        const currentDoc = recentDocs.find(doc => doc.id === activeDocId);
        if (currentDoc && currentDoc.name) {
          setDocumentTitle(currentDoc.name);
        }
      }
    }, [activeDocId, recentDocs]);

    // Update word count whenever editor content changes
    useEffect(() => {
      if (!editorView) return;

      // Initial word count
      const currentText = editorViewGetCurrentText();
      setWordCount(countWords(currentText));

      // Only update title from content if we truly have an untitled document
      // and we don't have backend data already loaded
      const hasBackendTitle = activeDocId && recentDocs.length > 0 && 
        recentDocs.find(doc => doc.id === activeDocId)?.name;
      
      if (documentTitle === 'Untitled Document' && !hasBackendTitle) {
        const firstLine = currentText.split('\n')[0]?.trim();
        if (firstLine && firstLine.length > 0) {
          setDocumentTitle(firstLine.substring(0, 100));
        }
      }

      // Setup mutation observer to watch for content changes
      const contentDOM = editorView.dom;
      
      const observer = new MutationObserver(() => {
        const text = editorViewGetCurrentText();
        setWordCount(countWords(text));
        
        // Also check for backend title before updating from content
        const hasBackendTitleNow = activeDocId && recentDocs.length > 0 && 
          recentDocs.find(doc => doc.id === activeDocId)?.name;
        
        if (documentTitle === 'Untitled Document' && !hasBackendTitleNow) {
          const firstLine = text.split('\n')[0]?.trim();
          if (firstLine && firstLine.length > 0) {
            setDocumentTitle(firstLine.substring(0, 100));
          }
        }
      });
      
      observer.observe(contentDOM, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      return () => {
        observer.disconnect();
      };
    }, [editorView, editorViewGetCurrentText, documentTitle, activeDocId, recentDocs]);

    useEffect(() => {
      initialize(docId);
    }, [docId, initialize]);

    // Focus input when editing title
    useEffect(() => {
      if (isEditingTitle && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, [isEditingTitle]);

    const handleTitleClick = () => {
      setIsEditingTitle(true);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setDocumentTitle(e.target.value);
    };

    const handleTitleBlur = async () => {
      setIsEditingTitle(false);
      
      // Save the updated title if it's not empty
      if (documentTitle.trim() === '') {
        setDocumentTitle('Untitled Document');
      } else if (activeDocId) {
        try {
          // Update the entity service
          await entityService.update(activeDocId, { name: documentTitle });
          
          // Additionally, update the name in the CRDT system
          const currentYDoc = ydocRef.current;
          if (currentYDoc) {
            // Ensure name TextType exists and set the value
            const nameText = currentYDoc.getText('name');
            
            // Clear existing content and insert new title
            nameText.delete(0, nameText.length);
            nameText.insert(0, documentTitle);
            
          } else {
            console.warn('[DocsEditor] No ydoc available to update document title');
          }
        } catch (error) {
          console.error('Error updating document title:', error);
        }
      }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        titleInputRef.current?.blur();
      } else if (e.key === 'Escape') {
        // Revert to previous title if Escape is pressed
        if (activeDocId && recentDocs.length > 0) {
          const currentDoc = recentDocs.find(doc => doc.id === activeDocId);
          if (currentDoc && currentDoc.name) {
            setDocumentTitle(currentDoc.name);
          }
        }
        setIsEditingTitle(false);
      }
    };

    const handleTitleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
    };

    return (
      <div className="docs-container">
        <div className="docs-header">
          <div className="header-toolbar">
            <div className="docs-header-left">
              <button onClick={onBack}>
                <i className="fas fa-arrow-left"></i>
              </button>
              {isEditingTitle ? (
                <div className="title-input-container">
                  <i className="fas fa-file-alt ms-logo"></i>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={documentTitle}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    onKeyDown={handleTitleKeyDown}
                    onFocus={handleTitleFocus}
                    className="document-title-input"
                  />
                </div>
              ) : (
                <h3 onClick={handleTitleClick}>
                  <i className="fas fa-file-alt ms-logo"></i>
                  <span className="document-title-text">{documentTitle}</span>
                </h3>
              )}
            </div>
            <div className="docs-header-right" ref={menuRef}>
              <div className="docs-menu-container">
                <button 
                  className="docs-menu-button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  title="Document options"
                >
                  <i className="fas fa-ellipsis-v"></i>
                </button>
                {isMenuOpen && (
                  <div className="docs-menu-dropdown">
                    <button 
                      className="docs-menu-item"
                      onClick={exportToWord}
                    >
                      <i className="fas fa-file-word"></i>
                      Export as Word (.doc) file
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* <DocumentRibbon activeTab={activeTab} onTabChange={setActiveTab} /> */}
        </div>
        
        <div className="docs-editor-container">
          <div className="docs-editor-content">
            <div className="docs-editor-page">
              <YProsemirrorEditor
                docId={docId} 
                windowId={windowId} 
                spaceId={spaceId} 
              />
            </div>
          </div>
        </div>
        
        <div className="document-status-bar">
          <div className="status-item">Page 1 of 1</div>
          <div className="status-item">{wordCount} {wordCount === 1 ? 'word' : 'words'}</div>
          
          {/* Zoom controls */}
          <div className="status-item zoom-controls">
            <button 
              className="zoom-button" 
              onClick={zoomOut}
              title="Zoom out (Ctrl+-)"
            >
              <i className="fas fa-search-minus"></i>
            </button>
            <span className="zoom-level" onClick={resetZoom} title="Reset zoom (Ctrl+0)">
              {zoomLevel}%
            </span>
            <button 
              className="zoom-button" 
              onClick={zoomIn}
              title="Zoom in (Ctrl++)"
            >
              <i className="fas fa-search-plus"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

DocsEditor.displayName = 'DocsEditor';

export default DocsEditor; 