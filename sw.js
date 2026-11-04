// Service worker: guarda toda la app y los datos cifrados para usarla sin conexión.
// Python (Pyodide) y el editor van en una caché aparte (PY_CACHE) que no se borra con cada versión del contenido:
// se rellena la primera vez que se usan las prácticas o al pulsar "Descargar Python".
const VERSION = 'v20261031-023775ac';
const ASSETS = ["./","app.css","app.js","data/a1.bin","data/a2.bin","data/a3.bin","data/a4.bin","data/a5.bin","data/a6.bin","data/catalog.bin","data/p.bin","data/t1.bin","data/t2.bin","data/t3.bin","data/t4.bin","data/t5.bin","data/t6.bin","fonts/atkinson-400-italic.woff2","fonts/atkinson-400-normal.woff2","fonts/atkinson-700-normal.woff2","icons/favicon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest","py-worker.js","py/runner.py","vendor/d3.min.js","vendor/markmap-view.js","data/meta.json"];
const PY_CACHE = 'py-128975df0c';
const PY_ASSETS = new Set(["vendor/editor.js","vendor/pyodide/annotated_types-0.7.0-py3-none-any.whl","vendor/pyodide/pydantic-2.14.1-py3-none-any.whl","vendor/pyodide/pydantic_core-2.50.1-cp314-cp314-pyemscripten_2026_0_wasm32.whl","vendor/pyodide/pyodide-lock.json","vendor/pyodide/pyodide.asm.mjs","vendor/pyodide/pyodide.asm.wasm","vendor/pyodide/pyodide.mjs","vendor/pyodide/python_stdlib.zip","vendor/pyodide/typing_extensions-4.16.0-py3-none-any.whl","vendor/pyodide/typing_inspection-0.4.4-py3-none-any.whl"]);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^(v\d{8}-|py-)/.test(k) && k !== VERSION && k !== PY_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const rel = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  e.respondWith((async () => {
    if (PY_ASSETS.has(rel)) {
      const pc = await caches.open(PY_CACHE);
      const hit = await pc.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) pc.put(req, res.clone());
      return res;
    }
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const index = await cache.match('./');
      if (index) return index;
    }
    return fetch(req);
  })());
});
