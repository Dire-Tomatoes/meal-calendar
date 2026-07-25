import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png"
];

function toRootRelative(assetPath) {
  return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
}

function getBuildDirectory(manifestPath) {
  const manifestDirectory = dirname(manifestPath);
  return basename(manifestDirectory) === ".vite"
    ? dirname(manifestDirectory)
    : manifestDirectory;
}

function getPrecacheAssetPath(buildDirectory, url) {
  const assetUrl = url === "/" ? "/index.html" : url;
  return join(buildDirectory, ...assetUrl.slice(1).split("/"));
}

async function readPrecacheAsset(buildDirectory, url) {
  const assetPath = getPrecacheAssetPath(buildDirectory, url);

  try {
    return await readFile(assetPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Precached build asset "${url}" is missing at "${assetPath}". ` +
          "Run the Vite build before generating the service worker.",
        { cause: error }
      );
    }

    throw error;
  }
}

export async function generateServiceWorker({
  manifestPath,
  templatePath,
  outputPath
}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entryAssets = Object.values(manifest)
    .filter((entry) => entry.isEntry)
    .flatMap((entry) => [entry.file, ...(entry.css ?? [])])
    .map(toRootRelative)
    .sort();
  const precacheUrls = [...new Set([...SHELL_URLS, ...entryAssets])];
  const buildDirectory = getBuildDirectory(manifestPath);
  const template = await readFile(templatePath);
  const precacheAssets = await Promise.all(
    precacheUrls.map((url) => readPrecacheAsset(buildDirectory, url))
  );
  const versionHash = createHash("sha256")
    .update(JSON.stringify(precacheUrls))
    .update("\0service-worker-template\0")
    .update(template);

  for (const [index, url] of precacheUrls.entries()) {
    versionHash
      .update(`\0precache-url:${url}\0`)
      .update(precacheAssets[index]);
  }

  const version = versionHash.digest("hex").slice(0, 16);
  const cacheName = `meal-calendar-shell-${version}`;
  const worker = template
    .toString("utf8")
    .replaceAll("__CACHE_NAME__", cacheName)
    .replace("__PRECACHE_URLS__", JSON.stringify(precacheUrls));

  await writeFile(outputPath, worker);

  return { cacheName, precacheUrls };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await generateServiceWorker({
    manifestPath: "dist/.vite/manifest.json",
    templatePath: "public/sw-template.js",
    outputPath: "dist/sw.js"
  });
}
