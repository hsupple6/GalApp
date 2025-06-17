import { mat4, vec2 } from 'gl-matrix';

export interface ViewportState {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_VIEWPORT: ViewportState = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0
};

export class ViewportManager {
  private matrix: mat4;
  private inverseMatrix: mat4;
  
  constructor() {
    this.matrix = mat4.create();
    this.inverseMatrix = mat4.create();
    this.updateFromState({
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0
    });
  }

  updateFromState(state: ViewportState) {
    mat4.identity(this.matrix);
    
    // Apply transformations in order: scale -> rotate -> translate
    mat4.translate(this.matrix, this.matrix, [state.offsetX, state.offsetY, 0]);
    mat4.rotate(this.matrix, this.matrix, state.rotation * Math.PI / 180, [0, 0, 1]);
    mat4.scale(this.matrix, this.matrix, [state.scale, state.scale, 1]);

    // Update inverse matrix for hit testing
    mat4.invert(this.inverseMatrix, this.matrix);
  }

  screenToPDF(x: number, y: number): [number, number] {
    const point = vec2.fromValues(x, y);
    vec2.transformMat4(point, point, this.inverseMatrix);
    return [point[0], point[1]];
  }

  pdfToScreen(x: number, y: number): [number, number] {
    const point = vec2.fromValues(x, y);
    vec2.transformMat4(point, point, this.matrix);
    return [point[0], point[1]];
  }

  getTransformMatrix(): Float32Array {
    return this.matrix as Float32Array;
  }
} 