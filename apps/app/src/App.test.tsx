import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import App from "./App";
import { useAppStore } from "./stores/app.store";

beforeEach(() => {
  useAppStore.getState().resetHostProps();
});

afterEach(() => {
  cleanup();
});

describe("admin navigation", () => {
  test.each([
    ["用户管理", "/users"],
    ["角色管理", "/roles"],
    ["权限管理", "/permissions"]
  ])("opens the %s list page", (label, path) => {
    renderApp();

    fireEvent.click(screen.getAllByRole("menuitem", { name: new RegExp(label + "$") })[0]);

    expect(screen.getByTestId("current-path")).toHaveTextContent(path);
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  });

  test("renders only the three admin navigation entries", () => {
    renderApp();

    expect(screen.getAllByRole("menuitem").filter((item) => item.classList.contains("ant-menu-item"))).toHaveLength(3);
    expect(screen.getByRole("menu")).toHaveClass("ant-menu-inline");
    expect(document.querySelector(".app-header")).not.toBeInTheDocument();
    expect(screen.queryByText("Business home")).not.toBeInTheDocument();
    expect(screen.queryByText("About")).not.toBeInTheDocument();
  });
});

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={["/users"]}>
          <App />
          <RouteProbe />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
}

function RouteProbe() {
  const location = useLocation();

  return <output data-testid="current-path">{location.pathname}</output>;
}
