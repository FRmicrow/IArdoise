export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  colour: string;
  width: number;
}

export class StrokeStore {
  private strokes: Stroke[] = [];

  addStroke(stroke: Stroke): void {
    this.strokes.push(stroke);
  }

  clear(): void {
    this.strokes = [];
  }

  getAll(): Stroke[] {
    return this.strokes;
  }
}
