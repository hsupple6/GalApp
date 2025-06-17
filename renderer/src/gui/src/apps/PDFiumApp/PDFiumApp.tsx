import './PDFiumApp.scss';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import { commands as pdfiumCommands } from './commands';

import { dispatchCustomEvent, useCustomEventListener } from '../../services/actionService';
import fetchService from '../../services/fetchService';
import { useFileService } from '../../services/FileService';
import { selectionService } from '../../services/selectionService';
import { PDFRenderer } from './components/PDFRenderer';
import { RecentFiles } from './components/RecentFiles';
import { PDF_EVENTS } from './definition';
import { initPDFium } from './lib/pdfium-wasm';
import { PDFDocument } from './lib/pdfium-wasm/types';
import { TextSelection } from './types';
import { API_BASE_URL } from '../../api/config';
import useSpaceStore from 'stores/spaceStore';
import useEntityStore from 'stores/entityStore';
import { registerCommands, useCommandRegistryStore } from 'stores/commandRegistryStore';
import { BaseEntityType } from 'types/entities';
import { usePDFiumStore, cleanupPDFiumStore } from './store/pdfiumStore';
import { logger } from 'utils/logger';

// Define interfaces for PDFPage methods depending on the library implementation
interface PDFTextItem {
  str?: string;
  text?: string;
  [key: string]: any;
}

interface PDFTextContent {
  items: PDFTextItem[];
  [key: string]: any;
}

// Extended entity type for PDFium App
interface PDFiumEntityType {
  _id: string;
  id?: string;
  name?: string;
  type?: string;
  entityType?: string;
  skeleton?: {
    type?: string;
    fileName?: string;
    enrichments?: {
      raw_text?: string;
      sections?: Record<string, string>;
      summaries?: any[];
      pageSummaries?: any[];
      [key: string]: any;
    };
    childEntities?: string[];
  };
}

export interface PDFiumAppProps {
  title: string;
  onClose: () => void;
  entity: BaseEntityType;
  windowId: string;
}

