import type { DrawingCanvas } from './DrawingCanvas';

export function mountDrawingToolbar(container: HTMLElement, drawingCanvas: DrawingCanvas): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';

  const eraserButton = document.createElement('button');
  eraserButton.type = 'button';
  eraserButton.className = 'drawing-toolbar__eraser';
  eraserButton.setAttribute('aria-pressed', 'false');
  eraserButton.textContent = 'Gomme';
  eraserButton.addEventListener('click', () => {
    const erasing = eraserButton.getAttribute('aria-pressed') === 'true';
    const nextMode = erasing ? 'draw' : 'erase';
    drawingCanvas.setMode(nextMode);
    eraserButton.setAttribute('aria-pressed', String(!erasing));
  });
  toolbar.appendChild(eraserButton);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'drawing-toolbar__color';
  colorInput.setAttribute('aria-label', 'Couleur du trait');
  colorInput.value = drawingCanvas.getToolState().color;
  colorInput.addEventListener('input', (event) => {
    drawingCanvas.setColor((event.target as HTMLInputElement).value);
  });
  toolbar.appendChild(colorInput);

  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.className = 'drawing-toolbar__width';
  widthInput.min = '1';
  widthInput.max = '30';
  widthInput.step = '1';
  widthInput.setAttribute('aria-label', 'Épaisseur du trait');
  widthInput.value = String(drawingCanvas.getToolState().width);
  widthInput.addEventListener('input', (event) => {
    drawingCanvas.setWidth(Number((event.target as HTMLInputElement).value));
  });
  toolbar.appendChild(widthInput);

  container.appendChild(toolbar);
  return toolbar;
}
