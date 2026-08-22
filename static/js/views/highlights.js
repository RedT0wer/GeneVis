import {
  highlightDomain,
  highlightExon,
  applyHighlight,
  clearHighlight
} from './context-menu.js';

import {
  state,
  getActiveUI,
  getActiveGene
} from '../core/state.js';

import {
  findExonByPositionInUI,
  getProteinDomainAtCdsPositionInUI
} from '../mutations/mutation-engine.js';

import { getExonBlockColor } from './canvas-engine.js';

export function clearAllExpandedHighlights(tab) {
  const containerId = tab === 'exons'
    ? 'exonsList'
    : 'domainsList';

  const container = document.getElementById(containerId);

  if (!container) return;

  const canvases = container.querySelectorAll('canvas.base-canvas');

  canvases.forEach(canvas => {
    if (canvas.seqData) {
      clearHighlight(canvas, null, {
        onlyTemporary: false
      });
    }
  });

  container
    .querySelectorAll('.highlight-target, .highlight-target-mutation')
    .forEach(card => {
      card.classList.remove('highlight-target');
      card.classList.remove('highlight-target-mutation');
    });
}

export function applyMutationHighlightsForExons(mutation) {
  if (!mutation) return;

  if (mutation.type === 'insertion' || mutation.type === 'deletion') {
    applyhighlightMutationOnExons(mutation);
    applyInsertionDeletionHighlightsOnExons(mutation);
    return;
  }

  applyhighlightMutationOnExons(mutation);
}

export function applyMutationHighlightsForDomains(mutation) {
  if (!mutation) return;

  if (mutation.type === 'insertion' || mutation.type === 'deletion') {
    applyhighlightMutationDiff(mutation);
    return;
  }

  applyhighlightMutationOnDomains(mutation);
}

export function applyhighlightMutationOnExons(mutation) {
  if (!mutation) return;

  const ui = getActiveUI();

  const pos = mutation.pos - 1;

  if (Number.isNaN(pos) || pos < 0) return;

  const exon = findExonByPositionInUI(ui.exons, pos);

  if (!exon) return;

  const exonId = exon.id;
  const localIdx = pos - exon.start_pos;

  let indices = [];

  if (mutation.seq && mutation.seq.length > 0) {
    for (let i = 0; i < mutation.seq.length; i++) {
      indices.push(localIdx + 1 + i);
    }
  } else {
    indices = [localIdx];
  }

  const canvas = document.getElementById(`exon-canvas-${exonId}`);

  if (!canvas) return;

  highlightExon(
    exonId,
    localIdx,
    false,
    'highlight-target-mutation'
  );

  applyHighlight(canvas, indices, {
    temporary: false,
    bgColor: '#7c1307',
    textColor: '#0a1a22'
  });
}

export function applyhighlightMutationOnDomains(mutation) {
  if (!mutation) return;

  const ui = getActiveUI();
  const gene = mutation.gene || getActiveGene();

  if (!gene) return;

  const utr5Len = gene.base_sequence.utr5.length;
  const cdsPos0Based = (mutation.pos - 1) - utr5Len;

  if (cdsPos0Based < 0) return;

  const aaPos = Math.floor(cdsPos0Based / 3);

  const domain = getProteinDomainAtCdsPositionInUI(
    ui.domains,
    cdsPos0Based
  );

  if (!domain) return;

  const localIdx = aaPos - domain.start_aa;

  const canvas = document.getElementById(`domain-canvas-${domain.id}`);

  if (!canvas) return;

  highlightDomain(
    domain.id,
    localIdx,
    false,
    'highlight-target-mutation'
  );

  applyHighlight(canvas, localIdx, {
    temporary: false,
    bgColor: '#7c1307',
    textColor: '#0a1a22'
  });
}

export function applyhighlightMutationDiff(mutation) {
  if (!mutation) return;

  const ui = getActiveUI();

  const mutatedDomain = ui.domains[ui.domains.length - 1];

  if (!mutatedDomain) return;

  const mutatedCanvas = document.getElementById(
    `domain-canvas-${mutatedDomain.id}`
  );

  if (!mutatedCanvas) return;

  let diffPos = Math.max(0, (mutation.diffPos || 1) - 1);

  const mutatedLocalEnd = mutatedDomain.end_aa - mutatedDomain.start_aa;

  if (mutatedLocalEnd >= 0) {
    if (diffPos > mutatedLocalEnd) {
      diffPos = mutatedLocalEnd;
    }

    const mutatedIndices = [];

    for (let i = diffPos; i <= mutatedLocalEnd; i++) {
      mutatedIndices.push(i);
    }

    highlightDomain(
      mutatedDomain.id,
      diffPos,
      false,
      'highlight-target-mutation'
    );

    applyHighlight(mutatedCanvas, mutatedIndices, {
      temporary: false,
      bgColor: '#7c1307',
      textColor: '#0a1a22'
    });
  }

  const oldCanvas = document.getElementById(
    `domain-canvas-${mutatedDomain.id}-old`
  );

  if (!oldCanvas || !oldCanvas.seqData) return;

  const originalDomain = state.originalUI.domains.find(
    domain => domain.id === mutatedDomain.id
  );

  let originalLocalEnd = -1;

  if (originalDomain) {
    originalLocalEnd = originalDomain.end_aa - originalDomain.start_aa;
  } else {
    originalLocalEnd = oldCanvas.seqData.sequence.length - 1;
  }

  if (originalLocalEnd < 0) return;

  const originalDiffPos = Math.min(diffPos, originalLocalEnd);

  const originalIndices = [];

  for (let i = originalDiffPos; i <= originalLocalEnd; i++) {
    originalIndices.push(i);
  }

  clearHighlight(oldCanvas, null, {
    onlyTemporary: false
  });

  applyHighlight(oldCanvas, originalIndices, {
    temporary: false,
    bgColor: '#07357c',
    textColor: '#ffffff'
  });
}