export const PDFiumApp: React.FC<PDFiumAppProps> = ({ entity, windowId }) => {
  const fileService = useFileService();
  const initRef = useRef(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSelectionComplete, setIsSelectionComplete] = useState(false);
  const [recentFiles, setRecentFiles] = useState<Array<{ id: string; name: string }>>([]);
  const loadingRef = useRef(false);
  const entityRef = useRef<BaseEntityType | null>(null);
  const hasLoadedRef = useRef(false);
  
  const spaceId = useSpaceStore(state => state.activeSpace?.id) || '';
  const { commands } = useCommandRegistryStore();
  const { updateWindow } = useSpaceStore();
  
  // Use the PDFium store
  const { 
    pdfDoc, 
    scale, 
    status, 
    error, 
    setScale, 
    initialize, 
    setPDFDoc, 
    setSelection: setStoreSelection,
    zoomIn,
    zoomOut,
    resetZoom,
    pageContents,
    hasEnrichments
  } = usePDFiumStore(windowId, spaceId);
  
  // Define loading state based on store status
  const loading = status === 'loading';

  // Register commands if needed
  useEffect(() => {
    if (commands.has(pdfiumCommands[0].id)) {
      logger.log('[PDFiumApp] PDFium commands already registered', commands);
      return;
    }

    registerCommands(pdfiumCommands);
  }, [registerCommands, commands, pdfiumCommands]);

  // Initialize the PDF store with the entity
  useEffect(() => {
    if (!entity || !entity._id || !spaceId) return;
    
    logger.log('[PDFiumApp] Initializing PDF store with entity:', entity._id);
    
    // Initialize the PDFium store with the entity ID
    initialize(entity._id);
    
    // Mark entity as processed
    entityRef.current = entity;
    
    // Return cleanup function
    return () => {
      cleanupPDFiumStore(windowId, spaceId);
    };
  }, [entity?._id, windowId, spaceId, initialize]);

  // Load recent files on mount
  useEffect(() => {
    const loadRecentFiles = async () => {
      try {
        // TODO: Implement actual recent files fetch
        const files = await fileService.getRecentFiles('pdf');
        setRecentFiles(files);
      } catch (error) {
        logger.error('Failed to load recent files:', error);
      }
    };
    loadRecentFiles();
  }, [fileService]);

  // Debounced version of loadPDF to prevent multiple API calls during drag
  const debouncedLoadPDF = useCallback(
    debounce(async () => {
      if (loadingRef.current || !entityRef.current?._id || hasLoadedRef.current) return;
      logger.debug('📑 Executing debounced PDF load...');
      loadPDF();
    }, 300),
    [fileService]
  );

  // Clean up PDF document when component unmounts or changes
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        try {
          logger.debug('📑 Cleaning up PDF document on unmount');
          // Create a local reference to avoid race conditions
          const docToDestroy = pdfDoc;
          // Clear the document in the store
          setPDFDoc(null);
          // Then destroy the document with a delay to avoid race conditions
          setTimeout(() => {
            try {
              if (docToDestroy) {
                docToDestroy.destroy();
                logger.debug('📑 Document destroyed successfully');
              }
            } catch (error) {
              logger.error('Error destroying PDF document:', error);
            }
          }, 50);
        } catch (error) {
          logger.error('Error in PDF cleanup:', error);
        }
      }
    };
  }, [pdfDoc, setPDFDoc]);

  // Only try to load PDF if we have an entity and we haven't loaded this PDF yet
  useEffect(() => {
    if (!entity || !entity._id) return;
    
    // Check if this is the same entity we already loaded
    if (entityRef.current?._id === entity._id && hasLoadedRef.current) {
      logger.debug('📑 PDF already loaded for this entity, skipping reload');
      return;
    }
    
    // Update entity reference for debounced loader
    entityRef.current = entity;

    // Clean up previous PDF document if it exists
    if (pdfDoc) {
      try {
        logger.debug('📑 Cleaning up previous PDF document');
        // Create a local reference to avoid race conditions
        const docToDestroy = pdfDoc;
        // Clear the state first to prevent multiple destroy calls
        setPDFDoc(null);
        // Then destroy the document
        setTimeout(() => {
          try {
            docToDestroy.destroy();
          } catch (error) {
            logger.error('Error destroying PDF document:', error);
          }
        }, 50);
        
        // Reset hasLoaded flag since we're cleaning up
        hasLoadedRef.current = false;
      } catch (error) {
        logger.error('Error in PDF cleanup:', error);
      }
    }
    
    initRef.current = true;

    // Use debounced loader to prevent multiple loads during drag
    debouncedLoadPDF();
    
    // Cancel debounced load on cleanup
    return () => {
      debouncedLoadPDF.cancel();
    };
  }, [entity?._id, debouncedLoadPDF, pdfDoc, setPDFDoc]);

  const loadPDF = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingRef.current || hasLoadedRef.current) {
      logger.debug('📑 PDF load already in progress or already loaded, skipping');
      return;
    }
    
    loadingRef.current = true;
    logger.debug('📑 Starting PDF load process...');
    try {
      logger.debug('📂 Loading file data for ID:', entityRef.current?._id);
      
      try {
        if (!entityRef.current?._id) {
          throw new Error('No entity ID provided');
        }
        
        logger.debug('📂 Loading file data for ID:', entityRef.current._id);
        const fileData = await fileService.readFile(entityRef.current._id);

        if (!fileData) {
          throw new Error('No data received from server');
        }
        
        // Check if we actually got a PDF file (first 4 bytes should be %PDF)
        // Handle both string and binary data
        let isPDF = false;
        if (fileData instanceof Uint8Array && fileData.length >= 4) {
          const magicBytes = String.fromCharCode(fileData[0], fileData[1], fileData[2], fileData[3]);
          isPDF = magicBytes === '%PDF';
        }
        
        if (!isPDF) {
          logger.warn('📊 File data may not be a valid PDF:', {
            type: fileData.constructor.name,
            length: fileData.length,
            isUint8Array: fileData instanceof Uint8Array,
            firstBytes: fileData instanceof Uint8Array ? Array.from(fileData.slice(0, 4)) : null,
          });
        } else {
          logger.debug('📊 Valid PDF file data loaded:', {
            type: fileData.constructor.name,
            length: fileData.length,
            isUint8Array: fileData instanceof Uint8Array,
            firstBytes: Array.from(fileData.slice(0, 4)),
          });
        }

        logger.debug('🔧 Initializing PDFium...');
        const pdfium = await initPDFium();
        if (!pdfium) {
          throw new Error('Failed to initialize PDFium');
        }
        logger.debug('✅ PDFium initialized');

        logger.debug('📖 Loading document into PDFium...');
        const doc = await pdfium.loadDocument(fileData);
        logger.debug('✅ Document loaded:', doc);

        // Update the PDF document in the store
        setPDFDoc(doc);
        
        // Mark as loaded to prevent reloading
        hasLoadedRef.current = true;
      } catch (error: any) {
        logger.error('❌ Error loading PDF file data:', error);
        
        // Handle structured error responses from the backend
        if (error.response && typeof error.response.json === 'function') {
          try {
            const errorData = await error.response.json();
            
            if (errorData.error) {
              if (errorData.details) {
                throw new Error(`${errorData.error}: ${errorData.details}`);
              } else {
                throw new Error(errorData.error);
              }
            }
          } catch (jsonError) {
            // If we couldn't parse the JSON, fall back to the original error
            logger.error('Failed to parse error response:', jsonError);
          }
        }
        
        // Check for common error scenarios
        if (error.message?.includes('404') || error.message?.includes('Not Found') || 
            error.message?.includes('File not found')) {
          throw new Error('The file could not be found on the server. It may have been moved or deleted.');
        } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          throw new Error('You do not have permission to access this file.');
        } else if (error.message?.includes('Connection') || error.message?.includes('NameResolution')) {
          throw new Error('Cannot connect to the file storage server. Please check your network connection.');
        } else if (error.status === 503) {
          throw new Error('The file storage service is temporarily unavailable. Please try again later.');
        } else {
          throw error; // Re-throw for the outer catch
        }
      }
    } catch (error: any) {
      logger.error('❌ Error loading PDF:', error);
      
      let errorMessage = 'Failed to load PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      // Set error message but don't use the state directly since we now use the store
      logger.error(errorMessage);
    } finally {
      loadingRef.current = false;
    }
  }, [fileService, setPDFDoc]);

  // Listen for events
  useCustomEventListener(PDF_EVENTS.ZOOM_IN, () => zoomIn());
  useCustomEventListener(PDF_EVENTS.ZOOM_OUT, () => zoomOut());
  useCustomEventListener(PDF_EVENTS.RESET_ZOOM, () => resetZoom());

  const handleMouseLeave = () => {
    setIsSelecting(false);
  };

  const handleFinalSelection = useCallback(
    (selection: TextSelection | null) => {
      if (!entity || !selection) return; // Early return if no entity

      logger.log('🎯 handleFinalSelection called with:', selection);

      selectionService.setSelection({
        text: selection.text,
        source: {
          window: {
            id: entity._id,
            type: 'window' as const,
            appType: 'pdfium',
            position: { x: 0, y: 0 },
            size: { width: 0, height: 0 },
          },
          type: 'pdf',
          metadata: {
            pageNumber: selection.startPage + 1,
          },
        },
      });

      logger.log('📢 Dispatching SELECT_TEXT event');
      dispatchCustomEvent(PDF_EVENTS.SELECT_TEXT, {
        entityId: entity._id,
        text: selection.text,
        pageNumber: selection.startPage + 1,
      });
    },
    [entity],
  );

  // Modify handleSelectionChange to only update visual state
  const handleSelectionChange = (
    newSelection: TextSelection | null | ((prev: TextSelection | null) => TextSelection | null),
  ) => {
    const resolvedSelection = typeof newSelection === 'function' ? newSelection(selection) : newSelection;
    setSelection(resolvedSelection);
    // Also update selection in the store
    setStoreSelection(resolvedSelection);
  };

  // Handle selection completion
  const handleSelectionComplete = useCallback(() => {
    if (!entity || !selection) return; // Early return if no entity

    logger.log('🎯 Selection complete:', {
      hasSelection: !!selection,
      text: selection?.text,
      indices: {
        start: selection?.startIndex,
        end: selection?.endIndex,
      },
    });

    if (selection?.text) {
      const cleanText = selection.text.replace(/\x00/g, '').trim();
      if (cleanText) {
        const selectionData = {
          text: cleanText,
          source: {
            window: {
              id: entity._id,
              type: 'window' as const,
              appType: 'pdfium',
              position: { x: 0, y: 0 },
              size: { width: 0, height: 0 },
            },
            type: 'pdf',
            metadata: {
              pageNumber: selection.startPage + 1,
              startIndex: selection.startIndex,
              endIndex: selection.endIndex,
            },
          },
        };

        logger.log('📤 Sending to selectionService:', selectionData);
        selectionService.setSelection(selectionData);
      }
    }
  }, [entity, selection]);

  const handleEnrich = async () => {
    if (!entity) return; // Early return if no entity

    try {
      const result = await fetchService(`${API_BASE_URL}/enrich_pdf`, {
        method: 'POST',
        body: JSON.stringify({ fileId: entity._id }),
      });

      logger.log('Enriched PDF:', result);
      
      // Reinitialize the store to get the new enrichments
      initialize(entity._id);
    } catch (error) {
      logger.error('Error enriching PDF:', error);
    }
  };

  const handleInspect = async () => {
    if (!entity) return; // Early return if no entity

    try {
      const result = await fetchService(`${API_BASE_URL}/inspect_pdf?fileId=${entity._id}`);

      if (result.error) {
        throw new Error(result.error);
      }

      logger.log('Inspection Data:', result);
    } catch (e) {
      logger.error('Error inspecting PDF:', e);
    }
  };

  const handleFileSelect = useCallback((fileId: string) => {
    // TODO: Implement file opening logic
    logger.log('Opening file:', fileId);
  }, []);

  // If no entity, show recent files
  if (!entity) {
    return (
      <div className="pdf-app">
        <RecentFiles onFileSelect={handleFileSelect} files={recentFiles} />
      </div>
    );
  }

  // Rest of the existing component for when we have an entity
  if (loading) return <div className="loading-container">Loading PDF...</div>;
  
  if (error) {
    return (
      <div className="pdf-error-container">
        <div className="pdf-error-content">
          <h3>Unable to load PDF</h3>
          <p className="error-message">{error.message || String(error)}</p>
          
          <div className="error-actions">
            <button 
              className="retry-button" 
              onClick={() => {
                logger.log('🔄 Retrying PDF load...');
                initialize(entity._id);
                if (entity && entity._id) {
                  loadPDF();
                }
              }}
            >
              Try Again
            </button>
            
            <button 
              className="back-button"
              onClick={() => {
                // Go back to recent files view
                const id = entity?._id;
                dispatchCustomEvent('CLOSE_WINDOW', { entityId: id });
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!pdfDoc) return <div className="loading-container">No document loaded</div>;

  return (
    <div className="pdf-app" onMouseLeave={handleMouseLeave}>
      <div className="pdf-container">
        <div className="pdf-viewer">
          <div className="pdfium-toolbar">
            <button onClick={() => dispatchCustomEvent(PDF_EVENTS.ZOOM_IN, { entityId: entity._id })}>Zoom In</button>
            <button onClick={() => dispatchCustomEvent(PDF_EVENTS.ZOOM_OUT, { entityId: entity._id })}>Zoom Out</button>
            <button onClick={() => dispatchCustomEvent(PDF_EVENTS.RESET_ZOOM, { entityId: entity._id })}>
              Reset Zoom
            </button>
            <button onClick={handleEnrich}>Enrich</button>
            <button onClick={handleInspect}>Inspect</button>
            <span>{Math.round(scale * 100)}%</span>
          </div>
          <PDFRenderer
            document={pdfDoc}
            scale={scale}
            selection={selection}
            setSelection={handleSelectionChange}
            isSelecting={isSelecting}
            setIsSelecting={(selecting, finalSelection) => {
              setIsSelecting(selecting);
              if (!selecting && finalSelection?.text) {
                handleFinalSelection(finalSelection);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
