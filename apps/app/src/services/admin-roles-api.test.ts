import type { ApiClient } from "@tsuz/api";
import { describe, expect, test, vi } from "vitest";
import {
  createAdminRole,
  disableAdminRole,
  enableAdminRole,
  getAdminRole,
  getAdminRolePermissions,
  listAdminPermissions,
  listAdminRoleUsers,
  listAdminRoles,
  replaceAdminRolePermissions,
  updateAdminRole
} from "./admin-roles-api";

function client() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined),
    patch: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined)
  } as unknown as ApiClient & Record<string, ReturnType<typeof vi.fn>>;
}

describe("admin roles API", () => {
  test("maps list and create requests", async () => {
    const api = client();
    await listAdminRoles(api, { page: 2, page_size: 20, keyword: "ops", is_enabled: true });
    await createAdminRole(api, { name: "运营", description: "运营角色" });
    expect(api.get).toHaveBeenCalledWith("/admin/roles", {
      query: { page: 2, page_size: 20, keyword: "ops", is_enabled: true }
    });
    expect(api.post).toHaveBeenCalledWith("/admin/roles", { name: "运营", description: "运营角色" });
  });

  test("maps detail, update and status requests", async () => {
    const api = client();
    await getAdminRole(api, 4);
    await updateAdminRole(api, 4, { name: "新角色", version: 3 });
    await disableAdminRole(api, 4, "暂时停用");
    await enableAdminRole(api, 4);
    expect(api.get).toHaveBeenCalledWith("/admin/roles/4");
    expect(api.patch).toHaveBeenCalledWith("/admin/roles/4", { name: "新角色", version: 3 });
    expect(api.post).toHaveBeenNthCalledWith(1, "/admin/roles/4/disable", { reason: "暂时停用" });
    expect(api.post).toHaveBeenNthCalledWith(2, "/admin/roles/4/enable");
  });

  test("maps permission and member requests", async () => {
    const api = client();
    await getAdminRolePermissions(api, 4);
    await listAdminPermissions(api);
    await replaceAdminRolePermissions(api, 4, { permission_ids: [1, 2], version: 8 });
    await listAdminRoleUsers(api, 4, { page: 1, page_size: 20, keyword: "alice", is_active: false });
    expect(api.get).toHaveBeenNthCalledWith(1, "/admin/roles/4/permissions");
    expect(api.get).toHaveBeenNthCalledWith(2, "/admin/permissions", {
      query: { page: 1, page_size: 100, is_enabled: true }
    });
    expect(api.put).toHaveBeenCalledWith("/admin/roles/4/permissions", { permission_ids: [1, 2], version: 8 });
    expect(api.get).toHaveBeenNthCalledWith(3, "/admin/roles/4/users", {
      query: { page: 1, page_size: 20, keyword: "alice", is_active: false, is_blacklisted: undefined }
    });
  });
});
