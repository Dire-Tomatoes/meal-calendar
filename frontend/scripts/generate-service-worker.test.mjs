import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateServiceWorker } from "./generate-service-worker.mjs";

const temporaryDirectories = [];

async function makeTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "meal-calendar-sw-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function writePrecacheAssets(directory) {
  const assetsDirectory = join(directory, "assets");
  await mkdir(assetsDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "index.html"), "<main>calendar</main>"),
    writeFile(
      join(directory, "manifest.webmanifest"),
      '{"name":"Meal Calendar"}'
    ),
    writeFile(join(directory, "pwa-192x192.png"), "192 icon"),
    writeFile(join(directory, "pwa-512x512.png"), "512 icon"),
    writeFile(join(directory, "apple-touch-icon.png"), "apple icon"),
    writeFile(join(assetsDirectory, "app-ABC.js"), "app javascript"),
    writeFile(join(assetsDirectory, "app-DEF.css"), "app css")
  ]);
}

describe("generateServiceWorker", () => {
  test("writes a deterministic versioned precache from a controlled Vite manifest", async () => {
    const directory = await makeTemporaryDirectory();
    const manifestPath = join(directory, "manifest.json");
    const templatePath = join(directory, "sw-template.js");
    const outputPath = join(directory, "sw.js");

    await writeFile(
      manifestPath,
      JSON.stringify({
        "src/main.tsx": {
          file: "assets/app-ABC.js",
          name: "index",
          src: "src/main.tsx",
          isEntry: true,
          css: ["assets/app-DEF.css"]
        },
        "_shared.js": {
          file: "assets/shared-IGNORED.js",
          name: "shared"
        }
      })
    );
    await writeFile(
      templatePath,
      [
        'const CACHE_NAME = "__CACHE_NAME__";',
        "const PRECACHE_URLS = __PRECACHE_URLS__;"
      ].join("\n")
    );
    await writePrecacheAssets(directory);

    const generated = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    expect(generated).toEqual({
      cacheName: expect.stringMatching(
        /^meal-calendar-shell-[a-f0-9]{16}$/
      ),
      precacheUrls: [
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/pwa-192x192.png",
        "/pwa-512x512.png",
        "/apple-touch-icon.png",
        "/assets/app-ABC.js",
        "/assets/app-DEF.css"
      ]
    });
    expect(await readFile(outputPath, "utf8")).toBe(
      [
        `const CACHE_NAME = "${generated.cacheName}";`,
        "const PRECACHE_URLS = " +
          '["/","/index.html","/manifest.webmanifest",' +
          '"/pwa-192x192.png","/pwa-512x512.png",' +
          '"/apple-touch-icon.png","/assets/app-ABC.js",' +
          '"/assets/app-DEF.css"];'
      ].join("\n")
    );

    const repeated = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    expect(repeated.cacheName).toBe(generated.cacheName);
  });

  test("changes the cache identity when fixed-name shell contents change", async () => {
    const directory = await makeTemporaryDirectory();
    const manifestPath = join(directory, "manifest.json");
    const templatePath = join(directory, "sw-template.js");
    const outputPath = join(directory, "sw.js");

    await writeFile(
      manifestPath,
      JSON.stringify({
        "src/main.tsx": {
          file: "assets/app-ABC.js",
          isEntry: true,
          css: ["assets/app-DEF.css"]
        }
      })
    );
    await writeFile(
      templatePath,
      [
        'const CACHE_NAME = "__CACHE_NAME__";',
        "const PRECACHE_URLS = __PRECACHE_URLS__;"
      ].join("\n")
    );
    await writePrecacheAssets(directory);

    const first = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    await writeFile(
      join(directory, "manifest.webmanifest"),
      '{"name":"Updated Meal Calendar"}'
    );
    const second = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    expect(second.precacheUrls).toEqual(first.precacheUrls);
    expect(second.cacheName).not.toBe(first.cacheName);
  });

  test("changes the cache identity when worker logic changes", async () => {
    const directory = await makeTemporaryDirectory();
    const manifestPath = join(directory, "manifest.json");
    const templatePath = join(directory, "sw-template.js");
    const outputPath = join(directory, "sw.js");

    await writeFile(
      manifestPath,
      JSON.stringify({
        "src/main.tsx": {
          file: "assets/app-ABC.js",
          isEntry: true,
          css: ["assets/app-DEF.css"]
        }
      })
    );
    await writeFile(
      templatePath,
      [
        'const CACHE_NAME = "__CACHE_NAME__";',
        "const PRECACHE_URLS = __PRECACHE_URLS__;"
      ].join("\n")
    );
    await writePrecacheAssets(directory);

    const first = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    await writeFile(
      templatePath,
      [
        'const CACHE_NAME = "__CACHE_NAME__";',
        "const PRECACHE_URLS = __PRECACHE_URLS__;",
        'const WORKER_LOGIC = "updated";'
      ].join("\n")
    );
    const second = await generateServiceWorker({
      manifestPath,
      templatePath,
      outputPath
    });

    expect(second.cacheName).not.toBe(first.cacheName);
  });

  test("fails with an actionable error when a precached build asset is missing", async () => {
    const directory = await makeTemporaryDirectory();
    const manifestPath = join(directory, "manifest.json");
    const templatePath = join(directory, "sw-template.js");
    const outputPath = join(directory, "sw.js");

    await writeFile(
      manifestPath,
      JSON.stringify({
        "src/main.tsx": {
          file: "assets/app-ABC.js",
          isEntry: true,
          css: ["assets/app-DEF.css"]
        }
      })
    );
    await writeFile(
      templatePath,
      [
        'const CACHE_NAME = "__CACHE_NAME__";',
        "const PRECACHE_URLS = __PRECACHE_URLS__;"
      ].join("\n")
    );
    await writePrecacheAssets(directory);
    await unlink(join(directory, "manifest.webmanifest"));

    await expect(
      generateServiceWorker({
        manifestPath,
        templatePath,
        outputPath
      })
    ).rejects.toThrow(
      'Precached build asset "/manifest.webmanifest" is missing'
    );
  });
});

