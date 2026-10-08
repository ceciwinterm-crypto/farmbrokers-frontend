// Service worker mínimo: permite instalar el CRM como app. Siempre pide la versión nueva a internet;
// solo si no hay conexión muestra la última página guardada.
const CACHE = 'fbcrm-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return; // datos y archivos: directo a internet
  e.respondWith(
    fetch(r).then((resp) => { if (new URL(r.url).pathname === '/') { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put('/', copia)).catch(() => {}); } return resp; })
      .catch(() => caches.match('/').then((x) => x || new Response('<h1 style="font-family:sans-serif">Sin conexión</h1><p style="font-family:sans-serif">Revisa tu internet y vuelve a abrir Farm Brokers.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
  );
});
