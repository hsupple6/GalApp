import { Rect } from './types';

export class ActionStack {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  constructor(canvasRef: React.RefObject<HTMLCanvasElement>) {
    this.canvasRef = canvasRef;
  }

  private undoStack: EditPDFAction[] = [];
  private redoStack: EditPDFAction[] = [];

  applyAction(action: EditPDFAction) {
    this.undoStack.push(action); // Add the action to the undo stack
    this.redoStack.length = 0; // Clear the redo stack since we’ve taken a new action
    this.apply(action); // Call the apply function to actually render the action
  }

  undoLastAction() {
    if (this.undoStack.length > 0) {
      const lastAction = this.undoStack.pop();
      if (lastAction) {
        this.redoStack.push(lastAction);
        this.undo(lastAction); // Undo the action
      }
    }
  }

  redoLastAction() {
    if (this.redoStack.length > 0) {
      const lastUndone = this.redoStack.pop();
      if (lastUndone) {
        this.undoStack.push(lastUndone);
        this.apply(lastUndone); // Reapply the action
      }
    }
  }

  private apply(action: EditPDFAction) {
    // Logic to render/apply the action (e.g., draw highlight or annotation)
    console.debug('applying action...');
    switch (action.type) {
      case 'highlight':
        // Apply the highlight
        console.debug('rendering highlight...');
        this.renderHighlight(action.data);
        break;
      case 'annotation':
        // Apply the annotation
        this.renderAnnotation(action.data);
        break;
      // Add cases for other action types
    }
  }

  private undo(action: EditPDFAction) {
    // Logic to undo the action
    switch (action.type) {
      case 'highlight':
        this.removeHighlight(action.undoData);
        break;
      case 'annotation':
        this.removeAnnotation(action.undoData);
        break;
    }
  }

  public renderHighlight(highlightData: any, newScale?: number) {
    const { rects, pageNumber, initialScale } = highlightData;
    const currentScale = newScale || initialScale; // Use newScale if available, else use initialScale

    if (!rects || rects.length === 0) {
      console.error('No rectangles found for this highlight.');
      return;
    }

    // Find the canvas element within the PDF page
    const canvasElement = document.querySelector(
      `.pdf-page-${pageNumber} .react-pdf__Page__canvas`,
    ) as HTMLCanvasElement;

    if (!canvasElement) return;

    const canvasRect = canvasElement.getBoundingClientRect();

    // Loop over each rectangle in rects to render multiple highlight elements
    rects.forEach((rect: Rect) => {
      const highlightElement = document.createElement('div');
      highlightElement.classList.add('highlight-element'); // Add a class to help clear later
      highlightElement.style.position = 'absolute';

      // Normalize based on the initial scale at which the highlight was created
      const normalizedTop = (rect.top / initialScale) * currentScale;
      const normalizedLeft = (rect.left / initialScale) * currentScale;
      const normalizedWidth = (rect.width / initialScale) * currentScale;
      const normalizedHeight = (rect.height / initialScale) * currentScale;

      // Apply the normalized values for positioning and dimensions
      highlightElement.style.top = `${normalizedTop}px`;
      highlightElement.style.left = `${normalizedLeft}px`;
      highlightElement.style.width = `${normalizedWidth}px`;
      highlightElement.style.height = `${normalizedHeight}px`;
      highlightElement.style.backgroundColor = 'yellow';
      highlightElement.style.opacity = '0.5';

      // Append the highlight to the canvas element's parent
      canvasElement.parentElement?.appendChild(highlightElement);
    });
  }

  private removeHighlight(highlightData: any) {
    // Logic to remove highlight from DOM or canvas
  }

  private renderAnnotation(annotationData: any) {
    const ctx = this.canvasRef.current?.getContext('2d');
    const canvasRef = this.canvasRef.current;

    if (ctx && canvasRef) {
      // Clear the existing drawing on the canvas
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

      // Ensure the canvas dimensions match the PDF page size
      const { pageWidth, pageHeight } = annotationData;
      canvasRef.width = pageWidth;
      canvasRef.height = pageHeight;

      // Re-draw the annotation using the stored paths or data
      const { annotation } = annotationData;
      const img = new Image();
      img.src = annotation; // Assuming annotationData contains a base64-encoded image
      img.onload = () => {
        ctx.drawImage(img, 0, 0, pageWidth, pageHeight);
      };
    }
  }

  private removeAnnotation(annotationData: any) {
    // Logic to remove annotation from the canvas
  }
}

export interface EditPDFAction {
  id: string;
  type: 'highlight' | 'annotation';
  userId: string;
  timestamp: number;
  data: any;
  undoData?: any;
}
