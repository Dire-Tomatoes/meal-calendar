import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MealTile } from "./MealTile";

const tacos = {
  id: "tacos",
  name: "Tacos",
  emoji: "🌮",
  imageUrl: "https://example.test/tacos.jpg"
};

afterEach(cleanup);

describe("MealTile", () => {
  test("renders a meal name and emoji without an image when imageUrl is absent", () => {
    const { container } = render(<MealTile meal={{ ...tacos, imageUrl: null }} variant="dugout" />);

    expect(container.querySelector(".recipe-emoji img")).toHaveAttribute("src", expect.stringContaining("1f32e"));
    expect(screen.getByText("Tacos")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders the meal image with descriptive alt text before it fails", () => {
    render(<MealTile meal={tacos} variant="dugout" />);

    expect(screen.getByRole("img", { name: /tacos/i })).toHaveAttribute(
      "src",
      tacos.imageUrl
    );
  });

  test("replaces a broken meal image with the emoji fallback", () => {
    const { container } = render(<MealTile meal={tacos} variant="scheduled" />);

    fireEvent.error(screen.getByRole("img", { name: /tacos/i }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector(".recipe-emoji img")).toHaveAttribute("src", expect.stringContaining("1f32e"));
  });

  test.each(["dugout", "scheduled"] as const)(
    "exposes an accessible %s label containing the meal name",
    (variant) => {
      render(<MealTile meal={tacos} variant={variant} />);

      expect(screen.getByLabelText(/tacos/i)).toBeInTheDocument();
    }
  );
});
