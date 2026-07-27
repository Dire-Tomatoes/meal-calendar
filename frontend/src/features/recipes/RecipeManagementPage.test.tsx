import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RecipeManagementPage } from "./RecipeManagementPage";

type Recipe = {
  id: string;
  name: string;
  emoji: string;
  imageUrl: string | null;
};

const pasta: Recipe = {
  id: "pasta",
  name: "Pasta",
  emoji: "🍝",
  imageUrl: null
};

const ramen: Recipe = {
  id: "ramen",
  name: "Ramen",
  emoji: "🍜",
  imageUrl: "/images/meals/ramen.png"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("RecipeManagementPage", () => {
  const fetchMock = vi.fn();
  let queryClient: QueryClient;
  let recipes: Recipe[];

  beforeEach(() => {
    recipes = [pasta, ramen];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        return jsonResponse(recipes);
      }
      if (path === "/api/v1/meals" && options?.method === "POST") {
        const form = options.body as FormData;
        const recipe: Recipe = {
          id: "miso",
          name: form.get("name") as string,
          emoji: form.get("emoji") as string,
          imageUrl: null
        };
        recipes = [...recipes, recipe];
        return jsonResponse(recipe, 201);
      }
      if (path === "/api/v1/meals/pasta" && options?.method === "PUT") {
        const form = options.body as FormData;
        const updated: Recipe = {
          ...pasta,
          name: form.get("name") as string,
          emoji: form.get("emoji") as string
        };
        recipes = recipes.map((recipe) =>
          recipe.id === updated.id ? updated : recipe
        );
        return jsonResponse(updated);
      }
      if (path === "/api/v1/meals/pasta" && options?.method === "DELETE") {
        recipes = recipes.filter((recipe) => recipe.id !== "pasta");
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    fetchMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <RecipeManagementPage />
      </QueryClientProvider>
    );
  }

  async function fillRecipeForm(name: string, emoji: string) {
    fireEvent.change(screen.getByLabelText("Recipe name"), {
      target: { value: name }
    });
    fireEvent.change(screen.getByLabelText("Emoji"), {
      target: { value: emoji }
    });
  }

  test("creates a recipe and displays the refetched row", async () => {
    renderPage();
    await screen.findByText("Pasta");

    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(await screen.findByText("Miso soup")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/meals",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("includes a selected image file in the create request", async () => {
    renderPage();
    await screen.findByText("Pasta");

    const image = new File(["image"], "dinner.png", { type: "image/png" });
    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.change(screen.getByLabelText("Image"), {
      target: { files: [image] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, options]) =>
          path === "/api/v1/meals" &&
          (options as RequestInit | undefined)?.method === "POST"
      );
      expect(request).toBeDefined();
      expect((request?.[1] as RequestInit).body).toBeInstanceOf(FormData);
      expect(((request?.[1] as RequestInit).body as FormData).get("image")).toBe(image);
    });
  });

  test("pre-fills an edit form and updates the selected recipe", async () => {
    renderPage();
    await screen.findByText("Pasta");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta" }));
    expect(screen.getByLabelText("Recipe name")).toHaveValue("Pasta");
    expect(screen.getByLabelText("Emoji")).toHaveValue("🍝");

    await fillRecipeForm("Pesto pasta", "🍝");
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(await screen.findByText("Pesto pasta")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/meals/pasta",
      expect.objectContaining({ method: "PUT" })
    );
  });

  test("only offers image removal for recipes that have an image", async () => {
    renderPage();
    await screen.findByText("Pasta");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta" }));
    expect(screen.queryByLabelText("Remove current image")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Ramen" }));
    expect(screen.getByLabelText("Remove current image")).toBeInTheDocument();
  });

  test("confirms scheduled calendar entries will be removed before deleting", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Pasta");

    fireEvent.click(screen.getByRole("button", { name: "Delete Pasta" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/scheduled calendar entries/i)
    );
    await waitFor(() =>
      expect(screen.queryByText("Pasta")).not.toBeInTheDocument()
    );
  });

  test("disables submit and delete controls while a recipe mutation is pending", async () => {
    let resolveCreate!: (response: Response) => void;
    const pendingCreate = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        return jsonResponse(recipes);
      }
      if (path === "/api/v1/meals" && options?.method === "POST") {
        return pendingCreate;
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findByText("Pasta");

    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(screen.getByRole("button", { name: "Adding recipe" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Pasta" })).toBeDisabled();

    resolveCreate(jsonResponse({ id: "miso", name: "Miso soup", emoji: "🍲", imageUrl: null }, 201));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add recipe" })).toBeEnabled()
    );
  });

  test("keeps recipes visible and shows a Problem Details error", async () => {
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        return jsonResponse(recipes);
      }
      if (path === "/api/v1/meals" && options?.method === "POST") {
        return jsonResponse(
          {
            title: "Invalid recipe",
            detail: "A recipe named Miso soup already exists."
          },
          409
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findByText("Pasta");

    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(
      await screen.findByText("A recipe named Miso soup already exists.")
    ).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
  });
});
