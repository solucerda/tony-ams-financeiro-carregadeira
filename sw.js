/* Service worker — deixa o app abrir rápido e funcionar como aplicativo.
   Estratégia: arquivos do próprio site = rede primeiro (sempre a versão
   publicada mais nova), com cópia em cache para abrir sem internet.
   Supabase, a API da IA e outros domínios nunca passam pelo cache. */
const CACHE = "ta-frota-v2.5.1";
const ARQUIVOS = [
  "./", "index.html", "style.css", "app.js", "periodo.js", "servicos.js", "shell.js", "nota-qr.js", "config.js",
  "vendor/supabase.min.js", "vendor/chart.min.js", "vendor/jsQR.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys()
    .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  ev.respondWith(
    fetch(req).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return resp;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
