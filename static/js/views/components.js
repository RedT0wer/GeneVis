import { state } from '../core/state.js';
import { drawSequenceGrid } from './canvas-engine.js';
import { canvasClickHandler } from './context-menu.js';
import { toggleSequenceCard, ensureCardExpanded } from './lazy.js';

import {
  findExonByPositionInUI,
  getProteinDomainAtCdsPositionInUI
} from '../mutations/mutation-engine.js';

function getRenderKey(tab) {
  if (
    state.uiMode === 'mutation-preview' &&
    state.mutationSession &&
    state.mutationSession.type !== 'find'
  ) {
    return `preview:${state.geneVersion}:${state.mutationSession.id}:${tab}`;
  }

  return `original:${state.geneVersion}:${tab}`;
}

export function createExonCardHTML(exon, suffix = '') {
  const badgeCDS = exon.cds_len > 0
    ? `<span class="badge">CDS: ${exon.cds_start_1based} – ${exon.cds_end_1based}</span>`
    : `<span class="badge">UTR</span>`;

  return `
    <div class="card-header">
      <span class="badge">${exon.name}</span>
      ${badgeCDS}
      <button class="btn-icon toggle-sequence" type="button">Показать</button>
    </div>

    <div class="canvas-wrapper" style="display:none;">
      <canvas
        class="base-canvas exon-canvas"
        data-id="${exon.id}"
        id="exon-canvas-${exon.id}${suffix}"
      ></canvas>

      <canvas
        class="overlay-canvas exon-overlay"
        data-id="${exon.id}"
        id="exon-overlay-${exon.id}${suffix}"
      ></canvas>
    </div>
  `;
}

export function createDomainCardHTML(domain, suffix = '') {
  return `
    <div class="card-header">
      <span class="badge">${domain.name}</span>
      <span class="badge">${domain.start_aa + 1}–${domain.end_aa + 1}</span>
      <button class="btn-icon toggle-sequence" type="button">Показать</button>
    </div>

    <div class="canvas-wrapper" style="display:none;">
      <canvas
        class="base-canvas domain-canvas"
        data-id="${domain.id}"
        id="domain-canvas-${domain.id}${suffix}"
      ></canvas>

      <canvas
        class="overlay-canvas domain-overlay"
        data-id="${domain.id}"
        id="domain-overlay-${domain.id}${suffix}"
      ></canvas>
    </div>
  `;
}

export function initCanvasInCard(card, type, dataItem) {
  const baseCanvas = card.querySelector('.base-canvas');
  const overlayCanvas = card.querySelector('.overlay-canvas');

  if (!baseCanvas) return;

  if (type === 'exon') {
    const cdsGlobalOffset = dataItem.cds_start_1based > 0
      ? dataItem.cds_start_1based - 1
      : 0;

    drawSequenceGrid(
      baseCanvas,
      dataItem.sequence,
      'exon',
      null,
      dataItem.utr5_len,
      dataItem.cds_len,
      dataItem.utr3_len,
      cdsGlobalOffset
    );
  } else if (type === 'domain') {
    drawSequenceGrid(
      baseCanvas,
      dataItem.sequence,
      'domain',
      dataItem.id
    );
  }

  if (card.dataset.role === 'original') {
    baseCanvas.style.pointerEvents = 'none';

    if (overlayCanvas) {
      overlayCanvas.style.pointerEvents = 'none';
    }

    return;
  }

  if (overlayCanvas) {
    overlayCanvas.onclick = canvasClickHandler;
  } else {
    baseCanvas.onclick = canvasClickHandler;
  }
}

function createLazyExonCard(exon, role = 'normal') {
  const suffix = role === 'original' ? '-old' : '';

  const card = document.createElement('div');

  card.className = 'canvas-card';
  card.id = `exon-card-${exon.id}${suffix}`;

  card.dataset.type = 'exon';
  card.dataset.id = exon.id;
  card.dataset.role = role;
  card.dataset.rendered = 'false';

  card.innerHTML = createExonCardHTML(exon, suffix);

  card.__init = () => {
    initCanvasInCard(card, 'exon', exon);
  };

  return card;
}

function createLazyDomainCard(domain, role = 'normal') {
  const suffix = role === 'original' ? '-old' : '';

  const card = document.createElement('div');

  card.className = 'canvas-card';
  card.id = `domain-card-${domain.id}${suffix}`;

  card.dataset.type = 'domain';
  card.dataset.id = domain.id;
  card.dataset.role = role;
  card.dataset.rendered = 'false';

  card.innerHTML = createDomainCardHTML(domain, suffix);

  card.__init = () => {
    initCanvasInCard(card, 'domain', domain);
  };

  return card;
}

function createInfoCard(text) {
  const card = document.createElement('div');

  card.className = 'canvas-card';

  card.innerHTML = `
    <div class="card-header">
      <span class="badge">${text}</span>
    </div>
  `;

  return card;
}

