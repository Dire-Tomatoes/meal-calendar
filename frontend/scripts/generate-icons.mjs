import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(scriptDirectory, "..", "public");
const iconSource = join(publicDirectory, "icon.svg");

await Promise.all([
  sharp(iconSource)
    .resize(192, 192)
    .png()
    .toFile(join(publicDirectory, "pwa-192x192.png")),
  sharp(iconSource)
    .resize(512, 512)
    .png()
    .toFile(join(publicDirectory, "pwa-512x512.png")),
  sharp(iconSource)
    .resize(180, 180)
    .png()
    .toFile(join(publicDirectory, "apple-touch-icon.png"))
]);
