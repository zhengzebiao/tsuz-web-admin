import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdminRolesPage from "./AdminRolesPage";
import { createAdminRole, listAdminRoles } from "../services/admin-roles-api";

vi.mock("../services/api-client", () => ({ createMfeApiClient: vi.fn(() => ({})) }));
vi.mock("../services/admin-roles-api", () => ({
  createAdminRole: vi.fn(),
  disableAdminRole: vi.fn(),
  enableAdminRole: vi.fn(),
  getAdminRole: vi.fn(),
  listAdminRoles: vi.fn(),
  updateAdminRole: vi.fn(),
  getAdminRolePermissions: vi.fn(),
  listAdminPermissions: vi.fn(),
  replaceAdminRolePermissions: vi.fn(),
  listAdminRoleUsers: vi.fn()
}));

const role = {
  id: 4,
  name: "运营",
  description: "运营角色",
  is_enabled: true,
  disabled_at: null,
  disabled_reason: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  version: 2
};

beforeEach(() => {
  vi.mocked(listAdminRoles).mockResolvedValue({ items: [role], total: 1, page: 1, page_size: 20 });
  vi.mocked(createAdminRole).mockResolvedValue(role);
});

describe("AdminRolesPage", () => {
  test("renders role table and create role entry", async () => {
    renderPage();
    expect(await screen.findByText("运营")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /创建角色/ })).toBeInTheDocument();
  });

  test("opens the create role form with API constraints", async () => {
    renderPage();
    await screen.findByText("运营");
    fireEvent.click(screen.getAllByRole("button", { name: /创建角色/ })[0]);
    expect(screen.getByRole("dialog", { name: "创建角色" })).toBeInTheDocument();
    expect(screen.getByLabelText("角色名称")).toBeInTheDocument();
    expect(screen.getByLabelText("描述")).toBeInTheDocument();
  });

  test("does not expose an unrelated role creation duplicate or permission action on page", async () => {
    renderPage();
    await screen.findByText("运营");
    expect(screen.getAllByText("创建角色").length).toBeGreaterThan(0);
    expect(screen.queryByText("新建角色")).not.toBeInTheDocument();
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminRolesPage />
      </AntApp>
    </QueryClientProvider>
  );
}