async function buildWorkerHarness({
  fetchResult = new Response("network"),
  cachedResponses = new Map()
} = {}) {
  const directory = await makeTemporaryDirectory();
  const manifestPath = join(directory, "manifest.json");
  const outputPath = join(directory, "sw.js");
  const listeners = new Map();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn(async (request) => {
      const key = typeof request === "string" ? request : request.url;
      return cachedResponses.get(key);
    })
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn(),
    delete: vi.fn().mockResolvedValue(true)
  };
  const fetch = vi.fn(async () => {
    if (fetchResult instanceof Error) {
      throw fetchResult;
    }
    return fetchResult;
  });
  const serviceWorker = {
    location: { origin: "https://meal.test" },
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) }
  };

  await writeFile(
    manifestPath,
    JSON.stringify({
      "src/main.tsx": {
        file: "assets/app-ABC.js",
        isEntry: true,
        css: ["assets/app-DEF.css"]
      }
    })
  );
  await writePrecacheAssets(directory);
  const generated = await generateServiceWorker({
    manifestPath,
    templatePath: join(process.cwd(), "public", "sw-template.js"),
    outputPath
  });
  caches.keys.mockResolvedValue([
    "meal-calendar-shell-old",
    generated.cacheName,
    "unrelated-cache"
  ]);

  vm.runInNewContext(await readFile(outputPath, "utf8"), {
    self: serviceWorker,
    caches,
    fetch,
    URL,
    Set,
    Promise
  });

  return {
    cache,
    cacheName: generated.cacheName,
    caches,
    fetch,
    listeners,
    serviceWorker
  };
}

function dispatchExtendable(listener, extra = {}) {
  let lifetime;
  listener({
    ...extra,
    waitUntil(promise) {
      lifetime = promise;
    }
  });
  return lifetime;
}

function dispatchFetch(listener, request) {
  let response;
  listener({
    request,
    respondWith(promise) {
      response = promise;
    }
  });
  return response;
}

