import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MealDugout } from "./MealDugout";

const meals = [
  {
    id: "pasta",
    name: "Pasta",
    emoji: "🍝",
    imageUrl: null,
    tags: ["Italian", "quick"],
    isFavorite: true
  },
  {
    id: "ramen",
    name: "Ramen",
    emoji: "🍜",
    imageUrl: null,
    tags: ["Japanese"],
    isFavorite: false
  }
];

afterEach(cleanup);

describe("MealDugout", () => {
  test("filters recipes by name or tag", () => {
    render(<DndContext><MealDugout meals={meals} /></DndContext>);

    fireEvent.change(screen.getByLabelText("Search available recipes"), {
      target: { value: "italian" }
    });

    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Ramen")).not.toBeInTheDocument();
  });

  test("can show only favorite recipes", () => {
    render(<DndContext><MealDugout meals={meals} /></DndContext>);

    fireEvent.click(screen.getByLabelText("Show favorites only"));

    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Ramen")).not.toBeInTheDocument();
  });
});
