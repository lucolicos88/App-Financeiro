/**
 * Service Worker para PWA - Controle Financeiro
 * Versão: 2.3.0
 */

const CACHE_NAME = 'financeiro-v2.3.0';
const CACHE_ASSETS = [
  '/',
  '/main.html',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto');
        return cache.addAll(CACHE_ASSETS);
      })
      .catch((error) => {
        console.error('[SW] Erro ao cachear assets:', error);
      })
  );

  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Interceptar requisições (Network First Strategy)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET ou extensões do Chrome
  if (event.request.method !== 'GET' ||
      event.request.url.includes('chrome-extension')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar resposta para salvar no cache
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Se falhar (offline), tentar buscar do cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Retornar página offline genérica
            return caches.match('/');
          });
      })
  );
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
