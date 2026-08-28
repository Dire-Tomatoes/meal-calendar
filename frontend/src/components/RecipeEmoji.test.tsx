import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RecipeEmoji, emojiArtwork } from "./RecipeEmoji";

afterEach(cleanup);

test.each(["🍝🌮", "🍝 🌮 🍲", "👩🏽‍🍳❤️🍽️"])("renders each selected icon in %s", (emoji) => {
  const { container } = render(<RecipeEmoji emoji={emoji} />);
  expect(container.querySelectorAll("img")).toHaveLength(emoji === "🍝🌮" ? 2 : 3);
  expect(container.querySelectorAll(".recipe-emoji")).toHaveLength(1);
});

test("replaces only the failed icon in a group", () => {
  const { container } = render(<RecipeEmoji emoji="🍝🌮" />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
});

test.each(["🍝🌮🍲🍕", "🍝hello"])("falls back for invalid groups: %s", (emoji) => {
  const { container } = render(<RecipeEmoji emoji={emoji} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelectorAll("svg")).toHaveLength(1);
});

test.each(["🍝", "🍽️", "❤️", "👩‍🍳", "👍🏽"])("resolves bundled artwork for %s", (emoji) => {
  expect(emojiArtwork(emoji)).toMatch(/\.svg/);
});

test.each(["", "hello", "🍝🍝", "\uFFFD", "../../pizza", "🍝‍🍝"])("rejects unavailable artwork for %s", (emoji) => {
  expect(emojiArtwork(emoji)).toBeNull();
});

test("uses artwork rather than device fonts and falls back when loading fails", () => {
  const { container, rerender } = render(<RecipeEmoji emoji="🍝" />);
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("1f35d"));
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
  rerender(<RecipeEmoji emoji="🌮" />);
  expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("1f32e"));
});

test("uses a font-independent fallback for unavailable legacy values", () => {
  const { container } = render(<RecipeEmoji emoji="not emoji" />);
  expect(container.querySelector("svg")).not.toBeNull();
  expect(container.textContent).not.toContain("not emoji");
});