function attachToggleHandler(container) {
  container.onclick = event => {
    const button = event.target.closest('.toggle-sequence');

    if (!button) return;

    const card = button.closest('.canvas-card');
    toggleSequenceCard(card);
  };
}

function restoreExpandedCards(tab, container) {
  const set = state.expandedCards[tab];

  if (!set || set.size === 0) return;

  const cards = container.querySelectorAll('.canvas-card');

  for (const card of cards) {
    if (set.has(card.id)) {
      ensureCardExpanded(card);
    }
  }
}

function renderNormalExons(container) {
  const fragment = document.createDocumentFragment();

  for (const exon of state.originalUI.exons) {
    fragment.appendChild(createLazyExonCard(exon, 'normal'));
  }

  container.appendChild(fragment);
}

function renderNormalDomains(container) {
  const fragment = document.createDocumentFragment();

  for (const domain of state.originalUI.domains) {
    fragment.appendChild(createLazyDomainCard(domain, 'normal'));
  }

  container.appendChild(fragment);
}

function getAffectedOriginalExon(session) {
  if (!session?.pos) return null;

  const globalPos0Based = session.pos - 1;

  return findExonByPositionInUI(
    state.originalUI.exons,
    globalPos0Based
  );
}

function getMutatedExonForOriginal(originalExon, session) {
  if (!originalExon) return null;

  const globalPos0Based = session.pos - 1;

  return (
    state.mutatedUI.exons.find(exon => exon.id === originalExon.id) ||
    findExonByPositionInUI(state.mutatedUI.exons, globalPos0Based) ||
    state.mutatedUI.exons[originalExon.id - 1] ||
    null
  );
}

function getStopExonId(ui, gene) {
  if (!ui?.exons?.length) return null;

  const stopIndex = gene?.protein?.sequence?.indexOf('*') ?? -1;

  if (stopIndex === -1) {
    return ui.exons[ui.exons.length - 1].id;
  }

  const utr5Len = gene?.base_sequence?.utr5?.length ?? 0;
  const stopGlobal0Based = utr5Len + stopIndex * 3;

  const stopExon = findExonByPositionInUI(
    ui.exons,
    stopGlobal0Based
  );

  if (stopExon) {
    return stopExon.id;
  }

  return ui.exons[ui.exons.length - 1].id;
}

function renderExonMutationPreview(container, session) {
  const fragment = document.createDocumentFragment();
  const cardsToExpand = [];

  const originalExon = getAffectedOriginalExon(session);

  if (!originalExon) {
    fragment.appendChild(
      createInfoCard('Не удалось определить экзон для мутации')
    );

    container.appendChild(fragment);

    return;
  }

  // 1. Экзоны до мутационного
  for (
    let i = 0;
    i < originalExon.id - 1 && i < state.originalUI.exons.length;
    i++
  ) {
    fragment.appendChild(
      createLazyExonCard(state.originalUI.exons[i], 'normal')
    );
  }

  // 2. Оригинальный мутационный экзон
  const originalCard = createLazyExonCard(originalExon, 'original');
  fragment.appendChild(originalCard);
  cardsToExpand.push(originalCard);

  // 3. Мутированный экзон
  const mutatedExon = getMutatedExonForOriginal(originalExon, session);

  if (mutatedExon) {
    const mutatedCard = createLazyExonCard(mutatedExon, 'mutated');

    fragment.appendChild(mutatedCard);
    cardsToExpand.push(mutatedCard);

    // 4. Экзоны после мутационного до стоп-кодона включительно
    const stopExonId = getStopExonId(state.mutatedUI, state.mutatedGene);

    if (stopExonId) {
      const mutatedIndex = state.mutatedUI.exons.findIndex(
        exon => exon.id === mutatedExon.id
      );

      if (mutatedIndex >= 0) {
        for (
          let i = mutatedIndex + 1;
          i < state.mutatedUI.exons.length;
          i++
        ) {
          const exon = state.mutatedUI.exons[i];

          fragment.appendChild(
            createLazyExonCard(exon, 'context')
          );

          if (exon.id === stopExonId) {
            break;
          }
        }
      }
    }
  } else {
    fragment.appendChild(
      createInfoCard('Мутированный экзон не найден или был удалён')
    );
  }

  container.appendChild(fragment);

  cardsToExpand.forEach(card => {
    ensureCardExpanded(card);
  });
}

function getDomainPreviewTargets(session) {
  const original = state.originalUI;
  const mutated = state.mutatedUI;

  if (!session?.pos || !original?.domains?.length) {
    return {};
  }

  const globalPos0Based = session.pos - 1;
  const utr5Len = state.originalGene?.base_sequence?.utr5?.length ?? 0;
  const cdsPos0Based = globalPos0Based - utr5Len;

  if (cdsPos0Based < 0) {
    return {
      cdsPos0Based
    };
  }

  let originalDomain = getProteinDomainAtCdsPositionInUI(
    original.domains,
    cdsPos0Based
  );

  let mutatedDomain = null;

  if (session.type === 'insertion' || session.type === 'deletion') {
    mutatedDomain = mutated?.domains?.[mutated.domains.length - 1] || null;

    if (mutatedDomain && !originalDomain) {
      originalDomain = original.domains.find(
        domain => domain.id === mutatedDomain.id
      ) || null;
    }
  } else {
    mutatedDomain = mutated?.domains?.find(
      domain => domain.id === originalDomain?.id
    ) || null;
  }

  return {
    originalDomain,
    mutatedDomain,
    cdsPos0Based
  };
}

