import type { ApiClient } from "@tsuz/api";
import { describe, expect, test, vi } from "vitest";
import { createAdminServiceGrant, listAdminServiceGrants, revokeAdminServiceGrant } from "./admin-service-grants-api";

function createClient() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined)
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
}

describe("admin service grants API", () => {
  test("maps all list filters", async () => {
    const client = createClient();

    await listAdminServiceGrants(client, {
      page: 2,
      page_size: 20,
      caller_app_id: "caller-service",
      target_app_id: "orders-service",
      status: "revoked"
    });

    expect(client.get).toHaveBeenCalledWith("/admin/service-grants", {
      query: {
        page: 2,
        page_size: 20,
        caller_app_id: "caller-service",
        target_app_id: "orders-service",
        status: "revoked"
      }
    });
  });

  test("omits empty app filters", async () => {
    const client = createClient();

    await listAdminServiceGrants(client, {
      page: 1,
      page_size: 20,
      caller_app_id: "",
      target_app_id: ""
    });

    expect(client.get).toHaveBeenCalledWith("/admin/service-grants", {
      query: {
        page: 1,
        page_size: 20,
        caller_app_id: undefined,
        target_app_id: undefined,
        status: undefined
      }
    });
  });

  test("whitelists grant creation fields and keeps optional times", async () => {
    const client = createClient();
    const body = {
      caller_app_id: "caller-service",
      scope_id: 7,
      valid_from: "2026-09-17T02:00:00.000",
      expires_at: "2026-09-18T02:00:00.000",
      target_app_id: "orders-service"
    };

    await createAdminServiceGrant(client, body);

    expect(client.post).toHaveBeenCalledWith("/admin/service-grants", {
      caller_app_id: "caller-service",
      scope_id: 7,
      valid_from: "2026-09-17T02:00:00.000",
      expires_at: "2026-09-18T02:00:00.000"
    });
  });

  test("omits empty optional times from grant creation", async () => {
    const client = createClient();

    await createAdminServiceGrant(client, {
      caller_app_id: "caller-service",
      scope_id: 8,
      valid_from: null,
      expires_at: undefined
    });

    expect(client.post).toHaveBeenCalledWith("/admin/service-grants", {
      caller_app_id: "caller-service",
      scope_id: 8
    });
  });

  test("uses the numeric grant id and normalizes revoke reasons", async () => {
    const client = createClient();

    await revokeAdminServiceGrant(client, 9, "  retired  ");
    await revokeAdminServiceGrant(client, 10, "   ");

    expect(client.post).toHaveBeenNthCalledWith(1, "/admin/service-grants/9/revoke", { reason: "retired" });
    expect(client.post).toHaveBeenNthCalledWith(2, "/admin/service-grants/10/revoke", { reason: null });
  });
});
