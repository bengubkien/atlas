import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { SERVICE_WORKER, workerSource } from "./service-worker";

// The worker is a string of browser code, so these tests run it in a sandbox
// with a stand-in for the cache and the network, and fire its events.

type Handler = (event: Record<string, unknown>) => void;

function sandbox(source: string, server: (path: string, init?: RequestInit) => Response | Promise<Response>) {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, Map<string, Response>>();
  const requests: { path: string; cache?: string }[] = [];
  const key = (request: string | { url: string }) => new URL(typeof request === "string" ? request : request.url, "https://clio.test").pathname;
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const caches = {
    open: async (name: string) => ({
      match: async (request: string | { url: string }) => store(name).get(key(request))?.clone(),
      put: async (request: string | { url: string }, response: Response) => void store(name).set(key(request), response.clone()),
      add: async (path: string) => void store(name).set(key(path), (await fetchStub(path)).clone()),
    }),
    match: async (request: string | { url: string }) => {
      for (const cache of stores.values()) if (cache.has(key(request))) return cache.get(key(request))!.clone();
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const fetchStub = async (input: string | { url: string }, init?: RequestInit) => {
    const path = key(input);
    requests.push({ path, cache: init?.cache });
    return server(path, init);
  };
  const self = {
    location: { href: "https://clio.test/sw.js?v=b1&pages=/", origin: "https://clio.test" },
    addEventListener: (name: string, handler: Handler) => handlers.set(name, handler),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchStub, URL, Response, Promise, setTimeout, console });

  /** Fires an event and returns what the worker waited on or answered with. */
  const fire = async (name: string, event: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let answer: Promise<Response> | undefined;
    handlers.get(name)!({
      ...event,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (promise: Promise<Response>) => (answer = Promise.resolve(promise)),
    });
    await Promise.all(waits);
    return answer;
  };
  const get = (path: string) => fire("fetch", { request: { url: `https://clio.test${path}`, method: "GET", mode: "cors", headers: new Headers() } });
  return { fire, get, stores, requests };
}

const json = (body: string, etag: string) => new Response(body, { headers: { etag, "content-type": "application/json" } });

describe("the offline copy's data files", () => {
  it("keeps a data file the first time it's asked for, then serves it with no connection", async () => {
    let online = true;
    const worker = sandbox(SERVICE_WORKER, () => {
      if (!online) throw new TypeError("offline");
      return json("[1]", '"a"');
    });
    expect(await (await worker.get("/data/dictionary.json"))!.text()).toBe("[1]");
    expect(worker.stores.get("atlas-data")?.has("/data/dictionary.json")).toBe(true);

    online = false;
    expect(await (await worker.get("/data/dictionary.json"))!.text()).toBe("[1]");
  });

  it("serves the kept copy and replaces it when the server's file has changed", async () => {
    let body = "old";
    let etag = '"1"';
    const worker = sandbox(SERVICE_WORKER, () => json(body, etag));
    await worker.get("/data/hsk.json");

    body = "new";
    etag = '"2"';
    // The page still gets the kept copy; the new one is fetched behind it.
    expect(await (await worker.get("/data/hsk.json"))!.text()).toBe("old");
    await new Promise((done) => setTimeout(done, 0));
    expect(await (await worker.get("/data/hsk.json"))!.text()).toBe("new");
    // It asks the server, not the browser's own cache.
    expect(worker.requests.every((request) => request.cache === "no-cache")).toBe(true);
  });

  it("doesn't store the file again when the server says it's the same", async () => {
    const worker = sandbox(SERVICE_WORKER, () => json("same", '"1"'));
    await worker.get("/data/hsk.json");
    const kept = worker.stores.get("atlas-data")!.get("/data/hsk.json")!;
    await worker.get("/data/hsk.json");
    await new Promise((done) => setTimeout(done, 0));
    expect(worker.stores.get("atlas-data")!.get("/data/hsk.json")).toBe(kept);
  });

  it("keeps nothing from a failed answer", async () => {
    const worker = sandbox(SERVICE_WORKER, () => new Response("nope", { status: 500 }));
    const answer = await worker.get("/data/hsk.json");
    expect(answer!.status).toBe(500);
    expect(worker.stores.get("atlas-data")?.has("/data/hsk.json") ?? false).toBe(false);
  });

  it("fetches only the files an app lists at install, and a failure doesn't stop the install", async () => {
    const worker = sandbox(workerSource(["/data/hsk.json", "/data/missing.json"]), (path) => {
      if (path === "/") return new Response("<html></html>");
      if (path === "/data/hsk.json") return json("[1]", '"a"');
      throw new TypeError("offline");
    });
    await worker.fire("install");
    const data = worker.stores.get("atlas-data")!;
    expect(data.has("/data/hsk.json")).toBe(true);
    expect(data.has("/data/dictionary.json")).toBe(false);
    expect(worker.stores.get("atlas-pages-b1")?.has("/")).toBe(true);
  });

  it("keeps the data cache when a new build's worker takes over, and drops the old pages", async () => {
    const worker = sandbox(SERVICE_WORKER, () => json("x", '"1"'));
    worker.stores.set("atlas-data", new Map([["/data/hsk.json", json("x", '"1"')]]));
    worker.stores.set("atlas-pages-b0", new Map());
    worker.stores.set("atlas-pages-b1", new Map());
    await worker.fire("activate");
    expect([...worker.stores.keys()].sort()).toEqual(["atlas-data", "atlas-pages-b1"]);
  });
});
