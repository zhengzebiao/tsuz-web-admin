import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp } from "antd";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listAdminApps } from "../services/admin-apps-api";
import { listAdminResourceScopes } from "../services/admin-resource-scopes-api";
import {
  createAdminServiceGrant,
  listAdminServiceGrants,
  revokeAdminServiceGrant
} from "../services/admin-service-grants-api";
import { createMfeApiClient } from "../services/api-client";
import AdminServiceGrantsPage from "./AdminServiceGrantsPage";

vi.mock("../services/api-client", () => ({
  createMfeApiClient: vi.fn(() => ({}))
}));

vi.mock("../services/admin-apps-api", () => ({
  listAdminApps: vi.fn()
}));

vi.mock("../services/admin-resource-scopes-api", () => ({
  listAdminResourceScopes: vi.fn()
}));

vi.mock("../services/admin-service-grants-api", () => ({
  createAdminServiceGrant: vi.fn(),
  listAdminServiceGrants: vi.fn(),
  revokeAdminServiceGrant: vi.fn()
}));

const callerApp = {
  id: 3,
  app_id: "caller-service",
  name: "调用服务",
  icon_url: null,
  access_url: "https://caller.example.test",
  service_account_name: "caller-account",
  is_enabled: true,
  disabled_at: null,
  disabled_reason: null,
  secret_updated_at: "2026-09-01T00:00:00Z",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  version: 1
};

const targetApp = {
  ...callerApp,
  id: 4,
  app_id: "orders-service",
  name: "订单服务",
  access_url: "https://orders.example.test",
  service_account_name: "orders-account"
};

const reportsApp = {
  ...targetApp,
  id: 5,
  app_id: "reports-service",
  name: "报表服务"
};

const scope = {
  id: 7,
  target_app_id: "orders-service",
  scope_code: "orders:record:read",
  description: "读取订单",
  is_enabled: true,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z"
};

const grant = {
  id: 9,
  caller_app_id: "caller-service",
  scope_id: 7,
  target_app_id: "orders-service",
  scope_code: "orders:record:read",
  status: "enabled" as const,
  valid_from: "2026-09-16T02:00:00",
  expires_at: "2026-09-18T02:00:00",
  created_by: 1,
  created_at: "2026-09-16T02:00:00",
  revoked_by: null,
  revoked_at: null,
  revoke_reason: null
};

