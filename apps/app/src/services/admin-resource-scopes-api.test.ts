import type { ApiClient } from "@tsuz/api";
import { describe, expect, test, vi } from "vitest";
import {
  createAdminResourceScope,
  disableAdminResourceScope,
  enableAdminResourceScope,
  listAdminResourceScopes
} from "./admin-resource-scopes-api";

function createClient() {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue(undefined)
  } as unknown as ApiClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
}

describe("admin resource scopes API", () => {
  test("maps list filters without dropping a disabled filter", async () => {
    const client = createClient();

    await listAdminResourceScopes(client, {
      page: 2,
      page_size: 20,
      target_app_id: "orders-service",
      is_enabled: false
    });

    expect(client.get).toHaveBeenCalledWith("/admin/resource-scopes", {
      query: {
        page: 2,
        page_size: 20,
        target_app_id: "orders-service",
        is_enabled: false
      }
    });
  });

  test("omits an empty target app id", async () => {
    const client = createClient();

    await listAdminResourceScopes(client, {
      page: 1,
      page_size: 20,
      target_app_id: "",
      is_enabled: true
    });

    expect(client.get).toHaveBeenCalledWith("/admin/resource-scopes", {
      query: {
        page: 1,
        page_size: 20,
        target_app_id: undefined,
        is_enabled: true
      }
    });
  });

  test("maps scope creation with the business app id", async () => {
    const client = createClient();
    const body = {
      target_app_id: "orders-service",
      scope_code: "orders.read",
      description: "读取订单"
    };

    await createAdminResourceScope(client, body);

    expect(client.post).toHaveBeenCalledWith("/admin/resource-scopes", body);
  });

  test("uses the numeric scope id for status actions without request bodies", async () => {
    const client = createClient();

    await disableAdminResourceScope(client, 7);
    await enableAdminResourceScope(client, 8);

    expect(client.post).toHaveBeenNthCalledWith(1, "/admin/resource-scopes/7/disable");
    expect(client.post).toHaveBeenNthCalledWith(2, "/admin/resource-scopes/8/enable");
  });
});
