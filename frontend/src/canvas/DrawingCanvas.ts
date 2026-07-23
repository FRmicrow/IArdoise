import { StrokeStore, type Stroke } from './strokeStore';

function readColorToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export class DrawingCanvas {
  private readonly context: CanvasRenderingContext2D;
  private readonly strokeStore = new StrokeStore();
  private readonly backgroundColour: string;
  private readonly strokeColour: string;
  private activeStroke: Stroke | null = null;
  private lastDrawnPointIndex = 0;
  private rafId: number | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context unavailable');
    }

    this.context = context;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';

    this.backgroundColour = readColorToken('--color-canvas-bg', '#000000');
    this.strokeColour = readColorToken('--color-canvas-stroke', '#ffffff');

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });

    this.canvas.style.touchAction = 'none';
    this.bindEvents();
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  clear(): void {
    this.strokeStore.clear();
    this.activeStroke = null;
    this.fillBackground();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.activeStroke = {
        points: [this.getPoint(event)],
        colour: this.strokeColour,
        width: 4,
      };
      this.lastDrawnPointIndex = 0;
      this.canvas.setPointerCapture(event.pointerId);
      this.scheduleFlush();
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.activeStroke) {
        return;
      }

      this.activeStroke.points.push(this.getPoint(event));
      this.scheduleFlush();
    });

    const finishStroke = (): void => {
      if (!this.activeStroke) {
        return;
      }

      // Flush any points accumulated since the last animation frame so the
      // final segment of the stroke is never dropped.
      this.flushPendingSegments();
      this.strokeStore.addStroke(this.activeStroke);
      this.activeStroke = null;
    };

    this.canvas.addEventListener('pointerup', finishStroke);
    this.canvas.addEventListener('pointercancel', finishStroke);
  }

  /** Batches pointermove points and draws them on the next animation frame (~60fps). */
  private scheduleFlush(): void {
    if (this.rafId !== null) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flushPendingSegments();
    });
  }

  private flushPendingSegments(): void {
    const stroke = this.activeStroke;
    if (!stroke) {
      return;
    }

    const points = stroke.points;

    if (points.length === 1) {
      this.drawDot(points[0], stroke);
      this.lastDrawnPointIndex = 1;
      return;
    }

    if (this.lastDrawnPointIndex >= points.length) {
      return;
    }

    this.context.strokeStyle = stroke.colour;
    this.context.lineWidth = stroke.width;
    this.context.beginPath();
    const startIndex = Math.max(this.lastDrawnPointIndex - 1, 0);
    this.context.moveTo(points[startIndex].x, points[startIndex].y);
    for (let i = startIndex + 1; i < points.length; i++) {
      this.context.lineTo(points[i].x, points[i].y);
    }
    this.context.stroke();
    this.lastDrawnPointIndex = points.length;
  }

  private drawDot(point: { x: number; y: number }, stroke: Stroke): void {
    this.context.strokeStyle = stroke.colour;
    this.context.lineWidth = stroke.width;
    this.context.beginPath();
    this.context.moveTo(point.x, point.y);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);

    this.canvas.width = width;
    this.canvas.height = height;
    this.fillBackground();
    this.redraw();
  }

  private fillBackground(): void {
    this.context.fillStyle = this.backgroundColour;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private redraw(): void {
    for (const stroke of this.strokeStore.getAll()) {
      this.drawFullStroke(stroke);
    }
    if (this.activeStroke) {
      this.drawFullStroke(this.activeStroke);
      this.lastDrawnPointIndex = this.activeStroke.points.length;
    }
  }

  private drawFullStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) {
      return;
    }

    this.context.strokeStyle = stroke.colour;
    this.context.lineWidth = stroke.width;
    this.context.beginPath();
    this.context.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (const point of stroke.points.slice(1)) {
      this.context.lineTo(point.x, point.y);
    }

    if (stroke.points.length === 1) {
      this.context.lineTo(stroke.points[0].x, stroke.points[0].y);
    }

    this.context.stroke();
  }

  private getPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
