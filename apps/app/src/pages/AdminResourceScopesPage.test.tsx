import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AdminResourceScopesPage from "./AdminResourceScopesPage";
import { createMfeApiClient } from "../services/api-client";
import { listAdminApps } from "../services/admin-apps-api";
import {
  createAdminResourceScope,
  disableAdminResourceScope,
  enableAdminResourceScope,
  listAdminResourceScopes
} from "../services/admin-resource-scopes-api";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn(() => ({}))
}));

vi.mock("../services/admin-apps-api", () => ({
  listAdminApps: vi.fn()
}));

vi.mock("../services/admin-resource-scopes-api", () => ({
  createAdminResourceScope: vi.fn(),
  disableAdminResourceScope: vi.fn(),
  enableAdminResourceScope: vi.fn(),
  listAdminResourceScopes: vi.fn()
}));

const app = {
  id: 4,
  app_id: "orders-service",
  name: "订单服务",
  icon_url: null,
  access_url: "https://orders.example.test",
  service_account_name: "orders-account",
  is_enabled: true,
  disabled_at: null,
  disabled_reason: null,
  secret_updated_at: "2026-09-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  version: 1
};

const scope = {
  id: 7,
  target_app_id: "orders-service",
  scope_code: "orders.read",
  description: "读取订单",
  is_enabled: true,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z"
};

beforeEach(() => {
  vi.mocked(listAdminResourceScopes).mockResolvedValue({ items: [scope], total: 1, page: 1, page_size: 20 });
  vi.mocked(listAdminApps).mockResolvedValue({ items: [app], total: 1, page: 1, page_size: 100 });
  vi.mocked(createAdminResourceScope).mockResolvedValue(scope);
  vi.mocked(disableAdminResourceScope).mockResolvedValue({ ...scope, is_enabled: false, changed: true });
  vi.mocked(enableAdminResourceScope).mockResolvedValue({ ...scope, changed: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminResourceScopesPage", () => {
  test("renders a paginated table and sends selected app and status filters", async () => {
    vi.mocked(listAdminResourceScopes).mockResolvedValue({ items: [scope], total: 21, page: 1, page_size: 20 });
    renderPage();

    expect(await screen.findByText("orders.read")).toBeInTheDocument();
    expect(screen.getByText("共 21 条")).toBeInTheDocument();
    expect(listAdminResourceScopes).toHaveBeenCalledWith(expect.anything(), { page: 1, page_size: 20 });

    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(listAdminResourceScopes).toHaveBeenLastCalledWith(expect.anything(), { page: 2, page_size: 20 })
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "目标应用筛选" }));
    expect(await screen.findByText("订单服务（orders-service）")).toBeInTheDocument();
    fireEvent.click(screen.getByText("订单服务（orders-service）"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "启用状态" }));
    fireEvent.click(screen.getByText("已禁用"));
    fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));

    await waitFor(() =>
      expect(listAdminResourceScopes).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 20,
        target_app_id: "orders-service",
        is_enabled: false
      })
    );
  });

  test("creates a scope with the business app id and normalized text", async () => {
    renderPage();
    await screen.findByText("orders.read");

    fireEvent.click(screen.getByRole("button", { name: /创建资源范围/ }));
    const dialog = await screen.findByRole("dialog", { name: "创建资源范围" });
    fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: "目标应用" }));
    fireEvent.click(await screen.findByText("订单服务（orders-service）"));
    fireEvent.change(within(dialog).getByPlaceholderText("如 orders.read"), { target: { value: "  orders.write  " } });
    fireEvent.change(within(dialog).getByPlaceholderText("可选"), { target: { value: "  写入订单  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    await waitFor(() =>
      expect(createAdminResourceScope).toHaveBeenCalledWith(expect.anything(), {
        target_app_id: "orders-service",
        scope_code: "orders.write",
        description: "写入订单"
      })
    );
  });

  test("confirms disable and keeps the queried state when the action fails", async () => {
    vi.mocked(disableAdminResourceScope).mockRejectedValueOnce(new Error("disable failed"));
    renderPage();
    await screen.findByText("orders.read");

    const statusSwitch = screen.getByRole("switch");
    expect(statusSwitch).toBeChecked();
    fireEvent.click(statusSwitch);
    const dialog = await screen.findByRole("dialog", { name: "禁用资源范围" });
    fireEvent.click(within(dialog).getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(disableAdminResourceScope).toHaveBeenCalledWith(expect.anything(), 7));
    expect(statusSwitch).toBeChecked();
  });

  test("confirms enable and accepts an idempotent response", async () => {
    const disabledScope = { ...scope, is_enabled: false };
    vi.mocked(listAdminResourceScopes).mockResolvedValue({ items: [disabledScope], total: 1, page: 1, page_size: 20 });
    vi.mocked(enableAdminResourceScope).mockResolvedValue({ ...disabledScope, changed: false });
    renderPage();
    await screen.findByText("orders.read");

    fireEvent.click(screen.getByRole("switch"));
    const dialog = await screen.findByRole("dialog", { name: "启用资源范围" });
    fireEvent.click(within(dialog).getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(enableAdminResourceScope).toHaveBeenCalledWith(expect.anything(), 7));
    expect(screen.getByText("操作未发生变化")).toBeInTheDocument();
  });

  test("keeps the create form open when creation fails", async () => {
    vi.mocked(createAdminResourceScope).mockRejectedValueOnce(new Error("create failed"));
    renderPage();
    await screen.findByText("orders.read");

    fireEvent.click(screen.getByRole("button", { name: /创建资源范围/ }));
    const dialog = await screen.findByRole("dialog", { name: "创建资源范围" });
    fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: "目标应用" }));
    fireEvent.click(await screen.findByText("订单服务（orders-service）"));
    fireEvent.change(within(dialog).getByPlaceholderText("如 orders.read"), { target: { value: "orders.write" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => expect(createAdminResourceScope).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "创建资源范围" })).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("如 orders.read")).toHaveValue("orders.write");
  });

  test("shows an incomplete app result warning and retries failed options", async () => {
    vi.mocked(listAdminApps).mockResolvedValue({ items: [app], total: 101, page: 1, page_size: 100 });
    renderPage();
    await screen.findByText("orders.read");

    expect(await screen.findAllByText("应用结果超过 100 条，当前列表不完整，请输入关键词缩小范围。")).toHaveLength(1);

    vi.mocked(listAdminApps).mockRejectedValueOnce(new Error("apps failed"));
    fireEvent.change(screen.getByRole("combobox", { name: "目标应用筛选" }), { target: { value: "reports" } });
    await waitFor(() => expect(screen.getByText("应用选项加载失败")).toBeInTheDocument(), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(listAdminApps).toHaveBeenCalledTimes(3));
  });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminResourceScopesPage />
      </AntApp>
    </QueryClientProvider>
  );
}
