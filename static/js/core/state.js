export const state = {
  originalGene: null,
  mutatedGene: null,

  originalUI: {
    exons: [],
    domains: []
  },

  mutatedUI: {
    exons: [],
    domains: []
  },

  mutationSession: null,

  // 'original' | 'mutation-preview'
  uiMode: 'original',

  activeTab: 'exons',

  domainColorEnabled: true,
  activeContext: null,

  // Увеличивается при загрузке нового гена
  geneVersion: 0,

  // Какие карточки раскрыты
  expandedCards: {
    exons: new Set(),
    domains: new Set()
  },

  // Служебное состояние рендера
  renderState: {
    exons: {
      key: null,
      highlightKey: null
    },
    domains: {
      key: null,
      highlightKey: null
    }
  }
};

export function getActiveGene() {
  if (state.uiMode === 'mutation-preview' && state.mutatedGene) {
    return state.mutatedGene;
  }

  return state.originalGene;
}

export function getActiveUI() {
  if (state.uiMode === 'mutation-preview' && state.mutatedUI.exons.length) {
    return state.mutatedUI;
  }

  return state.originalUI;
}

export function nextGeneVersion() {
  state.geneVersion += 1;
}

export function clearExpandedCards() {
  state.expandedCards.exons.clear();
  state.expandedCards.domains.clear();
}

export function resetRenderState() {
  state.renderState.exons.key = null;
  state.renderState.exons.highlightKey = null;

  state.renderState.domains.key = null;
  state.renderState.domains.highlightKey = null;
}