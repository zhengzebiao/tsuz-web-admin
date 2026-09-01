import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import BusinessHomePage from "./BusinessHomePage";
import { useAppStore } from "../stores/app.store";

beforeEach(() => {
  useAppStore.getState().resetHostProps();
});

describe("BusinessHomePage", () => {
  test("renders standalone state and deterministic business data", async () => {
    renderBusinessHomePage();

    expect(screen.getByRole("heading", { name: "Business home" })).toBeInTheDocument();
    expect(screen.getByText("standalone")).toBeInTheDocument();
    expect(screen.getByText("Auth bridge: standalone")).toBeInTheDocument();
    expect(screen.getByText("API base URL: /api")).toBeInTheDocument();
    expect(await screen.findByText("Open orders")).toBeInTheDocument();
    expect(await screen.findByText("Replace deterministic demo data with a domain API query.")).toBeInTheDocument();
  });
});

function renderBusinessHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BusinessHomePage />
    </QueryClientProvider>
  );
}
