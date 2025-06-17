import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
// import usePartySocket from "partysocket/react";
// import { PdfHighlighter, Tip, Highlight, Popup, AreaHighlight } from "react-pdf-highlighter";
import './PDFApp.scss';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import { ActionStack } from '../ActionStack';
import { Rect } from '../types';
import WindowWrapper from '../WindowWrapper';
import { getClientRects } from './PDFApp-utils';
import { FILES_ENDPOINTS } from '../endpoints';

// Set the worker URL for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
// pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PDFAppProps {
  title: string;
  onClose: () => void;
  entity?: any; // Make entity optional since it can be null
  isTab?: boolean;
  tabId?: string | null;
  onSelectPdf?: (tabId: string, entity: any) => void;
}

// Define the shape of highlight objects
interface Highlight {
  text: string;
  rects: Array<Rect>;
  pageNumber: number;
  scale: number;
}

const PDFApp: React.FC<PDFAppProps> = React.memo(
  ({ entity, onClose, title, isTab = false, tabId = null, onSelectPdf }) => {
    // console.debug('PDFApp rendered with entity:', entity);

    const [file, setFile] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);

    const authToken = localStorage.getItem('authToken');

    // Memoize PDF options
    const pdfOptions = useMemo(
      () => ({
        httpHeaders: {
          Authorization: `Bearer ${authToken}`,
        },
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/standard_fonts/',
      }),
      [authToken],
    );

    useEffect(() => {
      if (!entity?._id) return;

      const loadFile = async () => {
        // Add the token as a query parameter for direct browser requests
        setFile(FILES_ENDPOINTS.read(entity._id));
      };

      loadFile();
    }, [entity?._id]);

    const [pdfList, setPdfList] = useState<string[]>([]); // To store list of PDFs
    const [scale, setScale] = useState(1.0); // State for zooming
    const [highlights, setHighlights] = useState<Highlight[]>([]); // Store highlights
    const [drawing, setDrawing] = useState(false); // Control drawing mode
    const [mode, setMode] = useState<'highlight' | 'annotate' | 'none'>('none'); // Mode state for toolbar
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    // ActionStack instance to manage undo/redo and actions
    const actionStack = useRef(new ActionStack(canvasRef));

    // const ws = usePartySocket({
    //   host: "localhost:1999",
    //   room: "document-edit-room", // Room name where users will connect

    //   onOpen() {
    //     console.debug("Connected to PartyKit room");
    //   },

    //   onMessage(event) {
    //     // Safely attempt to parse the message as JSON
    //     try {
    //       const action = JSON.parse(event.data);
    //       actionStack.current.applyAction(action);
    //     } catch (error) {
    //       console.warn("Received non-JSON message:", event.data);
    //       // Handle non-JSON messages (like "hello from server")
    //     }
    //   },

    //   onError(e) {
    //     console.error("WebSocket error:", e);
    //   },

    //   onClose() {
    //     console.debug("Disconnected from PartyKit room");
    //   }
    // });

    const handlePdfClick = async (pdfName: string) => {
      const selectedPdf = { fileId: pdfName, fileName: pdfName, type: 'PDF' };
      // Add the token as a query parameter for direct browser requests
      setFile(FILES_ENDPOINTS.read(entity._id));

      // Notify parent WindowWrapper about the selected PDF
      if (onSelectPdf && tabId) {
        onSelectPdf(tabId, selectedPdf);
      }
    };

    // const handleNewFileUpload = async (file: File) => {
    //   // Upload the file to create an entity
    //   const formData = new FormData();
    //   formData.append('file', file);
    //
    //   try {
    //     const response = await fetch('http://localhost:5001/upload-entity', {
    //       method: 'POST',
    //       body: formData,
    //     });
    //
    //     const entity = await response.json();
    //
    //     const uploadedPFD = { fileId: entity.skeleton.fileId, fileName: entity.skeleton.fileId, type: 'PDF' };
    //     console.debug('Raw response:', entity); // Log it to see if there's an issue
    //     if (onSelectPdf && tabId) {
    //       onSelectPdf(tabId, uploadedPFD);
    //     }
    //
    //     if (!response.ok) {
    //       throw new Error(`Error: ${response.status}`);
    //     }
    //
    //     if (entity.entityType === 'File') {
    //     }
    //
    //     console.debug('Uploaded Entity:', entity);
    //   } catch (error) {
    //     console.error('Error during file upload:', error);
    //   }
    // };

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    };

    // ***************************************************************
    // PDF Interaction ***********************************************
    // ***************************************************************
    // const handleZoomIn = () => {
    //   const newScale = scale + 0.2;
    //   reRenderHighlights(newScale);
    //   setScale(newScale);
    // };

    // const handleZoomOut = () => {
    //   const newScale = scale - 0.2;
    //   reRenderHighlights(newScale);
    //   setScale(newScale);
    // };

    const handleZoomIn = () => {
      const newScale = scale + 0.2;
      setScale(newScale);
    };

    const handleZoomOut = () => {
      const newScale = scale - 0.2;
      setScale(newScale);
    };

    // Function to clear the old highlights before rendering the new ones
    const clearPreviousHighlights = () => {
      const highlightElements = document.querySelectorAll('.highlight-element');
      highlightElements.forEach((element) => {
        element.remove(); // Remove old highlights from DOM
      });
    };

    // Re-render the highlights with the updated scale
    const reRenderHighlights = (newScale: number) => {
      console.debug('re-rendering highlgihts');
      // Clear previously rendered highlights to avoid duplication
      clearPreviousHighlights();

      // Re-render each highlight at the new scale
      highlights.forEach((highlight) => {
        const updatedHighlight = { ...highlight };
        // actionStack.current.renderHighlight(updatedHighlight, newScale);

        // Just re-render, do NOT call applyAction here
        actionStack.current.renderHighlight(updatedHighlight, newScale);
      });
    };

    // // Function to create an action and apply it
    // const createAction = (type: 'highlight' | 'annotation', data: any, undoData?: any) => {
    //   const action: EditPDFAction = {
    //     id: Math.random().toString(), // Generate a random ID (or use a better method)
    //     type,
    //     userId: 'user-id', // Replace with actual user ID
    //     timestamp: Date.now(),
    //     data,
    //     undoData,
    //   };
    //   actionStack.current.applyAction(action); // Apply and store the action

    //   // Broadcast the action to other clients
    //   if (ws) {
    //     ws.send(JSON.stringify(action)); // Send the action to the WebSocket server
    //   }
    // };

    // Apply the highlight action using ActionStack
    const applyHighlight = (highlight: Highlight) => {
      setHighlights([...highlights, highlight]);
    };
    // const applyHighlight = (highlight: Highlight) => {
    //   const action: EditPDFAction = {
    //     id: Math.random().toString(), // Generate a random ID
    //     type: 'highlight',
    //     userId: 'user-id', // Replace with actual user ID
    //     timestamp: Date.now(),
    //     data: {
    //       rects: highlight.rects,
    //       pageNumber: highlight.pageNumber,
    //       initialScale: scale,
    //     },
    //   };

    //   // Apply the action using ActionStack
    //   actionStack.current.applyAction(action);
    //   console.debug(`adding to state ${JSON.stringify(highlight)}`);
    //   // Add the highlight locally for state
    //   setHighlights([...highlights, highlight]);
    // };

    // Handle text selection for highlighting
    const handleTextSelection = (pageNumber: number) => {
      if (mode !== 'highlight') return;
      const selection = window.getSelection();

      if (selection && selection.toString()) {
        const selectedText = selection.toString();
        const range = selection.getRangeAt(0);

        // Get the client rectangles for multi-line text
        const pages = [{ node: document.querySelector(`.pdf-page-${pageNumber}`), number: pageNumber }];
        const rects = getClientRects(range, pages, scale);

        if (rects.length > 0) {
          // No scale adjustment when creating the highlight
          console.debug('handletextselection applying...');
          const highlight = {
            text: selectedText,
            rects, // Store all rects
            pageNumber,
            scale,
          };

          applyHighlight(highlight); // Apply the highlight action
          selection.removeAllRanges();
        }
      }
    };

    // Handle freehand annotation drawing
    const handleMouseDown = () => {
      if (mode !== 'annotate') return;
      setDrawing(true);
    };

    const handleMouseUp = () => {
      if (mode !== 'annotate') return;
      setDrawing(false);

      // Capture the drawn annotation (example: canvas data or paths)
      const annotationData = canvasRef.current?.toDataURL(); // Example: Get the canvas content as data

      // Create an action and apply it via the ActionStack
      // createAction('annotation', { annotation: annotationData });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!drawing || mode !== 'annotate') return;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); // Move the line within the canvas
        ctx.stroke();
      }
    };

    // Disable text selection when in annotate mode
    useEffect(() => {
      if (mode === 'annotate') {
        document.body.style.userSelect = 'none'; // Disable text selection
      } else {
        document.body.style.userSelect = 'text'; // Enable text selection
      }
    }, [mode]);

    // Store highlights/annotations in the backend
    const saveAnnotations = () => {
      console.debug('Highlights:', highlights);
      // TODO: Send highlights/annotations to backend for storage
    };

    return (
      <WindowWrapper title={title} onClose={onClose} isTab={isTab}>
        <div className="pdfApp">
          {file ? (
            <div className="pdfViewer">
              <div className="toolbar">
                <button className={mode === 'highlight' ? 'active' : ''} onClick={() => setMode('highlight')}>
                  Highlight
                </button>
                <button className={mode === 'annotate' ? 'active' : ''} onClick={() => setMode('annotate')}>
                  Annotate
                </button>
                <button className={mode === 'none' ? 'active' : ''} onClick={() => setMode('none')}>
                  None
                </button>
                <button onClick={() => saveAnnotations()}>Save</button>
                <button onClick={handleZoomIn}>Zoom In</button>
                <button onClick={handleZoomOut}>Zoom Out</button>
                <span className="zoomScale">Zoom: {Math.round(scale * 100)}%</span>
              </div>
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ position: 'relative' }}
              >
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                  options={pdfOptions}
                  loading={<div>Loading PDF...</div>}
                  error={<div>Error loading PDF!</div>}
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <div
                      key={index}
                      className={`pageBreak pdf-page-${index + 1}`}
                      onMouseUp={() => handleTextSelection(index + 1)}
                    >
                      <Page pageNumber={index + 1} scale={scale} />
                      {highlights
                        .filter((highlight) => highlight.pageNumber === index + 1)
                        .map((highlight, idx) =>
                          /* Loop through each rect in this highlight */
                          highlight.rects.map((rect, rectIdx) => (
                            <div
                              key={`${idx}-${rectIdx}`} // Unique key for each rect
                              style={{
                                position: 'absolute',
                                top: `${rect.top * scale}px`, // Apply zoom scale
                                left: `${rect.left * scale}px`,
                                width: `${rect.width * scale}px`,
                                height: `${rect.height * scale}px`,
                                backgroundColor: 'yellow',
                                opacity: 0.3,
                              }}
                              className="highlight-element"
                            />
                          )),
                        )}
                    </div>
                  ))}
                </Document>
                {/* Canvas for drawing annotations */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: mode === 'annotate' ? 'auto' : 'none',
                  }}
                />
              </div>
            </div>
          ) : entity ? (
            <div>Loading PDF...</div> // Add loading state
          ) : (
            <div className="pdfList">
              <h3>Select a PDF to view:</h3>
              <ul>
                {pdfList.map((pdf, index) => (
                  <li key={index} onClick={() => handlePdfClick(pdf)}>
                    {pdf}
                  </li>
                ))}
              </ul>
              {/* <DropZone parentId={null} callback={handleNewFileUpload} /> */}
            </div>
          )}
        </div>
      </WindowWrapper>
    );
  },
);

export default PDFApp;
