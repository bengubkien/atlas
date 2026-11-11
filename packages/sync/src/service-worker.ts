// The offline copy, shared by the offline-first apps. An app's screens read
// from the device's own database, so a screen only needs its page and
// scripts to work: this keeps them. With the server off, the app still
// opens; changes wait on the device and sync when the server is back.
//
// Served by the app at /sw.js (app/sw.js/route.ts: `export const GET =
// serviceWorkerRoute`) and registered with ?v=<build>&pages=/,/a,/b (see
// useSyncRuntime): each build caches its own pages and scripts and drops the
// old ones.
//
// Data files (/data/*.json, an app's word lists for instance) are big and
// change rarely, so they aren't named by build: they're served from the cache
// and checked against the server in the background (by ETag), and the copy
// kept is replaced when the server's differs. Only the files an app lists in
// `precache` are fetched at install; the rest are kept the first time they're
// asked for, so a 9 MB file never delays the app's first open.

/** The worker's source. `precache`: data files to fetch at install, each a path like "/data/hsk.json". */
export function workerSource(precache: readonly string[] = []): string {
  return SOURCE.replace("const DATA_PRECACHE = [];", "const DATA_PRECACHE = " + JSON.stringify(precache) + ";");
}

const SOURCE = String.raw`
const params = new URL(self.location.href).searchParams;
const VERSION = params.get("v") || "dev";
const SHELL = (params.get("pages") || "/").split(",").filter(Boolean);
const PAGES = "atlas-pages-" + VERSION;
const STATIC = "atlas-static-" + VERSION;
// Not named by build, so a new build keeps (and then revalidates) what's here.
const DATA = "atlas-data";
const DATA_PRECACHE = [];
const EXTRAS = ["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-icon.png"];
// A server that's off can make a request wait instead of fail: don't wait longer.
const PATIENCE_MS = 3000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

// The same file? An ETag says so; failing that, the date and size.
const sameFile = (a, b) => {
  const tag = a.headers.get("etag");
  if (tag && b.headers.get("etag")) return tag === b.headers.get("etag");
  return a.headers.get("last-modified") === b.headers.get("last-modified") && a.headers.get("content-length") === b.headers.get("content-length");
};

// Asks the server whether the file changed ("no-cache" sends the ETag, so an
// unchanged file costs a short answer) and keeps the new one if it did.
async function refreshData(path, cached) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-cache" });
  if (!response.ok) return response;
  const data = await caches.open(DATA);
  const have = cached ?? (await data.match(path));
  if (!have || !sameFile(have, response)) await data.put(path, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    const statics = await caches.open(STATIC);
    const assets = new Set();
    for (const path of SHELL) {
      const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) continue;
      const html = await response.clone().text();
      await pages.put(path, response);
      for (const match of html.matchAll(/(\/_next\/static\/[^"'()\s\\]+)/g)) assets.add(match[1]);
    }
    await Promise.all([...assets, ...EXTRAS].map((asset) => statics.add(asset).catch(() => undefined)));
    // Small data files only; a failure here must not stop the app installing.
    await Promise.all(DATA_PRECACHE.map((path) => refreshData(path).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== PAGES && name !== STATIC && name !== DATA) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Data files: the kept copy at once, checked against the server behind it;
  // not kept yet, the network, and then kept.
  if (url.pathname.startsWith("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith((async () => {
      const cached = await (await caches.open(DATA)).match(url.pathname);
      if (cached) {
        event.waitUntil(refreshData(url.pathname, cached).catch(() => undefined));
        return cached;
      }
      return refreshData(url.pathname);
    })());
    return;
  }

  // Scripts, styles and fonts never change under the same name: the cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(STATIC)).put(request, response.clone());
      return response;
    })));
    return;
  }

  // Opening a screen: the cached page at once, refreshed in the background.
  if (request.mode === "navigate") {
    const key = SHELL.includes(url.pathname) ? url.pathname : "/";
    event.respondWith((async () => {
      const pages = await caches.open(PAGES);
      const cached = await pages.match(key);
      const fresh = withTimeout(fetch(request), PATIENCE_MS).then(async (response) => {
        if (response.ok && SHELL.includes(url.pathname)) await pages.put(key, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(fresh.catch(() => undefined));
        return cached;
      }
      return fresh.catch(() => new Response("Not available offline yet: open it once with the server on.", { status: 503 }));
    })());
    return;
  }

  // Moving between screens in the app: if the server doesn't answer quickly,
  // fail, and the app opens the screen as a page instead (from the cache).
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(withTimeout(fetch(request), PATIENCE_MS).catch(() => Response.error()));
    return;
  }

  // Icons and the manifest: the cache, then the network.
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
`;

export const SERVICE_WORKER = workerSource();

const headers = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" };

/** The route handler serving the worker at /sw.js. Never cached, so a new build's worker is found at once. */
export function serviceWorkerRoute(): Response {
  return new Response(SERVICE_WORKER, { headers });
}

/** The same handler for an app that has data files to fetch at install: `export const GET = serviceWorkerRouteFor({ precache: ["/data/hsk.json"] })`. */
export function serviceWorkerRouteFor({ precache }: { precache: readonly string[] }): () => Response {
  const source = workerSource(precache);
  return () => new Response(source, { headers });
}
