import { describe, expect, test, vi } from "vitest";
import type { ApiClient } from "@tsuz/api";
import {
  disableAdminPermission,
  enableAdminPermission,
  getAdminPermission,
  listAdminPermissions,
  updateAdminPermission
} from "./admin-permissions-api";

function createClient() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined),
    patch: vi.fn().mockResolvedValue(undefined)
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe("admin permissions API", () => {
  test("maps list filters to query parameters", async () => {
    const client = createClient();
    await listAdminPermissions(client, {
      page: 2,
      page_size: 20,
      keyword: "users.read",
      resource: "users",
      is_declared: true,
      is_enabled: false
    });

    expect(client.get).toHaveBeenCalledWith("/admin/permissions", {
      query: {
        page: 2,
        page_size: 20,
        keyword: "users.read",
        resource: "users",
        is_declared: true,
        is_enabled: false
      }
    });
  });

  test("omits empty list filters", async () => {
    const client = createClient();
    await listAdminPermissions(client, { page: 1, page_size: 20, keyword: "", resource: "" });

    expect(client.get).toHaveBeenCalledWith("/admin/permissions", {
      query: {
        page: 1,
        page_size: 20,
        keyword: undefined,
        resource: undefined,
        is_declared: undefined,
        is_enabled: undefined
      }
    });
  });

  test("maps detail and metadata update with version", async () => {
    const client = createClient();
    await getAdminPermission(client, 7);
    await updateAdminPermission(client, 7, { display_name: "Read users", description: "Can read users", version: 4 });

    expect(client.get).toHaveBeenCalledWith("/admin/permissions/7");
    expect(client.patch).toHaveBeenCalledWith("/admin/permissions/7", {
      display_name: "Read users",
      description: "Can read users",
      version: 4
    });
  });

  test("maps disable reason and enable without a body", async () => {
    const client = createClient();
    await disableAdminPermission(client, 7, "deprecated");
    await enableAdminPermission(client, 7);

    expect(client.post).toHaveBeenNthCalledWith(1, "/admin/permissions/7/disable", { reason: "deprecated" });
    expect(client.post).toHaveBeenNthCalledWith(2, "/admin/permissions/7/enable");
  });
});