function getGlobalNucleotideIndexFromCDS(cdsPos1Based, gene) {
  const utr5Len = gene.base_sequence.utr5.length;

  return utr5Len + (cdsPos1Based - 1);
}

function highlightStopCodon(mutation) {
  const ui = getActiveUI();
  const gene = mutation.gene || getActiveGene();

  if (!ui?.exons?.length || !gene) return;

  const stopIndex = gene.protein.sequence.indexOf('*');

  let exon = null;
  let localStart = 0;
  let indices = [];

  if (stopIndex !== -1) {
    const globalStop0Based =
      gene.base_sequence.utr5.length + stopIndex * 3;

    exon = findExonByPositionInUI(ui.exons, globalStop0Based);

    if (exon) {
      localStart = globalStop0Based - exon.start_pos;

      indices = [
        localStart,
        localStart + 1,
        localStart + 2
      ].filter(idx => idx >= 0 && idx < exon.sequence.length);
    }
  }

  if (!exon || indices.length === 0) {
    exon = ui.exons[ui.exons.length - 1];

    if (!exon) return;

    const seqLen = exon.sequence.length;

    localStart = Math.max(0, seqLen - 3);

    for (let i = localStart; i < seqLen; i++) {
      indices.push(i);
    }
  }

  if (!mutation._stopHighlights) {
    mutation._stopHighlights = [];
  }

  mutation._stopHighlights.push({
    exonId: exon.id,
    indices
  });

  highlightExon(
    exon.id,
    localStart,
    false,
    'highlight-target-mutation'
  );

  const canvas = document.getElementById(`exon-canvas-${exon.id}`);

  if (!canvas) return;

  applyHighlight(canvas, indices, {
    temporary: false,
    bgColor: '#ff3333',
    textColor: '#ffffff'
  });
}

function highlightDeletionBoundaries(mutation) {
  if (!mutation.start || !mutation.end) return;

  const ui = getActiveUI();
  const gene = mutation.gene || getActiveGene();

  if (!gene) return;

  const totalCdsLength = gene.protein.sequence.length * 3;

  const leftPos = mutation.start - 1;

  if (leftPos >= 1 && leftPos <= totalCdsLength) {
    const globalPos = getGlobalNucleotideIndexFromCDS(leftPos, gene);
    const exon = findExonByPositionInUI(ui.exons, globalPos);

    if (exon) {
      const localIdx = globalPos - exon.start_pos;

      const canvas = document.getElementById(`exon-canvas-${exon.id}`);

      if (canvas) {
        if (!mutation._boundaryHighlights) {
          mutation._boundaryHighlights = [];
        }

        mutation._boundaryHighlights.push({
          exonId: exon.id,
          localIdx,
          type: 'leftBoundary'
        });

        highlightExon(
          exon.id,
          localIdx,
          false,
          'highlight-target-mutation'
        );

        applyHighlight(canvas, localIdx, {
          temporary: false,
          gradient: {
            leftColor: getExonBlockColor(
              localIdx,
              canvas.seqData.utr5Len,
              canvas.seqData.cdsLen,
              canvas.seqData.cdsGlobalOffset
            ),
            rightColor: '#ff3333'
          },
          textColor: '#ffffff'
        });
      }
    }
  }

  const rightPos = mutation.start;

  if (rightPos >= 1 && rightPos <= totalCdsLength) {
    const globalPos = getGlobalNucleotideIndexFromCDS(rightPos, gene);
    const exon = findExonByPositionInUI(ui.exons, globalPos);

    if (exon) {
      const localIdx = globalPos - exon.start_pos;

      const canvas = document.getElementById(`exon-canvas-${exon.id}`);

      if (canvas) {
        if (!mutation._boundaryHighlights) {
          mutation._boundaryHighlights = [];
        }

        mutation._boundaryHighlights.push({
          exonId: exon.id,
          localIdx,
          type: 'rightBoundary'
        });

        highlightExon(
          exon.id,
          localIdx,
          false,
          'highlight-target-mutation'
        );

        applyHighlight(canvas, localIdx, {
          temporary: false,
          gradient: {
            leftColor: '#ff3333',
            rightColor: getExonBlockColor(
              localIdx,
              canvas.seqData.utr5Len,
              canvas.seqData.cdsLen,
              canvas.seqData.cdsGlobalOffset
            )
          },
          textColor: '#ffffff'
        });
      }
    }
  }
}

export function applyInsertionDeletionHighlightsOnExons(mutation) {
  if (!mutation) return;

  if (mutation.type !== 'insertion' && mutation.type !== 'deletion') {
    return;
  }

  highlightStopCodon(mutation);

  if (mutation.type === 'deletion') {
    highlightDeletionBoundaries(mutation);
  }
}