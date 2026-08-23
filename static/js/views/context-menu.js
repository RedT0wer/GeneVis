import {
  state,
  getActiveUI,
  getActiveGene
} from '../core/state.js';

import {
  getCharIndexFromMouse,
  calculateScrollPosition,
  getCharCoords,
  drawBlock,
  drawBlockGradient,
  FONT_SIZE,
  getOverlayCanvas
} from './canvas-engine.js';

import {
  getNucleotideName,
  getAminoAcidName,
  getChargeDesc,
  getAminoColor
} from '../core/bio-helpers.js';

import { switchToTab } from '../controllers/ui-controller.js';

import {
  findExonByPositionInUI,
  getProteinDomainAtCdsPositionInUI
} from '../mutations/mutation-engine.js';

import { ensureCardExpanded } from './lazy.js';

export function canvasClickHandler(e) {
  const eventCanvas = e.currentTarget;

  const baseCanvas = eventCanvas.__base || eventCanvas;

  const seqData = eventCanvas.seqData || baseCanvas.seqData;

  if (!seqData) return;

  const rect = eventCanvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const cssWidth = seqData.cssWidth || rect.width;
  const cssHeight = seqData.cssHeight || rect.height;

  const scaleX = cssWidth / rect.width;
  const scaleY = cssHeight / rect.height;

  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const globalIdx = getCharIndexFromMouse(mouseX, mouseY, seqData);

  if (globalIdx === -1) return;

  const ch = seqData.sequence[globalIdx];

  showContextMenu(
    seqData.type,
    ch,
    globalIdx,
    seqData.entityId,
    seqData.sequence
  );
}

function getExonsForCodon(ui, globalNucPos0Based) {
  const result = [];

  for (let offset = 0; offset < 3; offset++) {
    const pos = globalNucPos0Based + offset;

    const exon = findExonByPositionInUI(ui.exons, pos);

    if (!exon) continue;

    let existing = result.find(item => item.exon.id === exon.id);

    if (!existing) {
      existing = {
        exon,
        localIndices: []
      };

      result.push(existing);
    }

    const localIdx = pos - exon.start_pos;
    existing.localIndices.push(localIdx);
  }

  for (const item of result) {
    item.localIndices.sort((a, b) => a - b);
  }

  return result;
}

