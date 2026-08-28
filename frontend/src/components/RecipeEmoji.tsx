import { useState } from "react";

// Import URLs, not SVG markup: images are self-hosted and fetched only as needed.
const artwork = import.meta.glob<string>("/node_modules/@twemoji/svg/*.svg", {
  eager: true,
  query: "?url&no-inline",
  import: "default"
});

export const FALLBACK_EMOJI = "🍽️";

export function emojiArtwork(value: string): string | null {
  const emoji = value.trim();
  const code = Array.from(emoji, (character) => character.codePointAt(0)!.toString(16)).join("-");
  const exact = artwork[`/node_modules/@twemoji/svg/${code}.svg`];
  // Twemoji omits the presentation selector for standalone emoji. Keep it
  // in joined sequences, where it can be part of the canonical asset name.
  const normalized = emoji.includes("\u200d") ? code : code.replace(/-fe0f/g, "");
  return exact ?? artwork[`/node_modules/@twemoji/svg/${normalized}.svg`] ?? null;
}

export function emojiArtworks(value: string): string[] | null {
  let remaining = value.trim();
  if (!remaining || remaining.length > 64) return null;
  const sources: string[] = [];
  while (remaining) {
    if (sources.length === 3) return null;
    // Longest catalog match keeps joined sequences, flags and skin tones
    // together without relying on Intl.Segmenter support on older tablets.
    let end = remaining.length;
    let source: string | null = null;
    while (end > 0 && !(source = emojiArtwork(remaining.slice(0, end)))) end--;
    if (!source) return null;
    sources.push(source);
    remaining = remaining.slice(end).trimStart();
  }
  return sources;
}

export function RecipeEmoji({ emoji }: { emoji: string }) {
  const sources = emojiArtworks(emoji) ?? [null];
  return (
    <span className="recipe-emoji" aria-hidden="true">
      {sources.map((src, index) => <RecipeEmojiIcon key={`${index}:${src}`} src={src} />)}
    </span>
  );
}

function RecipeEmojiIcon({ src }: { src: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span className="recipe-emoji-icon">
      {src && failedSource !== src ? (
        <img src={src} alt="" draggable={false} onError={() => setFailedSource(src)} />
      ) : (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" focusable="false">
          <circle cx="17" cy="16" r="10" />
          <circle cx="17" cy="16" r="6" />
          <path d="M3 3v8m3-8v8M3 8h3M4.5 11v18M30 3v26" />
        </svg>
      )}
    </span>
  );
}
