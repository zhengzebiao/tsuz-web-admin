import { describe, expect, test, vi } from "vitest";
import type { ApiClient } from "@tsuz/api";
import {
  blacklistAdminUser,
  disableAdminUser,
  enableAdminUser,
  forceLogoutAdminUser,
  listAdminUsers,
  recoverAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  getAdminUserRoles,
  listAssignableAdminRoles,
  replaceAdminUserRoles
} from "./admin-users-api";

function createClient() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined),
    patch: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined)
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
}

describe("admin users API", () => {
  test("maps list filters to query parameters", async () => {
    const client = createClient();
    await listAdminUsers(client, { page: 2, page_size: 20, keyword: "alice", is_active: true, is_blacklisted: false });
    expect(client.get).toHaveBeenCalledWith("/admin/users", {
      query: { page: 2, page_size: 20, keyword: "alice", is_active: true, is_blacklisted: false }
    });
  });

  test("maps profile update with version", async () => {
    const client = createClient();
    await updateAdminUser(client, 7, { email: "new@example.com", version: 3 });
    expect(client.patch).toHaveBeenCalledWith("/admin/users/7", { email: "new@example.com", version: 3 });
  });

  test("sends reasons only to reason-based actions", async () => {
    const client = createClient();
    await disableAdminUser(client, 7, "reason 1");
    await blacklistAdminUser(client, 7, "reason 2");
    await enableAdminUser(client, 7);
    await recoverAdminUser(client, 7);
    await forceLogoutAdminUser(client, 7);
    expect(client.post).toHaveBeenNthCalledWith(1, "/admin/users/7/disable", { reason: "reason 1" });
    expect(client.post).toHaveBeenNthCalledWith(2, "/admin/users/7/blacklist", { reason: "reason 2" });
    expect(client.post).toHaveBeenNthCalledWith(3, "/admin/users/7/enable");
    expect(client.post).toHaveBeenNthCalledWith(4, "/admin/users/7/recover");
    expect(client.post).toHaveBeenNthCalledWith(5, "/admin/users/7/force-logout");
  });

  test("sends a new password", async () => {
    const client = createClient();
    await resetAdminUserPassword(client, 7, "new-password");
    expect(client.post).toHaveBeenCalledWith("/admin/users/7/reset-password", { new_password: "new-password" });
  });

  test("maps user role endpoints without a create-role request", async () => {
    const client = createClient();
    await listAssignableAdminRoles(client);
    await getAdminUserRoles(client, 7);
    await replaceAdminUserRoles(client, 7, { role_ids: [2, 3], version: 4 });
    expect(client.get).toHaveBeenNthCalledWith(1, "/admin/roles", {
      query: { page: 1, page_size: 100, is_enabled: true }
    });
    expect(client.get).toHaveBeenNthCalledWith(2, "/admin/users/7/roles");
    expect(client.put).toHaveBeenCalledWith("/admin/users/7/roles", { role_ids: [2, 3], version: 4 });
  });
});