function showContextMenu(type, ch, idx, entityId, fullSeq) {
  closeContext();

  const ui = getActiveUI();

  const isExon = type === 'exon';

  const labelName = isExon ? 'Нуклеотид' : 'Аминокислота';
  const fullNameCh = isExon ? getNucleotideName(ch) : getAminoAcidName(ch);
  const charColor = isExon ? 'white' : getAminoColor(ch);

  const posInExon = idx + 1;

  let positionRowsHtml = '';

  if (isExon) {
    const ex = ui.exons[entityId - 1];

    let cdsPosDisplay = '—';

    if (ex) {
      const isInCds = idx >= ex.utr5_len && idx < ex.utr5_len + ex.cds_len;

      if (isInCds) {
        cdsPosDisplay = ex.cds_start_1based + (idx - ex.utr5_len);
      }
    }

    positionRowsHtml = `
      <div class="ctx-row"><span class="ctx-label">Позиция в экзоне</span><span class="ctx-value">${posInExon}</span></div>
      <div class="ctx-row"><span class="ctx-label">Позиция в CDS</span><span class="ctx-value">${cdsPosDisplay}</span></div>
      <div class="ctx-row"><span class="ctx-label">Позиция в UTR + CDS</span><span class="ctx-value">${posInExon + (ex ? ex.start_pos : 0)}</span></div>
    `;
  } else {
    const dom = ui.domains[entityId - 1];

    const globalAaPos = dom ? dom.start_aa + idx : posInExon;

    positionRowsHtml = `
      <div class="ctx-row"><span class="ctx-label">Позиция в домене</span><span class="ctx-value">${posInExon}</span></div>
      <div class="ctx-row"><span class="ctx-label">Позиция в белке</span><span class="ctx-value">${globalAaPos + 1}</span></div>
      <div class="ctx-row"><span class="ctx-label">Заряд</span><span class="ctx-value">${getChargeDesc(ch)}</span></div>
    `;
  }

  const div = document.createElement('div');

  div.className = 'context-card';

  div.innerHTML = `
    <span class="ctx-close-btn" id="ctxCloseBtn">×</span>

    <div class="ctx-header">
      <span class="ctx-char" style="color: ${charColor}">${ch}</span>
    </div>

    <div class="ctx-info">
      <div class="ctx-row">
        <span class="ctx-label">${labelName}</span>
        <span class="ctx-value">${fullNameCh}</span>
      </div>

      ${positionRowsHtml}
    </div>

    <button id="gotoBtn">
      ${isExon ? 'Перейти к домену' : 'Перейти к экзону'}
    </button>
  `;

  document.body.appendChild(div);

  state.activeContext = div;

  div.querySelector('#ctxCloseBtn').addEventListener('click', e => {
    e.stopPropagation();
    closeContext();
  });

  const gotoBtn = div.querySelector('#gotoBtn');

  if (isExon) {
    gotoBtn.onclick = () => {
      const ex = ui.exons[entityId - 1];

      if (!ex || idx < ex.utr5_len) {
        showToast('Нуклеотид находится в UTR-области, переход к домену невозможен');
        closeContext();
        return;
      }

      const localCdsIdx = idx - ex.utr5_len;
      const globalCdsOffset = (ex.cds_start_1based || 1) - 1;
      const globalCdsIdx = globalCdsOffset + localCdsIdx;

      const targetDomain = getProteinDomainAtCdsPositionInUI(
        ui.domains,
        globalCdsIdx
      );

      if (!targetDomain) {
        showToast('Для этой позиции не найден домен');
        closeContext();
        return;
      }

      const aaPosInCds = Math.floor(globalCdsIdx / 3);
      const aaPosInDomain = aaPosInCds - targetDomain.start_aa;

      switchToTab('domains');

      const domainCanvas = document.getElementById(`domain-canvas-${targetDomain.id}`);

      if (domainCanvas) {
        scrollToCharacter(domainCanvas, aaPosInDomain);
        highlightDomain(targetDomain.id, aaPosInDomain);

        applyHighlight(domainCanvas, aaPosInDomain, {
          temporary: true,
          bgColor: '#e6d00b',
          textColor: '#0a1a22'
        });

        setTimeout(() => {
          clearHighlight(domainCanvas, aaPosInDomain, {
            onlyTemporary: true
          });
        }, 1500);

        showToast(`Переход к домену «${targetDomain.name}»`);
      }

      closeContext();
    };
  } else {
    gotoBtn.onclick = () => {
      const dom = ui.domains[entityId - 1];

      if (!dom) return;

      const globalAaPos0Based = dom.start_aa + idx;
      const globalCdsIdx = globalAaPos0Based * 3;

      const gene = getActiveGene();
      const utr5Len = gene?.base_sequence?.utr5?.length ?? 0;

      const globalNucPos0Based = utr5Len + globalCdsIdx;

      const targetExon = findExonByPositionInUI(
        ui.exons,
        globalNucPos0Based
      );

      if (!targetExon) {
        showToast('Не удалось определить экзон для этой позиции');
        closeContext();
        return;
      }

      const localExonIdx = globalNucPos0Based - targetExon.start_pos;

      switchToTab('exons');

      const exonCanvas = document.getElementById(`exon-canvas-${targetExon.id}`);

      if (exonCanvas) {
        scrollToCharacter(exonCanvas, localExonIdx);

        const codonExons = getExonsForCodon(ui, globalNucPos0Based);

        for (const { exon, localIndices } of codonExons) {
          const currentExonCanvas = document.getElementById(`exon-canvas-${exon.id}`);

          if (!currentExonCanvas) continue;

          highlightExon(exon.id, localIndices[0], true);

          applyHighlight(currentExonCanvas, localIndices, {
            temporary: true,
            bgColor: '#e6d00b',
            textColor: '#0a1a22'
          });

          setTimeout(() => {
            clearHighlight(currentExonCanvas, localIndices, {
              onlyTemporary: true
            });
          }, 1500);
        }

        showToast(`Переход к экзону ${targetExon.name}`);
      }

      closeContext();
    };
  }
}

export function highlightExon(
  exonId,
  targetIndex = 0,
  temporarily = true,
  className = 'highlight-target'
) {
  const card = document.getElementById(`exon-card-${exonId}`);

  if (!card) return;

  ensureCardExpanded(card);

  const canvas = document.getElementById(`exon-canvas-${exonId}`);

  if (!canvas) return;

  scrollToCharacter(canvas, targetIndex);

  card.classList.add(className);

  if (temporarily) {
    setTimeout(() => card.classList.remove(className), 1500);
  }
}