function renderDomainMutationPreview(container, session) {
  const fragment = document.createDocumentFragment();
  const cardsToExpand = [];

  const {
    originalDomain,
    mutatedDomain,
    cdsPos0Based
  } = getDomainPreviewTargets(session);

  if (!originalDomain && !mutatedDomain) {
    fragment.appendChild(
      createInfoCard('Мутация не попадает в домен')
    );

    container.appendChild(fragment);

    return;
  }

  // 1. Домены до мутационного
  const beforeId = originalDomain?.id || mutatedDomain?.id || null;

  if (beforeId) {
    for (
      let i = 0;
      i < beforeId - 1 && i < state.originalUI.domains.length;
      i++
    ) {
      fragment.appendChild(
        createLazyDomainCard(state.originalUI.domains[i], 'normal')
      );
    }
  } else if (typeof cdsPos0Based === 'number' && cdsPos0Based >= 0) {
    const aaPos = Math.floor(cdsPos0Based / 3);

    for (const domain of state.originalUI.domains) {
      if (domain.end_aa < aaPos) {
        fragment.appendChild(
          createLazyDomainCard(domain, 'normal')
        );
      }
    }
  }

  // 2. Оригинальный мутационный домен
  if (originalDomain) {
    const originalCard = createLazyDomainCard(originalDomain, 'original');

    fragment.appendChild(originalCard);
    cardsToExpand.push(originalCard);
  }

  // 3. Мутированный домен
  if (mutatedDomain) {
    const mutatedCard = createLazyDomainCard(mutatedDomain, 'mutated');

    fragment.appendChild(mutatedCard);
    cardsToExpand.push(mutatedCard);
  } else if (originalDomain) {
    fragment.appendChild(
      createInfoCard('Мутированный домен не найден или был удалён')
    );
  }

  container.appendChild(fragment);

  cardsToExpand.forEach(card => {
    ensureCardExpanded(card);
  });
}

export function renderExonsView(force = false) {
  const container = document.getElementById('exonsList');

  if (!container) return false;

  const key = getRenderKey('exons');

  if (
    !force &&
    state.renderState.exons.key === key &&
    container.childElementCount > 0
  ) {
    return false;
  }

  container.innerHTML = '';

  if (
    state.uiMode === 'mutation-preview' &&
    state.mutationSession &&
    state.mutationSession.type !== 'find'
  ) {
    renderExonMutationPreview(container, state.mutationSession);
  } else {
    renderNormalExons(container);
  }

  attachToggleHandler(container);

  state.renderState.exons.key = key;

  restoreExpandedCards('exons', container);

  return true;
}

export function renderDomainsView(force = false) {
  const container = document.getElementById('domainsList');

  if (!container) return false;

  const key = getRenderKey('domains');

  if (
    !force &&
    state.renderState.domains.key === key &&
    container.childElementCount > 0
  ) {
    return false;
  }

  container.innerHTML = '';

  if (
    state.uiMode === 'mutation-preview' &&
    state.mutationSession &&
    state.mutationSession.type !== 'find'
  ) {
    renderDomainMutationPreview(container, state.mutationSession);
  } else {
    renderNormalDomains(container);
  }

  attachToggleHandler(container);

  state.renderState.domains.key = key;

  restoreExpandedCards('domains', container);

  return true;
}

export function showMutationResult(message, isError = false) {
  const resultDiv = document.getElementById('mutResult');

  if (!resultDiv) return;

  resultDiv.innerHTML = message;

  resultDiv.style.borderLeft = isError
    ? '4px solid #dc3545'
    : '4px solid #28a745';

  resultDiv.style.padding = '12px';
  resultDiv.style.marginTop = '10px';

  resultDiv.style.background = isError
    ? 'rgba(220, 53, 69, 0.1)'
    : 'rgba(40, 167, 69, 0.1)';

  resultDiv.style.borderRadius = '6px';
  resultDiv.style.color = '#e2e8f0';
  resultDiv.style.fontSize = '1em';
}

export function updateStats(gene) {
  const stats = document.getElementById("stats-row");

  if (!stats) return;

  const numbers = stats.querySelectorAll(".stat .stat-number");

  numbers[0].innerText = gene.base_sequence.exons.length;
  numbers[1].innerText = gene.protein.domains.length;
  numbers[2].innerText = gene.base_sequence.full_sequence.length;
  numbers[3].innerText = gene.protein.length;
}