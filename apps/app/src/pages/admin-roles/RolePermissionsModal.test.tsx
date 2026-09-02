import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RolePermissionsModal from "./RolePermissionsModal";
import {
  getAdminRolePermissions,
  listAdminPermissions,
  replaceAdminRolePermissions
} from "../../services/admin-roles-api";

vi.mock("../../services/admin-roles-api", () => ({
  getAdminRolePermissions: vi.fn(),
  listAdminPermissions: vi.fn(),
  replaceAdminRolePermissions: vi.fn()
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
const assigned = {
  id: 3,
  name: "old",
  display_name: "旧权限",
  description: "已停用",
  is_declared: true,
  is_enabled: false
};
const available = {
  id: 1,
  name: "read",
  display_name: "查看",
  description: "查看权限",
  is_declared: true,
  is_enabled: true
};

beforeEach(() => {
  vi.mocked(getAdminRolePermissions).mockResolvedValue({
    role_id: 4,
    permissions: [assigned],
    version: 7,
    changed: false,
    revoked_sessions: 0
  });
  vi.mocked(listAdminPermissions).mockResolvedValue({ items: [available], total: 1, page: 1, page_size: 100 });
  vi.mocked(replaceAdminRolePermissions).mockResolvedValue({
    role_id: 4,
    permissions: [assigned],
    version: 8,
    changed: true,
    revoked_sessions: 0
  });
});
afterEach(() => vi.clearAllMocks());

describe("RolePermissionsModal", () => {
  test("loads and preserves a disabled assigned permission", async () => {
    renderModal();
    expect(await screen.findByText("旧权限（已禁用）")).toBeInTheDocument();
  });
  test("submits selected permission ids with permission version", async () => {
    renderModal();
    await screen.findByText("旧权限（已禁用）");
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("查看（read）"));
    fireEvent.click(screen.getAllByRole("button", { name: /保存权限/ })[0]);
    await waitFor(() =>
      expect(replaceAdminRolePermissions).toHaveBeenCalledWith(expect.anything(), 4, {
        permission_ids: [3, 1],
        version: 7
      })
    );
  });
});
function renderModal() {
  const client = {} as never;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <RolePermissionsModal client={client} role={role} open onClose={vi.fn()} />
      </AntApp>
    </QueryClientProvider>
  );
}
