import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    ["用户管理", "/admin/users"],
    ["角色管理", "/admin/roles"],
    ["权限管理", "/admin/permissions"]
  ])("opens the %s list page", (label, path) => {
    renderApp();

    fireEvent.click(screen.getAllByRole("menuitem", { name: new RegExp(label + "$") })[0]);

    expect(screen.getByTestId("current-path")).toHaveTextContent(path);
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  });

  test("renders only the three admin navigation entries", () => {
    renderApp();

    expect(screen.getAllByRole("menuitem").filter((item) => item.classList.contains("ant-menu-item"))).toHaveLength(3);
    expect(screen.queryByText("Business home")).not.toBeInTheDocument();
    expect(screen.queryByText("About")).not.toBeInTheDocument();
  });
});

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <App />
      <RouteProbe />
    </MemoryRouter>
  );
}

function RouteProbe() {
  const location = useLocation();

  return <output data-testid="current-path">{location.pathname}</output>;
}
