import { Canvas, PencilBrush, type FabricObject } from 'fabric';
import { EraserBrush } from '@erase2d/fabric';
import { createDefaultToolState, type DrawingToolState } from './toolState';

function readColorToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export class DrawingCanvas {
  private readonly canvas: Canvas;
  private readonly toolState: DrawingToolState;
  private readonly backgroundColor: string;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    canvasEl: HTMLCanvasElement,
    private readonly container: HTMLElement,
  ) {
    this.backgroundColor = readColorToken('--color-canvas-bg', '#000000');

    this.canvas = new Canvas(canvasEl, {
      isDrawingMode: true,
      backgroundColor: this.backgroundColor,
    });

    this.toolState = createDefaultToolState(readColorToken('--color-canvas-stroke', '#ffffff'));
    this.applyBrush();

    this.canvas.on('path:created', ({ path }) => {
      (path as FabricObject & { erasable: boolean }).erasable = true;
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  getToolState(): DrawingToolState {
    return { ...this.toolState };
  }

  setMode(mode: 'draw' | 'erase'): void {
    this.toolState.mode = mode;
    this.applyBrush();
  }

  setColor(color: string): void {
    this.toolState.color = color;
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
    }
  }

  setWidth(width: number): void {
    this.toolState.width = width;
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.width = width;
    }
  }

  clear(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = this.backgroundColor;
    this.canvas.requestRenderAll();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    void this.canvas.dispose();
  }

  private applyBrush(): void {
    const brush =
      this.toolState.mode === 'erase' ? new EraserBrush(this.canvas) : new PencilBrush(this.canvas);
    brush.color = this.toolState.color;
    brush.width = this.toolState.width;
    this.canvas.freeDrawingBrush = brush;
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.canvas.setDimensions({ width, height });
  }
}
