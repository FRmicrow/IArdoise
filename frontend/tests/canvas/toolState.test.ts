import { describe, it, expect } from 'vitest';
import { createDefaultToolState } from '../../src/canvas/toolState';

describe('createDefaultToolState', () => {
  it('returns draw mode, the given color, and width 4', () => {
    expect(createDefaultToolState('#ffffff')).toEqual({
      mode: 'draw',
      color: '#ffffff',
      width: 4,
    });
  });

  it('returns independently mutable state objects', () => {
    const first = createDefaultToolState('#ffffff');
    const second = createDefaultToolState('#ffffff');

    first.color = '#ff0000';
    first.width = 12;

    expect(second.color).toBe('#ffffff');
    expect(second.width).toBe(4);
    expect(second.mode).toBe('draw');
  });
});
