import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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
  const version = createHash("sha256")
    .update(JSON.stringify(precacheUrls))
    .digest("hex")
    .slice(0, 16);
  const cacheName = `meal-calendar-shell-${version}`;
  const template = await readFile(templatePath, "utf8");
  const worker = template
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
