import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ConnectionStatus } from "./ConnectionStatus";

test("keeps its status slot mounted while its message changes", () => {
  const { container, rerender } = render(
    <ConnectionStatus isOnline isSaving={false} isRefreshing={false} />
  );
  const slot = container.querySelector(".connection-status-slot");

  expect(slot).not.toBeNull();
  expect(slot).toBeEmptyDOMElement();

  rerender(<ConnectionStatus isOnline isSaving isRefreshing={false} />);

  expect(container.querySelector(".connection-status-slot")).toBe(slot);
  expect(screen.getByRole("status")).toHaveTextContent("Saving");

  rerender(
    <ConnectionStatus
      isOnline
      isSaving={false}
      isRefreshing={false}
      refreshError={new Error("refresh failed")}
    />
  );

  expect(container.querySelector(".connection-status-slot")).toBe(slot);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Couldn’t refresh. Showing saved meals."
  );

  rerender(<ConnectionStatus isOnline isSaving={false} isRefreshing={false} />);

  expect(container.querySelector(".connection-status-slot")).toBe(slot);
  expect(slot).toBeEmptyDOMElement();
});