beforeEach(() => {
  vi.mocked(listAdminApps).mockResolvedValue({
    items: [callerApp, targetApp, reportsApp],
    total: 3,
    page: 1,
    page_size: 100
  });
  vi.mocked(listAdminResourceScopes).mockResolvedValue({ items: [scope], total: 1, page: 1, page_size: 100 });
  vi.mocked(listAdminServiceGrants).mockResolvedValue({ items: [grant], total: 1, page: 1, page_size: 20 });
  vi.mocked(createAdminServiceGrant).mockResolvedValue({ ...grant, changed: true });
  vi.mocked(revokeAdminServiceGrant).mockResolvedValue({
    ...grant,
    status: "revoked",
    revoked_by: 1,
    revoked_at: "2026-09-17T02:00:00",
    revoke_reason: "retired",
    changed: true
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminServiceGrantsPage", () => {
  test("renders a paginated table and applies caller, target, and status filters", async () => {
    vi.mocked(listAdminServiceGrants).mockResolvedValue({ items: [grant], total: 21, page: 1, page_size: 20 });
    renderPage();

    expect(await screen.findByText("orders:record:read")).toBeInTheDocument();
    expect(screen.getByText("共 21 条")).toBeInTheDocument();
    expect(listAdminServiceGrants).toHaveBeenCalledWith(expect.anything(), { page: 1, page_size: 20 });

    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(listAdminServiceGrants).toHaveBeenLastCalledWith(expect.anything(), { page: 2, page_size: 20 })
    );

    await selectApp(screen.getByRole("combobox", { name: "调用应用筛选" }), "调用服务（caller-service）");
    await selectApp(screen.getByRole("combobox", { name: "目标应用筛选" }), "订单服务（orders-service）");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "服务端状态" }));
    fireEvent.click(screen.getByText("已撤销"));
    fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));

    await waitFor(() =>
      expect(listAdminServiceGrants).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 20,
        caller_app_id: "caller-service",
        target_app_id: "orders-service",
        status: "revoked"
      })
    );
  });

  test("retries a failed grants list", async () => {
    vi.mocked(listAdminServiceGrants).mockRejectedValueOnce(new Error("grants failed"));
    renderPage();

    expect(await screen.findByText("服务授权列表加载失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("orders:record:read")).toBeInTheDocument();
    expect(listAdminServiceGrants).toHaveBeenCalledTimes(2);
  });

  test("keeps the page usable when an invalid list payload is returned", async () => {
    vi.mocked(listAdminServiceGrants).mockResolvedValue({} as never);
    renderPage();

    expect(await screen.findByText("暂无服务授权")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /创建服务授权/ })).toBeEnabled();
  });

  test("loads enabled scopes for the selected target and clears a previous scope", async () => {
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    await waitFor(() =>
      expect(listAdminResourceScopes).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 100,
        target_app_id: "orders-service",
        is_enabled: true
      })
    );

    await selectOption(within(dialog).getByRole("combobox", { name: "资源范围" }), "orders:record:read（ID: 7）");
    expect(within(dialog).getByTitle("orders:record:read（ID: 7）")).toBeInTheDocument();

    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "报表服务（reports-service）");
    await waitFor(() =>
      expect(listAdminResourceScopes).toHaveBeenLastCalledWith(expect.anything(), {
        page: 1,
        page_size: 100,
        target_app_id: "reports-service",
        is_enabled: true
      })
    );
    expect(within(dialog).queryByTitle("orders:record:read（ID: 7）")).not.toBeInTheDocument();
  });

  test("creates a grant with caller and scope only", async () => {
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    await selectApp(within(dialog).getByRole("combobox", { name: "调用应用" }), "调用服务（caller-service）");
    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    await selectOption(within(dialog).getByRole("combobox", { name: "资源范围" }), "orders:record:read（ID: 7）");
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    await waitFor(() =>
      expect(createAdminServiceGrant).toHaveBeenCalledWith(expect.anything(), {
        caller_app_id: "caller-service",
        scope_id: 7
      })
    );
  });

  test("converts selected instants to timezone-naive UTC strings", async () => {
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    await selectApp(within(dialog).getByRole("combobox", { name: "调用应用" }), "调用服务（caller-service）");
    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    await selectOption(within(dialog).getByRole("combobox", { name: "资源范围" }), "orders:record:read（ID: 7）");

    enterDate(within(dialog).getByPlaceholderText("请选择生效时间"), "2030-01-01 10:00:00");
    enterDate(within(dialog).getByPlaceholderText("请选择到期时间"), "2030-01-02 10:00:00");
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    const expectedValidFrom = new Date(2030, 0, 1, 10, 0, 0).toISOString().replace(/Z$/, "");
    const expectedExpiresAt = new Date(2030, 0, 2, 10, 0, 0).toISOString().replace(/Z$/, "");
    await waitFor(() =>
      expect(createAdminServiceGrant).toHaveBeenCalledWith(expect.anything(), {
        caller_app_id: "caller-service",
        scope_id: 7,
        valid_from: expectedValidFrom,
        expires_at: expectedExpiresAt
      })
    );
  });

  test("validates expiration order before creating", async () => {
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    enterDate(within(dialog).getByPlaceholderText("请选择生效时间"), "2030-01-02 10:00:00");
    enterDate(within(dialog).getByPlaceholderText("请选择到期时间"), "2030-01-01 10:00:00");
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    expect(await screen.findByText("到期时间必须晚于生效时间")).toBeInTheDocument();
    expect(createAdminServiceGrant).not.toHaveBeenCalled();
  });

  test("keeps the create form open when creation fails", async () => {
    vi.mocked(createAdminServiceGrant).mockRejectedValueOnce(new Error("create failed"));
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    await selectApp(within(dialog).getByRole("combobox", { name: "调用应用" }), "调用服务（caller-service）");
    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    await selectOption(within(dialog).getByRole("combobox", { name: "资源范围" }), "orders:record:read（ID: 7）");
    fireEvent.click(within(dialog).getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => expect(createAdminServiceGrant).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "创建服务授权" })).toBeInTheDocument();
    expect(within(dialog).getByTitle("调用服务（caller-service）")).toBeInTheDocument();
  });

  test("shows dependency limits and retries failed scopes", async () => {
    vi.mocked(listAdminApps).mockResolvedValue({
      items: [callerApp, targetApp, reportsApp],
      total: 101,
      page: 1,
      page_size: 100
    });
    vi.mocked(listAdminResourceScopes).mockResolvedValue({ items: [scope], total: 101, page: 1, page_size: 100 });
    renderPage();
    await screen.findByText("orders:record:read");
    const dialog = await openCreateDialog();

    expect(await screen.findAllByText("应用结果超过 100 条，当前列表不完整，请输入关键词缩小范围。")).not.toHaveLength(
      0
    );
    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    expect(
      await screen.findByText("启用的资源范围超过 100 条，当前列表不完整；接口暂不支持搜索，请联系后端扩展查询能力。")
    ).toBeInTheDocument();

    vi.mocked(listAdminResourceScopes).mockRejectedValueOnce(new Error("scopes failed"));
    await selectApp(within(dialog).getByRole("combobox", { name: "目标应用" }), "报表服务（reports-service）");
    expect(await screen.findByText("资源范围选项加载失败")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(listAdminResourceScopes).toHaveBeenCalledTimes(3));
  });

  test("revokes an enabled grant with a normalized reason", async () => {
    renderPage();
    await screen.findByText("orders:record:read");

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const dialog = await screen.findByRole("dialog", { name: "撤销服务授权" });
    fireEvent.change(within(dialog).getByPlaceholderText("可选"), { target: { value: "  retired  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: /确认撤销/ }));

    await waitFor(() => expect(revokeAdminServiceGrant).toHaveBeenCalledWith(expect.anything(), 9, "  retired  "));
  });

  test("reports idempotent create and revoke responses", async () => {
    vi.mocked(createAdminServiceGrant).mockResolvedValueOnce({ ...grant, changed: false });
    vi.mocked(revokeAdminServiceGrant).mockResolvedValueOnce({ ...grant, changed: false });
    renderPage();
    await screen.findByText("orders:record:read");

    const createDialog = await openCreateDialog();
    await selectApp(within(createDialog).getByRole("combobox", { name: "调用应用" }), "调用服务（caller-service）");
    await selectApp(within(createDialog).getByRole("combobox", { name: "目标应用" }), "订单服务（orders-service）");
    await selectOption(within(createDialog).getByRole("combobox", { name: "资源范围" }), "orders:record:read（ID: 7）");
    fireEvent.click(within(createDialog).getByRole("button", { name: /创\s*建/ }));
    expect(await screen.findByText("操作未发生变化")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const revokeDialog = await screen.findByRole("dialog", { name: "撤销服务授权" });
    fireEvent.click(within(revokeDialog).getByRole("button", { name: /确认撤销/ }));
    await waitFor(() => expect(screen.getAllByText("操作未发生变化")).not.toHaveLength(0));
  });

  test("keeps revoke state and form open when revocation fails", async () => {
    vi.mocked(revokeAdminServiceGrant).mockRejectedValueOnce(new Error("revoke failed"));
    renderPage();
    await screen.findByText("orders:record:read");

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    const dialog = await screen.findByRole("dialog", { name: "撤销服务授权" });
    fireEvent.change(within(dialog).getByPlaceholderText("可选"), { target: { value: "retired" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /确认撤销/ }));

    await waitFor(() => expect(revokeAdminServiceGrant).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "撤销服务授权" })).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("可选")).toHaveValue("retired");
    expect(screen.getByText("已启用")).toBeInTheDocument();
  });

  test("keeps revoked rows read-only", async () => {
    vi.mocked(listAdminServiceGrants).mockResolvedValue({
      items: [
        {
          ...grant,
          status: "revoked",
          revoked_by: 1,
          revoked_at: "2026-09-17T02:00:00",
          revoke_reason: "retired"
        }
      ],
      total: 1,
      page: 1,
      page_size: 20
    });
    renderPage();

    expect(await screen.findByText("只读")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "撤销" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /恢复|编辑|删除/ })).not.toBeInTheDocument();
  });
});

async function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: /创建服务授权/ }));
  return screen.findByRole("dialog", { name: "创建服务授权" });
}

async function selectApp(combobox: HTMLElement, optionText: string) {
  await selectOption(combobox, optionText);
}

async function selectOption(combobox: HTMLElement, optionText: string) {
  fireEvent.mouseDown(combobox);
  const options = await screen.findAllByText(optionText);
  fireEvent.click(options.at(-1)!);
}

function enterDate(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <AdminServiceGrantsPage />
      </AntApp>
    </QueryClientProvider>
  );
}
