const CACHE_NAME = 'sistema-gestion-v53';
const RUNTIME_CACHE = 'runtime-cache-v11';

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/bottom-tab-bar.css',
  '/bottom-tab-bar.js',
  '/auth-system.js',
  '/auth-styles.css',
  '/firebase-config.js',
  '/firebase-diagnostics.js',
  '/user-menu.js',
  '/user-menu.css',
  '/autorizaciones-widget.js',
  '/modules/core/icon-registry.js',
  '/modules/core/motion-utils.js',
  '/modules/core/module-preloader.js',
  '/modules/core/skeleton-screen.js',
  '/generated-icon.png',
  '/vendor/zxing-browser.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CRITICAL_ASSETS).catch((err) => {
        console.warn('⚠️ Algunos archivos críticos no se pudieron cachear:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    event.respondWith(fetch(request).catch(() =>
      new Response('Operación no disponible sin conexión', { status: 503 })
    ));
    return;
  }

  if (url.hostname.includes('firebasio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  const isModule = url.pathname.startsWith('/modules/');
  const hasVersion = url.searchParams.has('v');
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '/';

  if (isModule || hasVersion || isHTML) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200 && !isHTML) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request).then((cached) =>
        cached || new Response('Contenido no disponible offline', { status: 503 })
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() =>
        new Response('Contenido no disponible offline', { status: 503 })
      );
    })
  );
});
