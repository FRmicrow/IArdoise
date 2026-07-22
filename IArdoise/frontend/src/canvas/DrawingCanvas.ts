import { StrokeStore, type Stroke } from './strokeStore';

export class DrawingCanvas {
  private readonly context: CanvasRenderingContext2D;
  private readonly strokeStore = new StrokeStore();
  private activeStroke: Stroke | null = null;
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
    this.fillBackground();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      const point = this.getPoint(event);
      this.activeStroke = {
        points: [point],
        colour: '#ffffff',
        width: 4,
      };
      this.canvas.setPointerCapture(event.pointerId);
      this.drawStrokeSegment(this.activeStroke);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.activeStroke) {
        return;
      }

      this.activeStroke.points.push(this.getPoint(event));
      this.drawStrokeSegment(this.activeStroke);
    });

    const finishStroke = (): void => {
      if (!this.activeStroke) {
        return;
      }

      this.strokeStore.addStroke(this.activeStroke);
      this.activeStroke = null;
    };

    this.canvas.addEventListener('pointerup', finishStroke);
    this.canvas.addEventListener('pointercancel', finishStroke);
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
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private redraw(): void {
    for (const stroke of this.strokeStore.getAll()) {
      this.drawFullStroke(stroke);
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

  private drawStrokeSegment(stroke: Stroke): void {
    const points = stroke.points;
    const start = points[points.length - 2] ?? points[0];
    const end = points[points.length - 1];

    this.context.strokeStyle = stroke.colour;
    this.context.lineWidth = stroke.width;
    this.context.beginPath();
    this.context.moveTo(start.x, start.y);
    this.context.lineTo(end.x, end.y);
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
