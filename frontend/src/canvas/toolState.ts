export interface DrawingToolState {
  mode: 'draw' | 'erase';
  color: string;
  width: number;
}

export function createDefaultToolState(defaultColor: string): DrawingToolState {
  return { mode: 'draw', color: defaultColor, width: 4 };
}
