import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import UserRolesModal from "./UserRolesModal";
import { getAdminUserRoles, listAssignableAdminRoles, replaceAdminUserRoles } from "../../services/admin-users-api";

vi.mock("../../services/admin-users-api", () => ({
  getAdminUserRoles: vi.fn(),
  listAssignableAdminRoles: vi.fn(),
  replaceAdminUserRoles: vi.fn()
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
const activeRole = { id: 2, name: "运营", description: "运营角色", is_enabled: true };
const disabledRole = { id: 3, name: "旧角色", description: "已停用", is_enabled: false };

beforeEach(() => {
  vi.mocked(getAdminUserRoles).mockResolvedValue({
    user_id: 7,
    roles: [disabledRole],
    version: 9,
    changed: false,
    revoked_sessions: 0
  });
  vi.mocked(listAssignableAdminRoles).mockResolvedValue({ items: [activeRole], total: 1, page: 1, page_size: 100 });
  vi.mocked(replaceAdminUserRoles).mockResolvedValue({
    user_id: 7,
    roles: [disabledRole],
    version: 10,
    changed: true,
    revoked_sessions: 1
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UserRolesModal", () => {
  test("loads assigned and available roles, preserving a disabled assigned role", async () => {
    renderModal();
    expect(await screen.findByText("分配用户角色")).toBeInTheDocument();
    expect(await screen.findByText("旧角色（已禁用）")).toBeInTheDocument();
    expect(screen.queryByText("运营（已禁用）")).not.toBeInTheDocument();
  });

  test("submits selected role ids with the roles response version", async () => {
    renderModal();
    await screen.findByText("旧角色（已禁用）");
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("运营"));
    fireEvent.click(screen.getAllByRole("button", { name: /保存角色/ })[0]);
    await waitFor(() =>
      expect(replaceAdminUserRoles).toHaveBeenCalledWith(expect.anything(), 7, { role_ids: [3, 2], version: 9 })
    );
  });

  test("disables saving when role data fails and exposes retry", async () => {
    vi.mocked(getAdminUserRoles).mockRejectedValue(new Error("load failed"));
    renderModal();
    expect(await screen.findByText("角色数据加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存角色/ })).toBeDisabled();
  });
});

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <UserRolesModal client={{} as never} user={user} open onClose={vi.fn()} />
      </AntApp>
    </QueryClientProvider>
  );
}
