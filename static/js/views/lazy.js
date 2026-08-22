import { state } from '../core/state.js';

function getTabForCard(card) {
  return card?.dataset?.type === 'domain' ? 'domains' : 'exons';
}

function markExpanded(card) {
  if (!card?.id) return;

  const tab = getTabForCard(card);
  const set = state.expandedCards[tab];

  if (set) {
    set.add(card.id);
  }
}

function markCollapsed(card) {
  if (!card?.id) return;

  const tab = getTabForCard(card);
  const set = state.expandedCards[tab];

  if (set) {
    set.delete(card.id);
  }
}

export function ensureCardExpanded(card) {
  if (!card) return;

  const wrapper = card.querySelector('.canvas-wrapper');
  const btn = card.querySelector('.toggle-sequence');

  if (card.dataset.rendered !== 'true') {
    if (wrapper) {
      wrapper.style.display = 'block';
    }

    if (typeof card.__init === 'function') {
      card.__init();
    }

    card.dataset.rendered = 'true';

    if (btn) {
      btn.textContent = 'Скрыть';
    }

    markExpanded(card);

    return;
  }

  if (wrapper && wrapper.style.display === 'none') {
    wrapper.style.display = 'block';

    if (btn) {
      btn.textContent = 'Скрыть';
    }

    markExpanded(card);
  }
}

export function toggleSequenceCard(card) {
  if (!card) return;

  if (card.dataset.rendered !== 'true') {
    ensureCardExpanded(card);
    return;
  }

  const wrapper = card.querySelector('.canvas-wrapper');
  const btn = card.querySelector('.toggle-sequence');

  if (!wrapper) return;

  const visible = wrapper.style.display !== 'none';

  wrapper.style.display = visible ? 'none' : 'block';

  if (btn) {
    btn.textContent = visible ? 'Показать' : 'Скрыть';
  }

  if (visible) {
    markCollapsed(card);
  } else {
    markExpanded(card);
  }
}