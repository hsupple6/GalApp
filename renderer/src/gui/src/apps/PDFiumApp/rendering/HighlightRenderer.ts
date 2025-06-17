import { mat4 } from 'gl-matrix';

export interface PDFHighlight {
  id: string;
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
  }>;
  color: [number, number, number, number];
  createdBy: string;
  createdAt: number;
}

export class HighlightRenderer {
  private gl: WebGLRenderingContext;
  private program!: WebGLProgram;
  private positionBuffer!: WebGLBuffer;
  private colorBuffer!: WebGLBuffer;
  private highlights: Map<string, PDFHighlight>;
  private lastViewportMatrix: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    })!;

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.highlights = new Map();
    this.lastViewportMatrix = new Float32Array(16);
    
    this.initGL();
    
    if (!this.program || !this.positionBuffer || !this.colorBuffer) {
      throw new Error('Failed to initialize WebGL resources');
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error('Shader compilation failed');
    }

    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      throw new Error('Program linking failed');
    }

    return program;
  }

  private initGL() {
    const gl = this.gl;
    
    const vertexShader = this.createShader(gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec4 a_color;
      uniform mat4 u_matrix;
      
      varying vec4 v_color;
      
      void main() {
        gl_Position = u_matrix * vec4(a_position, 0, 1);
        v_color = a_color;
      }
    `);

    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec4 v_color;
      
      void main() {
        gl_FragColor = v_color;
      }
    `);

    this.program = this.createProgram(vertexShader, fragmentShader);
    this.positionBuffer = gl.createBuffer()!;
    this.colorBuffer = gl.createBuffer()!;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private updateBuffers() {
    const gl = this.gl;
    const vertices: number[] = [];
    const colors: number[] = [];

    this.highlights.forEach(highlight => {
      highlight.rects.forEach(rect => {
        // Two triangles for each rectangle
        vertices.push(
          rect.x, rect.y,
          rect.x + rect.width, rect.y,
          rect.x, rect.y + rect.height,
          rect.x + rect.width, rect.y,
          rect.x + rect.width, rect.y + rect.height,
          rect.x, rect.y + rect.height
        );

        // Color for each vertex
        for (let i = 0; i < 6; i++) {
          colors.push(...highlight.color);
        }
      });
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  }

  render(viewportMatrix: Float32Array) {
    const gl = this.gl;
    this.lastViewportMatrix = viewportMatrix;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    const matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    gl.uniformMatrix4fv(matrixLocation, false, viewportMatrix);

    const positionLocation = gl.getAttribLocation(this.program, "a_position");
    const colorLocation = gl.getAttribLocation(this.program, "a_color");

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(colorLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.highlights.size * 6);
  }

  addHighlight(highlight: PDFHighlight) {
    this.highlights.set(highlight.id, highlight);
    this.updateBuffers();
    this.render(this.lastViewportMatrix);
  }

  syncWithCRDT(highlights: Map<string, PDFHighlight>) {
    this.highlights = new Map(highlights);
    this.updateBuffers();
    this.render(this.lastViewportMatrix);
  }
} 