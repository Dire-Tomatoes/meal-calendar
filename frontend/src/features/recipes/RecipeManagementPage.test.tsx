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

function serviceUnavailableResponse() {
  return jsonResponse(
    {
      title: "Service unavailable",
      detail: "The recipe service is temporarily unavailable."
    },
    503
  );
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
          emoji: form.get("emoji") as string,
          imageUrl:
            form.get("image") instanceof File ? "/images/meals/replacement.png" : pasta.imageUrl
        };
        recipes = recipes.map((recipe) =>
          recipe.id === updated.id ? updated : recipe
        );
        return jsonResponse(updated);
      }
      if (path === "/api/v1/meals/ramen" && options?.method === "PUT") {
        const form = options.body as FormData;
        const updated: Recipe = {
          ...ramen,
          name: form.get("name") as string,
          emoji: form.get("emoji") as string,
          imageUrl: form.get("removeImage") === "true" ? null : ramen.imageUrl
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
    expect(await screen.findByRole("status")).toHaveTextContent("Recipe added.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/meals",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("includes a selected image file in the create request", async () => {
    renderPage();
    await screen.findByText("Pasta");

    const image = new File(["image"], "dinner.png", { type: "image/png" });
    const imageInput = screen.getByLabelText("Image") as HTMLInputElement;
    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.change(imageInput, {
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
    await waitFor(() =>
      expect((screen.getByLabelText("Image") as HTMLInputElement).files).toHaveLength(0)
    );
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
    expect(await screen.findByRole("status")).toHaveTextContent("Recipe updated.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/meals/pasta",
      expect.objectContaining({ method: "PUT" })
    );
  });

  test("submits a selected replacement image in the update request", async () => {
    renderPage();
    await screen.findByText("Pasta");

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta" }));
    const replacement = new File(["image"], "replacement.png", {
      type: "image/png"
    });
    fireEvent.change(screen.getByLabelText("Image"), {
      target: { files: [replacement] }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, options]) =>
          path === "/api/v1/meals/pasta" &&
          (options as RequestInit | undefined)?.method === "PUT"
      );
      expect(request).toBeDefined();
      const form = (request?.[1] as RequestInit).body as FormData;
      expect(form.get("image")).toBe(replacement);
      expect(form.get("removeImage")).toBe("false");
    });
  });

  test("submits removeImage=true when removing the current image", async () => {
    renderPage();
    await screen.findByText("Ramen");

    fireEvent.click(screen.getByRole("button", { name: "Edit Ramen" }));
    fireEvent.click(screen.getByLabelText("Remove current image"));
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, options]) =>
          path === "/api/v1/meals/ramen" &&
          (options as RequestInit | undefined)?.method === "PUT"
      );
      expect(request).toBeDefined();
      const form = (request?.[1] as RequestInit).body as FormData;
      expect(form.get("removeImage")).toBe("true");
      expect(form.get("image")).toBeNull();
    });
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

  test("clears a selected replacement image when editing is cancelled", async () => {
    renderPage();
    await screen.findByText("Ramen");

    fireEvent.click(screen.getByRole("button", { name: "Edit Ramen" }));
    const imageInput = screen.getByLabelText("Image") as HTMLInputElement;
    fireEvent.change(imageInput, {
      target: {
        files: [new File(["image"], "replacement.png", { type: "image/png" })]
      }
    });
    expect(imageInput.files).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));

    expect((screen.getByLabelText("Image") as HTMLInputElement).files).toHaveLength(0);
  });

  test("clears a selected replacement image when current image removal is selected", async () => {
    renderPage();
    await screen.findByText("Ramen");

    fireEvent.click(screen.getByRole("button", { name: "Edit Ramen" }));
    const imageInput = screen.getByLabelText("Image") as HTMLInputElement;
    fireEvent.change(imageInput, {
      target: {
        files: [new File(["image"], "replacement.png", { type: "image/png" })]
      }
    });
    expect(imageInput.files).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Remove current image"));

    expect((screen.getByLabelText("Image") as HTMLInputElement).files).toHaveLength(0);
  });

  test("clears a selected image when switching edit targets", async () => {
    renderPage();
    await screen.findByText("Ramen");

    fireEvent.click(screen.getByRole("button", { name: "Edit Ramen" }));
    const imageInput = screen.getByLabelText("Image") as HTMLInputElement;
    fireEvent.change(imageInput, {
      target: {
        files: [new File(["image"], "replacement.png", { type: "image/png" })]
      }
    });
    expect(imageInput.files).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit Pasta" }));

    expect((screen.getByLabelText("Image") as HTMLInputElement).files).toHaveLength(0);
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
    expect(await screen.findByRole("status")).toHaveTextContent("Recipe deleted.");
  });

  test("reports mutation success and keeps cached recipes visible when its refresh fails", async () => {
    let mealsAttempts = 0;
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        mealsAttempts += 1;
        return mealsAttempts === 1
          ? jsonResponse(recipes)
          : serviceUnavailableResponse();
      }
      if (path === "/api/v1/meals" && options?.method === "POST") {
        return jsonResponse(
          { id: "miso", name: "Miso soup", emoji: "🍲", imageUrl: null },
          201
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findByText("Pasta");

    await fillRecipeForm("Miso soup", "🍲");
    fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));

    expect(
      await screen.findByText("Couldn’t refresh recipes. Showing saved recipes.")
    ).toHaveAttribute("role", "alert");
    expect(await screen.findByRole("status")).toHaveTextContent("Recipe added.");
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.queryByText("Miso soup")).not.toBeInTheDocument();
  });

  test("keeps the cached empty state visible and reports a refresh failure", async () => {
    let mealsAttempts = 0;
    recipes = [];
    fetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/meals" && options?.method === undefined) {
        mealsAttempts += 1;
        return mealsAttempts === 1
          ? jsonResponse(recipes)
          : serviceUnavailableResponse();
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage();
    await screen.findByText("No recipes yet. Add your first one above.");

    await queryClient.invalidateQueries({ queryKey: ["meals"] });

    expect(
      await screen.findByText("Couldn’t refresh recipes. Showing saved recipes.")
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByText("No recipes yet. Add your first one above.")
    ).toBeInTheDocument();
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
