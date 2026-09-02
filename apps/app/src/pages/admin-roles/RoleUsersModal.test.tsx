import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import RoleUsersModal from "./RoleUsersModal";
import { listAdminRoleUsers } from "../../services/admin-roles-api";

vi.mock("../../services/admin-roles-api", () => ({ listAdminRoleUsers: vi.fn() }));
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
const user = {
  id: 8,
  email: "user@example.com",
  display_name: "用户",
  is_active: true,
  is_blacklisted: false,
  disabled_at: null,
  disabled_reason: null,
  blacklisted_at: null,
  blacklisted_reason: null,
  password_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  version: 1
};
beforeEach(() => vi.mocked(listAdminRoleUsers).mockResolvedValue({ items: [user], total: 1, page: 1, page_size: 20 }));
describe("RoleUsersModal", () => {
  test("renders associated users as read-only table", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <RoleUsersModal client={{} as never} role={role} open onClose={vi.fn()} />
        </AntApp>
      </QueryClientProvider>
    );
    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("用户")).toBeInTheDocument();
  });
});
