import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminAppsPage from "./AdminAppsPage";
import { createMfeApiClient } from "../services/api-client";
import {
  createAdminApp,
  disableAdminApp,
  enableAdminApp,
  getAdminApp,
  listAdminApps,
  updateAdminApp
} from "../services/admin-apps-api";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn(() => ({}))
}));

vi.mock("../services/admin-apps-api", () => ({
  createAdminApp: vi.fn(),
  disableAdminApp: vi.fn(),
  enableAdminApp: vi.fn(),
  getAdminApp: vi.fn(),
  listAdminApps: vi.fn(),
  updateAdminApp: vi.fn()
}));

const adminApp = {
  id: 7,
  app_id: "orders-service",
  name: "订单服务",
  icon_url: null,
  access_url: "https://orders.example.test",
  service_account_name: "orders-service-account",
  is_enabled: true,
  disabled_at: null,
  disabled_reason: null,
  secret_updated_at: "2026-09-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  version: 3
};

beforeEach(() => {
  vi.mocked(listAdminApps).mockResolvedValue({ items: [adminApp], total: 1, page: 1, page_size: 20 });
  vi.mocked(getAdminApp).mockResolvedValue(adminApp);
  vi.mocked(createAdminApp).mockResolvedValue({ app: adminApp, app_secret: "initial-secret-for-test" });
  vi.mocked(updateAdminApp).mockResolvedValue({ ...adminApp, changed: true });
  vi.mocked(disableAdminApp).mockResolvedValue({ ...adminApp, is_enabled: false, changed: true });
  vi.mocked(enableAdminApp).mockResolvedValue({ ...adminApp, changed: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminAppsPage", () => {
  test("renders a paginated app table and applies a keyword filter", async () => {
    vi.mocked(listAdminApps).mockResolvedValue({ items: [adminApp], total: 21, page: 1, page_size: 20 });

    renderPage();

    expect(await screen.findByText("orders-service-account")).toBeInTheDocument();
    expect(screen.getByText("共 21 条")).toBeInTheDocument();
    expect(createMfeApiClient).toHaveBeenCalled();
    expect(listAdminApps).toHaveBeenCalledWith(expect.anything(), { page: 1, page_size: 20 });

    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() => expect(listAdminApps).toHaveBeenLastCalledWith(expect.anything(), { page: 2, page_size: 20 }));

    fireEvent.change(screen.getByPlaceholderText("应用名称 / 应用 ID"), { target: { value: "orders" } });
    fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
    await waitFor(() =>
      expect(listAdminApps).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 20,
        keyword: "orders"
      })
    );
  });

  test("shows the initial secret once after app creation and clears it on close", async () => {
    renderPage();
    await screen.findByText("orders-service-account");

    fireEvent.click(screen.getByRole("button", { name: /创建应用/ }));
    const createDialog = screen.getByRole("dialog", { name: "创建应用" });
    fireEvent.change(within(createDialog).getByLabelText("应用名称"), { target: { value: "报表服务" } });
    fireEvent.change(within(createDialog).getByLabelText("Service Account 名称"), {
      target: { value: "reports-service-account" }
    });
    fireEvent.change(within(createDialog).getByLabelText("Access URL"), {
      target: { value: "https://reports.example.test" }
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /创\s*建/ }));

    await waitFor(() =>
      expect(createAdminApp).toHaveBeenCalledWith(expect.anything(), {
        name: "报表服务",
        icon_url: null,
        access_url: "https://reports.example.test",
        service_account_name: "reports-service-account"
      })
    );
    const resultDialog = await screen.findByRole("dialog", { name: "应用创建成功" });
    expect(within(resultDialog).getByText("initial-secret-for-test")).toBeInTheDocument();
    expect(within(resultDialog).getByText("orders-service")).toBeInTheDocument();
    expect(screen.queryByText(/重新生成 Secret/)).not.toBeInTheDocument();

    fireEvent.click(within(resultDialog).getByRole("button", { name: "我已保存并关闭" }));
    await waitFor(() => expect(screen.queryByText("initial-secret-for-test")).not.toBeInTheDocument());
  });

  test("loads details and updates an app with the numeric record id and current version", async () => {
    renderPage();
    await screen.findByText("orders-service-account");

    fireEvent.click(screen.getByRole("button", { name: /详情/ }));
    const detailDialog = await screen.findByRole("dialog", { name: "应用详情" });
    expect(getAdminApp).toHaveBeenCalledWith(expect.anything(), 7);
    expect(await within(detailDialog).findByText("orders-service")).toBeInTheDocument();
    fireEvent.click(within(detailDialog).getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: /编辑/ }));
    const editDialog = await screen.findByRole("dialog", { name: "编辑应用" });
    const nameInput = within(editDialog).getByLabelText("应用名称");
    await waitFor(() => expect(nameInput).toHaveValue("订单服务"));
    fireEvent.change(nameInput, { target: { value: "订单中心" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: /确\s*认/ }));

    await waitFor(() =>
      expect(updateAdminApp).toHaveBeenCalledWith(expect.anything(), 7, {
        name: "订单中心",
        icon_url: null,
        access_url: "https://orders.example.test",
        service_account_name: "orders-service-account",
        version: 3
      })
    );
  });

  test("opens a reason form before disabling and keeps the queried switch state on failure", async () => {
    vi.mocked(disableAdminApp).mockRejectedValueOnce(new Error("disable failed"));
    renderPage();
    await screen.findByText("orders-service-account");

    const statusSwitch = screen.getByRole("switch");
    expect(statusSwitch).toBeChecked();
    fireEvent.click(statusSwitch);

    const disableDialog = await screen.findByRole("dialog", { name: "禁用应用" });
    expect(disableAdminApp).not.toHaveBeenCalled();
    fireEvent.change(within(disableDialog).getByPlaceholderText("可选"), { target: { value: "维护" } });
    fireEvent.click(within(disableDialog).getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(disableAdminApp).toHaveBeenCalledWith(expect.anything(), 7, "维护"));
    expect(statusSwitch).toBeChecked();
  });

  test("confirms enable without exposing secret regeneration", async () => {
    const disabledApp = {
      ...adminApp,
      is_enabled: false,
      disabled_at: "2026-09-10T00:00:00Z",
      disabled_reason: "维护"
    };
    vi.mocked(listAdminApps).mockResolvedValue({ items: [disabledApp], total: 1, page: 1, page_size: 20 });
    vi.mocked(enableAdminApp).mockResolvedValue({ ...disabledApp, is_enabled: true, changed: true });
    renderPage();
    await screen.findByText("orders-service-account");

    fireEvent.click(screen.getByRole("switch"));
    const confirmDialog = await screen.findByRole("dialog", { name: "启用应用" });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(enableAdminApp).toHaveBeenCalledWith(expect.anything(), 7));
    expect(screen.queryByText(/重新生成 Secret/)).not.toBeInTheDocument();
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminAppsPage />
      </AntApp>
    </QueryClientProvider>
  );
}
