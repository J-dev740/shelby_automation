// Shelby PWA Service Worker — placeholder
// Full caching strategy will be added in Step 13

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
