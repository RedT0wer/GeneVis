import { state } from '../core/state.js';

import {
  renderExonsView,
  renderDomainsView
} from '../views/components.js';

import {
  applyMutationHighlightsForExons,
  applyMutationHighlightsForDomains,
  clearAllExpandedHighlights
} from '../views/highlights.js';

export class UiController {
  constructor(geneController) {
    this.geneController = geneController;
    this.currentMutationType = 'find';
  }

  init() {
    this.initNavigation();
    this.initBuildPanel();
    this.initMutationSelector();
    this.initBuildButton();
    this.initResetButton();
  }

  initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.nav;
        switchToTab(tab);
      });
    });
  }

  initBuildPanel() {
    const searchBtn = document.getElementById('searchToggleBtn');
    const buildPanel = document.getElementById('buildPanel');
    const body = document.body;

    searchBtn.addEventListener('click', () => {
      buildPanel.classList.toggle('show');

      if (buildPanel.classList.contains('show')) {
        body.classList.add('build-panel-open');
        document.querySelector('.stats-row').style.display = 'none';
      } else {
        body.classList.remove('build-panel-open');

        const tab = document.querySelector("div[class='nav-item active-nav']").dataset.nav;

        if (this.geneController.currentGene && tab !== "mutations") {
          document.querySelector('.stats-row').style.display = 'flex';
        }
      }
    });

    const sourceBtns = document.querySelectorAll('.source-btn');

    sourceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sourceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  initMutationSelector() {
    const container = document.getElementById('mutParams');
    const typeBtns = document.querySelectorAll('.mut-type-btn');

    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentMutationType = btn.dataset.type;
        this._updateMutForm(this.currentMutationType, container);
      });
    });

    this._updateMutForm('find', container);

    document.getElementById('applyMutationBtn').addEventListener('click', () => {
      this._handleApplyMutation();
    });
  }

  initBuildButton() {
    const buildBtn = document.getElementById('buildGeneBtn');
    const statusDiv = document.getElementById('buildStatusMessage');

    buildBtn.addEventListener('click', async () => {
      const sourceBtn = document.querySelector('.source-btn.active');
      const source = sourceBtn ? sourceBtn.dataset.source : 'ensembl';

      const geneId = document.getElementById('geneIdInput').value.trim();
      const proteinId = document.getElementById('proteinIdInput').value.trim();

      if (!geneId || !proteinId) {
        statusDiv.innerHTML = 'Заполните ID гена и белка';
        statusDiv.className = 'build-status error';
        return;
      }

      statusDiv.innerHTML = 'Загрузка данных...';
      statusDiv.className = 'build-status loading';

      try {
        await this.geneController.loadGene(geneId, proteinId, source);

        statusDiv.innerHTML = 'Ген успешно построен!';
        statusDiv.className = 'build-status success';

        setTimeout(() => {
          statusDiv.innerHTML = '';
          statusDiv.className = 'build-status';
        }, 3000);
      } catch (err) {
        console.error(err);

        statusDiv.innerHTML = `Ошибка: ${err.message}`;
        statusDiv.className = 'build-status error';
      }
    });
  }

  initResetButton() {
    const resetBtn = document.getElementById('resetGeneFullBtn');

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.geneController.resetGene();
      });
    }
  }

  _updateMutForm(type, container) {
    if (type === 'find') {
      container.innerHTML = `
        <input id="mutPos" placeholder="Позиция">
        <div id="findResult"></div>
      `;
    } else if (type === 'substitution') {
      container.innerHTML = `
        <input id="subPos" placeholder="Позиция">
        <input id="subNuc" placeholder="Новый нуклеотид A/T/C/G">
      `;
    } else if (type === 'insertion') {
      container.innerHTML = `
        <input id="insPos" placeholder="После позиции">
        <input id="insSeq" placeholder="Последовательность">
      `;
    } else if (type === 'deletion') {
      container.innerHTML = `
        <input id="delStart" placeholder="Начало">
        <input id="delEnd" placeholder="Конец">
      `;
    }
  }

  _handleApplyMutation() {
    const type = this.currentMutationType;

    let params = {};

    switch (type) {
      case 'find':
        params.pos = document.getElementById('mutPos')?.value;
        break;

      case 'substitution':
        params.pos = document.getElementById('subPos')?.value;
        params.newNuc = document.getElementById('subNuc')?.value;
        break;

      case 'insertion':
        params.pos = document.getElementById('insPos')?.value;
        params.seq = document.getElementById('insSeq')?.value;
        break;

      case 'deletion':
        params.start = document.getElementById('delStart')?.value;
        params.end = document.getElementById('delEnd')?.value;
        break;
    }

    this.geneController.applyMutation(type, params);
  }
}

export function switchToTab(tab) {
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active-nav');
  });

  document
    .querySelector(`.nav-item[data-nav="${tab}"]`)
    ?.classList.add('active-nav');

  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active-view');
  });

  document.getElementById(`${tab}View`)?.classList.add('active-view');

  const statsRow = document.getElementById('stats-row');

  if (statsRow) {
    statsRow.style.display = tab === 'mutations' ? 'none' : 'flex';
  }

  state.activeTab = tab;

  syncActiveTabMutationUI();
}

export function syncActiveTabMutationUI() {
  const activeTab =
    document.querySelector('.nav-item.active-nav')?.dataset.nav;

  if (!activeTab || (activeTab !== 'exons' && activeTab !== 'domains')) {
    return;
  }

  state.activeTab = activeTab;

  let rendered = false;

  if (activeTab === 'exons') {
    rendered = renderExonsView();
  } else {
    rendered = renderDomainsView();
  }

  const renderState = state.renderState[activeTab];
  const currentMutation = state.mutationSession;

  const highlightKey = currentMutation
    ? currentMutation.id
    : null;

  if (!currentMutation) {
    if (renderState.highlightKey !== null) {
      clearAllExpandedHighlights(activeTab);
      renderState.highlightKey = null;
    }

    return;
  }

  if (rendered || renderState.highlightKey !== highlightKey) {
    if (
      currentMutation.type === 'find' &&
      renderState.highlightKey !== highlightKey
    ) {
      clearAllExpandedHighlights(activeTab);
    }

    if (activeTab === 'exons') {
      applyMutationHighlightsForExons(currentMutation);
    } else {
      applyMutationHighlightsForDomains(currentMutation);
    }

    renderState.highlightKey = highlightKey;
  }
}