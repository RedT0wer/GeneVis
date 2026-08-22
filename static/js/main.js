import { GeneController } from './controllers/gene-controller.js';
import { UiController } from './controllers/ui-controller.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => console.log('SW registered', reg))
    .catch(err => console.error('SW error', err));
}

const geneController = new GeneController();
const uiController = new UiController(geneController);

document.addEventListener('DOMContentLoaded', () => {
  uiController.init();
});