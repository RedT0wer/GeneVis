import { state } from '../core/state.js';
import { getAminoColor } from '../core/bio-helpers.js';

export const FONT_SIZE = 19;

const CHAR_WIDTH_RATIO = 0.6;
const BLOCK_PADDING = 6;
const BLOCK_MARGIN = 3;
const CANVAS_PADDING = 10;
const MIN_CANVAS_WIDTH = 335;

const CHAR_WIDTH = FONT_SIZE * CHAR_WIDTH_RATIO;
const BLOCK_HEIGHT = FONT_SIZE + BLOCK_PADDING * 2;
const FULL_BLOCK_WIDTH = CHAR_WIDTH + BLOCK_PADDING * 2 + BLOCK_MARGIN;

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    roundRect(this, x, y, w, h, r);
    return this;
  };
}

export function getOverlayCanvas(canvas) {
  if (!canvas) return null;

  if (canvas.classList && canvas.classList.contains('overlay-canvas')) {
    return canvas;
  }

  if (canvas.__overlay) {
    return canvas.__overlay;
  }

  const parent = canvas.parentElement;
  const overlay = parent ? parent.querySelector('.overlay-canvas') : null;

  return overlay || canvas;
}

export function calculateLayout(sequence, containerWidth) {
  const maxWidth = containerWidth;

  const lines = [];
  let currentLine = '';

  for (let i = 0; i < sequence.length; i++) {
    const testLine = currentLine + sequence[i];
    const testWidth = testLine.length * FULL_BLOCK_WIDTH - BLOCK_MARGIN;

    if (testWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = sequence[i];
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return {
    lines,
    maxWidth,
    canvasWidth: maxWidth + 20,
    canvasHeight: lines.length * (BLOCK_HEIGHT + BLOCK_MARGIN) + 20
  };
}

export function getCharIndexFromMouse(mouseX, mouseY, seqData) {
  const {
    lines,
    blockHeight,
    blockMargin,
    xStart,
    yStart,
    charWidth,
    blockPadding
  } = seqData;

  let lineIndex = -1;
  let charIndexInLine = -1;

  for (let l = 0; l < lines.length; l++) {
    const yLine = yStart + l * (blockHeight + blockMargin);

    if (mouseY >= yLine && mouseY <= yLine + blockHeight) {
      lineIndex = l;

      let xPos = xStart;

      for (let c = 0; c < lines[l].length; c++) {
        const xBlockStart = xPos;
        const xBlockEnd = xPos + charWidth + blockPadding * 2;

        if (mouseX >= xBlockStart && mouseX <= xBlockEnd) {
          charIndexInLine = c;
          break;
        }

        xPos += charWidth + blockPadding * 2 + blockMargin;
      }

      break;
    }
  }

  if (lineIndex === -1 || charIndexInLine === -1) return -1;

  return lines.slice(0, lineIndex).join('').length + charIndexInLine;
}

export function getCharCoords(seqData, globalIndex) {
  const {
    lines,
    blockHeight,
    blockMargin,
    xStart,
    yStart,
    charWidth,
    blockPadding
  } = seqData;

  let charCount = 0;

  for (let l = 0; l < lines.length; l++) {
    if (charCount + lines[l].length > globalIndex) {
      const charIndexInLine = globalIndex - charCount;

      const x = xStart + charIndexInLine * (charWidth + blockPadding * 2 + blockMargin);
      const y = yStart + l * (blockHeight + blockMargin);

      return {
        x,
        y,
        width: charWidth + blockPadding * 2,
        height: blockHeight
      };
    }

    charCount += lines[l].length;
  }

  return null;
}

export function calculateScrollPosition(canvas, targetIndex) {
  const data = canvas.seqData;

  if (!data) return null;

  const {
    lines,
    blockHeight,
    blockMargin,
    yStart
  } = data;

  let charCount = 0;
  let targetLine = -1;

  for (let l = 0; l < lines.length; l++) {
    if (charCount + lines[l].length > targetIndex) {
      targetLine = l;
      break;
    }

    charCount += lines[l].length;
  }

  if (targetLine === -1) return null;

  const charCenterY = yStart + targetLine * (blockHeight + blockMargin) + (blockHeight / 2);

  const scrollContainer = canvas.closest('.view');
  if (!scrollContainer) return null;

  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  const absoluteCharY = scrollContainer.scrollTop +
    (canvasRect.top - containerRect.top) +
    charCenterY;

  const containerHeight = containerRect.height;

  let targetScrollTop = absoluteCharY - (containerHeight / 2);

  const maxScroll = scrollContainer.scrollHeight - containerHeight;

  return Math.max(0, Math.min(targetScrollTop, maxScroll));
}

export function getExonBlockColor(globalIdx, utr5Len, cdsLen, cdsGlobalOffset) {
  const isUtr5 = globalIdx < utr5Len;
  const isUtr3 = globalIdx >= utr5Len + cdsLen;

  if (isUtr5 || isUtr3) {
    return '#4a5a72';
  }

  const globalCdsIdx = cdsGlobalOffset + (globalIdx - utr5Len);
  const codonFrameIdx = Math.floor(globalCdsIdx / 3);

  return (codonFrameIdx % 2 === 0) ? '#ced6e8' : '#b7c5e5';
}

export function getDomainBlockColor(char, domainColorEnabled) {
  if (!domainColorEnabled) {
    return '#ced6e8';
  }

  return getAminoColor(char);
}

export function drawBlock(ctx, x, y, char, bgColor, textColor = '#0a1a22') {
  const blockWidth = CHAR_WIDTH + BLOCK_PADDING * 2;

  if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    roundRect(ctx, x, y, blockWidth, BLOCK_HEIGHT, 10);
    ctx.fill();
  }

  ctx.fillStyle = textColor;
  ctx.fillText(
    char,
    x + BLOCK_PADDING + CHAR_WIDTH / 2,
    y + BLOCK_HEIGHT / 2
  );
}

export function drawBlockGradient(ctx, x, y, char, leftColor, rightColor, textColor = '#0a1a22') {
  const blockWidth = CHAR_WIDTH + BLOCK_PADDING * 2;

  const gradient = ctx.createLinearGradient(x, y, x + blockWidth, y);
  gradient.addColorStop(0, leftColor);
  gradient.addColorStop(1, rightColor);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  roundRect(ctx, x, y, blockWidth, BLOCK_HEIGHT, 10);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.fillText(
    char,
    x + BLOCK_PADDING + CHAR_WIDTH / 2,
    y + BLOCK_HEIGHT / 2
  );
}

export function drawSequenceGrid(
  canvas,
  sequence,
  type,
  domainId = null,
  utr5Len = 0,
  cdsLen = 0,
  utr3Len = 0,
  cdsGlobalOffset = 0
) {
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;

  const containerWidth = container.offsetWidth || container.clientWidth || (MIN_CANVAS_WIDTH + 20);
  const layout = calculateLayout(sequence, containerWidth);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const cssWidth = layout.canvasWidth;
  const cssHeight = layout.canvasHeight;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const overlay = container.querySelector('.overlay-canvas');

  if (overlay) {
    overlay.width = canvas.width;
    overlay.height = canvas.height;

    overlay.style.width = `${overlay.width}px`;
    overlay.style.height = `${overlay.height}px`;

    const overlayCtx = overlay.getContext('2d');
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  }

  ctx.font = `${FONT_SIZE}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const { lines } = layout;

  let yOffset = CANVAS_PADDING;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    let xOffset = CANVAS_PADDING;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const globalIdx = lines.slice(0, lineIdx).join('').length + i;

      let bgColor;

      if (type === 'exon') {
        bgColor = getExonBlockColor(globalIdx, utr5Len, cdsLen, cdsGlobalOffset);
      } else {
        bgColor = getDomainBlockColor(ch, state.domainColorEnabled);
      }

      drawBlock(ctx, xOffset, yOffset, ch, bgColor);

      xOffset += FULL_BLOCK_WIDTH;
    }

    yOffset += BLOCK_HEIGHT + BLOCK_MARGIN;
  }

  canvas.seqData = {
    sequence,
    type,
    entityId: type === 'exon' ? canvas.dataset.id : domainId,
    lines,
    blockHeight: BLOCK_HEIGHT,
    blockMargin: BLOCK_MARGIN,
    xStart: CANVAS_PADDING,
    yStart: CANVAS_PADDING,
    charWidth: CHAR_WIDTH,
    blockPadding: BLOCK_PADDING,
    utr5Len,
    cdsLen,
    utr3Len,
    cdsGlobalOffset,
    cssWidth,
    cssHeight,
    dpr
  };

  if (overlay) {
    overlay.seqData = canvas.seqData;
    overlay.__base = canvas;
    canvas.__overlay = overlay;
  }
}