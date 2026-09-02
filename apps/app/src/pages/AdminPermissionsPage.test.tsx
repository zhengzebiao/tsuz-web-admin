import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminPermissionsPage from "./AdminPermissionsPage";
import { createMfeApiClient } from "../services/api-client";
import {
  disableAdminPermission,
  enableAdminPermission,
  getAdminPermission,
  listAdminPermissions,
  updateAdminPermission
} from "../services/admin-permissions-api";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn(() => ({}))
}));

vi.mock("../services/admin-permissions-api", () => ({
  disableAdminPermission: vi.fn(),
  enableAdminPermission: vi.fn(),
  getAdminPermission: vi.fn(),
  listAdminPermissions: vi.fn(),
  updateAdminPermission: vi.fn()
}));

const permission = {
  id: 7,
  name: "users.read",
  display_name: "读取用户",
  description: "查看用户信息",
  resource: "users",
  action: "read",
  is_declared: true,
  is_enabled: true,
  disabled_at: null,
  disabled_reason: null,
  missing_at: null,
  endpoint_count: 1,
  role_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  version: 3
};

beforeEach(() => {
  vi.mocked(listAdminPermissions).mockResolvedValue({ items: [permission], total: 1, page: 1, page_size: 20 });
  vi.mocked(disableAdminPermission).mockResolvedValue({
    ...permission,
    is_enabled: false,
    changed: true,
    revoked_sessions: 0
  });
  vi.mocked(enableAdminPermission).mockResolvedValue({ ...permission, changed: true, revoked_sessions: 0 });
  vi.mocked(updateAdminPermission).mockResolvedValue({ ...permission, changed: true, revoked_sessions: 0 });
  vi.mocked(getAdminPermission).mockResolvedValue({
    ...permission,
    endpoints: [{ http_method: "GET", path: "/users", route_name: "list_users" }]
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminPermissionsPage", () => {
  test("renders a paginated permission table and sends filters", async () => {
    renderPage();
    expect(await screen.findByText("users.read")).toBeInTheDocument();
    expect(screen.getByText("共 1 条")).toBeInTheDocument();
    expect(listAdminPermissions).toHaveBeenCalledWith(expect.anything(), { page: 1, page_size: 20 });

    fireEvent.change(screen.getByPlaceholderText("权限名称 / 显示名称"), { target: { value: "user" } });
    fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
    await waitFor(() =>
      expect(listAdminPermissions).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 20,
        keyword: "user"
      })
    );
  });

  test("opens a reason form before disabling", async () => {
    renderPage();
    await screen.findByText("users.read");
    fireEvent.click(screen.getByRole("switch"));

    expect(await screen.findByText("禁用权限")).toBeInTheDocument();
    expect(disableAdminPermission).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("可选"), { target: { value: "已废弃" } });
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));
    await waitFor(() => expect(disableAdminPermission).toHaveBeenCalledWith(expect.anything(), 7, "已废弃"));
  });

  test("keeps details and edit in the operation column", async () => {
    renderPage();
    await screen.findByText("users.read");

    fireEvent.click(screen.getByRole("button", { name: /详情/ }));
    expect(await screen.findByText("权限详情")).toBeInTheDocument();
    expect(await screen.findByText("list_users")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: /编辑/ }));
    expect(await screen.findByText("编辑权限")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /确\s*认/ }));
    await waitFor(() =>
      expect(updateAdminPermission).toHaveBeenCalledWith(expect.anything(), 7, {
        display_name: "读取用户",
        description: "查看用户信息",
        version: 3
      })
    );
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminPermissionsPage />
      </AntApp>
    </QueryClientProvider>
  );
}
