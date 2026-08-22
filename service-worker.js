const CACHE_NAME = "genevis-v3";

const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./static/css/style.css",
  "./static/js/main.js",

  "./static/js/core/models.js",
  "./static/js/core/state.js",
  "./static/js/core/translation.js",
  "./static/js/core/bio-helpers.js",

  "./static/js/data/api.js",
  "./static/js/data/cache.js",
  "./static/js/data/gene-builder.js",

  "./static/js/views/canvas-engine.js",
  "./static/js/views/components.js",
  "./static/js/views/context-menu.js",
  "./static/js/views/highlights.js",
  "./static/js/views/lazy.js",

  "./static/js/mutations/mutation-engine.js",

  "./static/js/controllers/gene-controller.js",
  "./static/js/controllers/ui-controller.js",

  "./static/icons/dna.svg",
  "./static/icons/search.svg",
  "./static/icons/biohazard.svg",
  "./static/icons/shapes.svg",
  "./static/icons/xmark.svg",
  "./static/icons/check.svg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});