describe("generated native service worker", () => {
  test("precaches only the generated shell and remains waiting after install", async () => {
    const harness = await buildWorkerHarness();

    await dispatchExtendable(harness.listeners.get("install"));

    expect(harness.caches.open).toHaveBeenCalledWith(harness.cacheName);
    expect(harness.cache.addAll).toHaveBeenCalledWith([
      "/",
      "/index.html",
      "/manifest.webmanifest",
      "/pwa-192x192.png",
      "/pwa-512x512.png",
      "/apple-touch-icon.png",
      "/assets/app-ABC.js",
      "/assets/app-DEF.css"
    ]);
    expect(harness.serviceWorker.skipWaiting).not.toHaveBeenCalled();
  });

  test("starts activation only for an explicit SKIP_WAITING message", () => {
    const harnessPromise = buildWorkerHarness();

    return harnessPromise.then((harness) => {
      const onMessage = harness.listeners.get("message");
      onMessage({ data: "NOT_NOW" });
      expect(harness.serviceWorker.skipWaiting).not.toHaveBeenCalled();

      onMessage({ data: "SKIP_WAITING" });
      expect(harness.serviceWorker.skipWaiting).toHaveBeenCalledOnce();
    });
  });

  test("deletes older shell caches and claims clients during activation", async () => {
    const harness = await buildWorkerHarness();

    await dispatchExtendable(harness.listeners.get("activate"));

    expect(harness.caches.delete).toHaveBeenCalledTimes(1);
    expect(harness.caches.delete).toHaveBeenCalledWith(
      "meal-calendar-shell-old"
    );
    expect(harness.serviceWorker.clients.claim).toHaveBeenCalledOnce();
  });

  test("always sends API and meal-image requests to the network without opening a cache", async () => {
    const harness = await buildWorkerHarness();
    const onFetch = harness.listeners.get("fetch");

    await dispatchFetch(onFetch, {
      method: "GET",
      mode: "cors",
      url: "https://meal.test/api/v1/meals"
    });
    await dispatchFetch(onFetch, {
      method: "GET",
      mode: "cors",
      url: "https://meal.test/images/meals/tacos.jpg"
    });

    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(harness.caches.open).not.toHaveBeenCalled();
  });

  test("uses network-first navigation with cached index only as the offline fallback", async () => {
    const cachedIndex = new Response("offline shell");
    const harness = await buildWorkerHarness({
      fetchResult: new Error("offline"),
      cachedResponses: new Map([["/index.html", cachedIndex]])
    });

    const response = await dispatchFetch(harness.listeners.get("fetch"), {
      method: "GET",
      mode: "navigate",
      url: "https://meal.test/calendar/week"
    });

    expect(await response.text()).toBe("offline shell");
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.cache.match).toHaveBeenCalledWith("/index.html");
  });

  test("uses cache-first only for an exact versioned precache URL", async () => {
    const cachedAsset = new Response("cached app");
    const harness = await buildWorkerHarness({
      cachedResponses: new Map([
        ["https://meal.test/assets/app-ABC.js", cachedAsset]
      ])
    });
    const onFetch = harness.listeners.get("fetch");

    const assetResponse = await dispatchFetch(onFetch, {
      method: "GET",
      mode: "cors",
      url: "https://meal.test/assets/app-ABC.js"
    });
    const unrelatedResponse = dispatchFetch(onFetch, {
      method: "GET",
      mode: "cors",
      url: "https://meal.test/uploads/photo.png"
    });

    expect(await assetResponse.text()).toBe("cached app");
    expect(unrelatedResponse).toBeUndefined();
    expect(harness.fetch).not.toHaveBeenCalled();
  });

  test("ignores non-GET and cross-origin requests", async () => {
    const harness = await buildWorkerHarness();
    const onFetch = harness.listeners.get("fetch");

    expect(
      dispatchFetch(onFetch, {
        method: "POST",
        mode: "cors",
        url: "https://meal.test/api/v1/schedule"
      })
    ).toBeUndefined();
    expect(
      dispatchFetch(onFetch, {
        method: "GET",
        mode: "cors",
        url: "https://cdn.example.com/assets/app-ABC.js"
      })
    ).toBeUndefined();
    expect(harness.fetch).not.toHaveBeenCalled();
    expect(harness.caches.open).not.toHaveBeenCalled();
  });
});
