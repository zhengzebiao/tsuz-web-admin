import type { ApiClient } from "@tsuz/api";
import { describe, expect, test, vi } from "vitest";
import {
  createAdminApp,
  disableAdminApp,
  enableAdminApp,
  getAdminApp,
  listAdminApps,
  updateAdminApp
} from "./admin-apps-api";

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

describe("admin apps API", () => {
  test("maps list filters to query parameters", async () => {
    const client = createClient();

    await listAdminApps(client, {
      page: 2,
      page_size: 20,
      keyword: "orders",
      is_enabled: false
    });

    expect(client.get).toHaveBeenCalledWith("/admin/apps", {
      query: {
        page: 2,
        page_size: 20,
        keyword: "orders",
        is_enabled: false
      }
    });
  });

  test("omits an empty keyword without dropping an enabled filter", async () => {
    const client = createClient();

    await listAdminApps(client, { page: 1, page_size: 20, keyword: "", is_enabled: true });

    expect(client.get).toHaveBeenCalledWith("/admin/apps", {
      query: {
        page: 1,
        page_size: 20,
        keyword: undefined,
        is_enabled: true
      }
    });
  });

  test("maps app creation and returns the initial-secret response", async () => {
    const client = createClient();
    const body = {
      name: "订单服务",
      icon_url: null,
      access_url: "https://orders.example.test",
      service_account_name: "orders-service"
    };

    await createAdminApp(client, body);

    expect(client.post).toHaveBeenCalledWith("/admin/apps", body);
  });

  test("uses the numeric record id for detail and versioned profile updates", async () => {
    const client = createClient();

    await getAdminApp(client, 7);
    await updateAdminApp(client, 7, {
      name: "订单中心",
      icon_url: null,
      access_url: "https://orders.example.test",
      service_account_name: "orders-service",
      version: 3
    });

    expect(client.get).toHaveBeenCalledWith("/admin/apps/7");
    expect(client.patch).toHaveBeenCalledWith("/admin/apps/7", {
      name: "订单中心",
      icon_url: null,
      access_url: "https://orders.example.test",
      service_account_name: "orders-service",
      version: 3
    });
  });

  test("maps disable reasons and enable without a body", async () => {
    const client = createClient();

    await disableAdminApp(client, 7, "  maintenance  ");
    await disableAdminApp(client, 8, "   ");
    await enableAdminApp(client, 9);

    expect(client.post).toHaveBeenNthCalledWith(1, "/admin/apps/7/disable", { reason: "maintenance" });
    expect(client.post).toHaveBeenNthCalledWith(2, "/admin/apps/8/disable", { reason: null });
    expect(client.post).toHaveBeenNthCalledWith(3, "/admin/apps/9/enable");
  });
});
