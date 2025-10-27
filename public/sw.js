// Service Worker for Bramp AI PWA
const CACHE_NAME = 'bramp-ai-v1';
const urlsToCache = [
  '/',
  '/src/assets/logo.png',
  '/src/assets/solana.png',
  '/src/assets/tether.png',
  '/src/assets/cryptocurrency.png',
  '/src/assets/wallpaper1.jpg',
  '/src/assets/wallpaper2.jpg',
  '/src/assets/wallpaper3.jpg',
  '/src/assets/wallpaper4.jpg',
  '/src/assets/wallpaper5.jpg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