export function highlightDomain(
  domainId,
  targetIndex = 0,
  temporarily = true,
  className = 'highlight-target'
) {
  const card = document.getElementById(`domain-card-${domainId}`);

  if (!card) return;

  ensureCardExpanded(card);

  const canvas = document.getElementById(`domain-canvas-${domainId}`);

  if (!canvas) return;

  scrollToCharacter(canvas, targetIndex);

  card.classList.add(className);

  if (temporarily) {
    setTimeout(() => card.classList.remove(className), 1500);
  }
}

function prepareOverlayCtx(overlay) {
  const ctx = overlay.getContext('2d');

  ctx.font = `${FONT_SIZE}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  return ctx;
}

function clearOverlayRect(ctx, coords) {
  ctx.clearRect(
    coords.x - 1,
    coords.y - 1,
    coords.width + 2,
    coords.height + 2
  );
}

function drawHighlightOnOverlay(ctx, seqData, idx, highlight) {
  const coords = getCharCoords(seqData, idx);

  if (!coords) return;

  const ch = seqData.sequence[idx];

  clearOverlayRect(ctx, coords);

  if (highlight.gradient && !highlight.textOnly) {
    drawBlockGradient(
      ctx,
      coords.x,
      coords.y,
      ch,
      highlight.gradient.leftColor,
      highlight.gradient.rightColor,
      highlight.textColor
    );
  } else {
    drawBlock(
      ctx,
      coords.x,
      coords.y,
      ch,
      highlight.textOnly ? 'transparent' : highlight.bgColor,
      highlight.textColor
    );
  }
}

export function applyHighlight(canvas, globalIndices, options = {}) {
  const overlay = getOverlayCanvas(canvas);
  const seqData = overlay?.seqData || canvas?.seqData;

  if (!overlay || !seqData) return;

  const ctx = prepareOverlayCtx(overlay);

  const {
    temporary = true,
    bgColor = '#e6d00b',
    textColor = '#0a1a22',
    textOnly = false,
    gradient = null
  } = options;

  const indices = Array.isArray(globalIndices)
    ? globalIndices
    : [globalIndices];

  if (!seqData._highlights) {
    seqData._highlights = {
      persistent: {},
      temporary: {}
    };
  }

  const store = temporary
    ? seqData._highlights.temporary
    : seqData._highlights.persistent;

  for (const idx of indices) {
    store[idx] = {
      bgColor: textOnly ? null : bgColor,
      textColor,
      textOnly,
      gradient: gradient || null
    };
  }

  for (const idx of indices) {
    drawHighlightOnOverlay(ctx, seqData, idx, store[idx]);
  }
}

export function clearHighlight(canvas, globalIndices = null, options = {}) {
  const overlay = getOverlayCanvas(canvas);
  const seqData = overlay?.seqData || canvas?.seqData;

  if (!overlay || !seqData || !seqData._highlights) return;

  const ctx = prepareOverlayCtx(overlay);

  const {
    onlyTemporary = true
  } = options;

  if (globalIndices === null) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (onlyTemporary) {
      seqData._highlights.temporary = {};

      const persistent = seqData._highlights.persistent || {};

      for (const [idx, highlight] of Object.entries(persistent)) {
        drawHighlightOnOverlay(ctx, seqData, Number(idx), highlight);
      }
    } else {
      seqData._highlights = {
        persistent: {},
        temporary: {}
      };
    }

    return;
  }

  const indices = Array.isArray(globalIndices)
    ? globalIndices
    : [globalIndices];

  for (const idx of indices) {
    delete seqData._highlights.temporary[idx];

    if (!onlyTemporary) {
      delete seqData._highlights.persistent[idx];
    }

    const coords = getCharCoords(seqData, idx);

    if (!coords) continue;

    clearOverlayRect(ctx, coords);

    const persistentHighlight = seqData._highlights.persistent[idx];

    if (persistentHighlight) {
      drawHighlightOnOverlay(ctx, seqData, idx, persistentHighlight);
    }
  }
}

export function scrollToCharacter(canvas, targetIndex) {
  const scrollTop = calculateScrollPosition(canvas, targetIndex);

  if (scrollTop === null) return;

  const scrollContainer = canvas.closest('.view');

  if (!scrollContainer) return;

  scrollContainer.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  });
}

function showToast(msg) {
  const toast = document.createElement('div');

  toast.className = 'context-card';
  toast.innerHTML = `<div>${msg}</div>`;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}

function closeContext() {
  if (state.activeContext) {
    state.activeContext.remove();
    state.activeContext = null;
  }
}