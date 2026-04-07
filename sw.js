// sw.js - Service Worker basique pour passer le test de PWABuilder
self.addEventListener('install', (event) => {
    console.log('Service Worker installé.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activé.');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Ne rien intercepter de spécial pour le moment (réseau par défaut)
    event.respondWith(fetch(event.request));
});
