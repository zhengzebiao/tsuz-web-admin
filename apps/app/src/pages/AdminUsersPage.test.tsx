import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminUsersPage from "./AdminUsersPage";
import { createMfeApiClient } from "../services/api-client";
import { disableAdminUser, listAdminUsers } from "../services/admin-users-api";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn(() => ({}))
}));

vi.mock("../services/admin-users-api", () => ({
  blacklistAdminUser: vi.fn(),
  createAdminUser: vi.fn(),
  disableAdminUser: vi.fn(),
  enableAdminUser: vi.fn(),
  forceLogoutAdminUser: vi.fn(),
  getAdminUser: vi.fn(),
  listAdminUsers: vi.fn(),
  recoverAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  updateAdminUser: vi.fn()
}));

const user = {
  id: 7,
  email: "alice@example.com",
  display_name: "Alice",
  is_active: true,
  is_blacklisted: false,
  disabled_at: null,
  disabled_reason: null,
  blacklisted_at: null,
  blacklisted_reason: null,
  password_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  version: 2
};

beforeEach(() => {
  vi.mocked(listAdminUsers).mockResolvedValue({ items: [user], total: 1, page: 1, page_size: 20 });
  vi.mocked(disableAdminUser).mockResolvedValue({ ...user, is_active: false, changed: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminUsersPage", () => {
  test("renders a paginated user table and calls the list API", async () => {
    renderPage();

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("共 1 条")).toBeInTheDocument();
    expect(createMfeApiClient).toHaveBeenCalled();
    expect(listAdminUsers).toHaveBeenCalledWith(expect.anything(), {
      page: 1,
      page_size: 20
    });
  });

  test("opens a reason form instead of immediately disabling a user", async () => {
    renderPage();
    await screen.findByText("alice@example.com");

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    expect(await screen.findByText("禁用用户")).toBeInTheDocument();
    expect(disableAdminUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /确/ }));
    await waitFor(() => expect(disableAdminUser).not.toHaveBeenCalled());
  });

  test("provides the create user action without a create-role action", async () => {
    renderPage();

    expect((await screen.findAllByRole("button", { name: /新增用户/ })).length).toBeGreaterThan(0);
    expect(screen.queryByText("创建角色")).not.toBeInTheDocument();
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminUsersPage />
      </AntApp>
    </QueryClientProvider>
  );
}
