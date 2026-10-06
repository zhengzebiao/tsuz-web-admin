import { SearchOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Typography
} from "antd";
import type { SelectProps } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { listAdminApps, type AdminApp } from "../services/admin-apps-api";
import {
  createAdminResourceScope,
  disableAdminResourceScope,
  enableAdminResourceScope,
  listAdminResourceScopes,
  type AdminResourceScope,
  type AdminResourceScopeCreate,
  type AdminResourceScopeListParams
} from "../services/admin-resource-scopes-api";
import { createMfeApiClient } from "../services/api-client";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
const APP_OPTION_PAGE_SIZE = 100;
const scopesQueryKey = ["admin-resource-scopes"];

type Filters = Omit<AdminResourceScopeListParams, "page" | "page_size">;

export default function AdminResourceScopesPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const apiClient = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionScopeId, setActionScopeId] = useState<number>();
  const cardRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(240);

  useEffect(() => {
    const updateTableScrollY = () => {
      const card = cardRef.current;
      const filters = filtersRef.current;
      if (!card || !filters) return;
      setTableScrollY(Math.max(240, card.clientHeight - filters.offsetHeight - 160));
    };
    updateTableScrollY();
    const observer = new ResizeObserver(updateTableScrollY);
    if (cardRef.current) observer.observe(cardRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    return () => observer.disconnect();
  }, []);

  const scopesQuery = useQuery({
    queryKey: [...scopesQueryKey, page, filters],
    queryFn: () => listAdminResourceScopes(apiClient, { page, page_size: PAGE_SIZE, ...filters })
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: scopesQueryKey });

  const runStatusAction = async (
    scope: AdminResourceScope,
    action: () => Promise<{ changed: boolean }>,
    successMessage: string
  ) => {
    setActionScopeId(scope.id);
    try {
      const result = await action();
      message.success(result.changed === false ? "操作未发生变化" : successMessage);
      await refresh();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setActionScopeId(undefined);
    }
  };

  const confirmStatusChange = (scope: AdminResourceScope, enable: boolean) => {
    modal.confirm({
      title: enable ? "启用资源范围" : "禁用资源范围",
      content: `确认${enable ? "启用" : "禁用"}“${scope.scope_code}”（${scope.target_app_id}）？`,
      okText: "确认",
      cancelText: "取消",
      okButtonProps: enable ? undefined : { danger: true },
      onOk: () =>
        runStatusAction(
          scope,
          () =>
            enable ? enableAdminResourceScope(apiClient, scope.id) : disableAdminResourceScope(apiClient, scope.id),
          enable ? "资源范围已启用" : "资源范围已禁用"
        )
    });
  };

  const columns: ColumnsType<AdminResourceScope> = [
    { title: "记录 ID", dataIndex: "id", width: 90 },
    {
      title: "目标应用 ID",
      dataIndex: "target_app_id",
      width: 220,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>
    },
    {
      title: "Scope Code",
      dataIndex: "scope_code",
      width: 240,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>
    },
    {
      title: "描述",
      dataIndex: "description",
      ellipsis: true,
      render: (value: string) => value || "-"
    },
    {
      title: "启用状态",
      dataIndex: "is_enabled",
      width: 120,
      render: (enabled: boolean, scope) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          loading={actionScopeId === scope.id}
          disabled={actionScopeId !== undefined}
          aria-label={`${scope.scope_code}启用状态`}
          onChange={(checked) => confirmStatusChange(scope, checked)}
        />
      )
    },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    { title: "更新时间", dataIndex: "updated_at", width: 180, render: formatDate }
  ];

  const applyFilters = () => {
    setPage(1);
    setFilters(cleanFilters(draftFilters));
  };

  return (
    <PageContainer
      className="admin-list-page"
      title="资源范围管理"
      description="管理目标服务对外开放的访问范围"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建资源范围
        </Button>
      }
    >
      <Card ref={cardRef} className="admin-users-card">
        <Flex ref={filtersRef} className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="目标应用" className="admin-users-keyword">
            <AdminAppSelect
              client={apiClient}
              value={draftFilters.target_app_id}
              aria-label="目标应用筛选"
              placeholder="搜索并选择应用"
              allowClear
              onChange={(value) => setDraftFilters({ ...draftFilters, target_app_id: value })}
            />
          </Form.Item>
          <Form.Item label="启用状态">
            <Select
              aria-label="启用状态"
              value={toSelectValue(draftFilters.is_enabled)}
              options={[
                { value: "", label: "全部" },
                { value: "true", label: "已启用" },
                { value: "false", label: "已禁用" }
              ]}
              onChange={(value) => setDraftFilters({ ...draftFilters, is_enabled: fromSelectValue(value) })}
            />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={applyFilters}>
              查询
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setDraftFilters({});
                setFilters({});
                setPage(1);
              }}
            >
              重置
            </Button>
          </Space>
        </Flex>
        <Table
          rowKey="id"
          loading={scopesQuery.isLoading}
          dataSource={scopesQuery.data?.items || []}
          columns={columns}
          scroll={{ x: 1230, y: tableScrollY }}
          onChange={(pagination: TablePaginationConfig) => setPage(pagination.current || 1)}
          locale={{
            emptyText: scopesQuery.isError ? (
              <Space direction="vertical">
                <span>资源范围列表加载失败</span>
                <Button onClick={() => scopesQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无资源范围"
            )
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: scopesQuery.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
            className: "admin-resource-scopes-pagination"
          }}
        />
      </Card>
      {createOpen ? (
        <CreateResourceScopeModal
          client={apiClient}
          onCancel={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            message.success("资源范围创建成功");
            void refresh().catch(() => undefined);
          }}
        />
      ) : null}
    </PageContainer>
  );
}

function CreateResourceScopeModal({
  client,
  onCancel,
  onCreated
}: {
  client: ReturnType<typeof createMfeApiClient>;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form] = Form.useForm<AdminResourceScopeCreate>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const createScope = async (values: AdminResourceScopeCreate) => {
    setLoading(true);
    try {
      await createAdminResourceScope(client, normalizeScopeValues(values));
      onCreated();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      title="创建资源范围"
      okText="创建"
      cancelText="取消"
      confirmLoading={loading}
      maskClosable={!loading}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={createScope}>
        <Form.Item name="target_app_id" label="目标应用" rules={[{ required: true, message: "请选择目标应用" }]}>
          <AdminAppSelect client={client} aria-label="目标应用" placeholder="搜索并选择应用" />
        </Form.Item>
        <Form.Item
          name="scope_code"
          label="Scope Code"
          rules={[
            { required: true, whitespace: true, message: "请输入 Scope Code" },
            { min: 1, max: 128, message: "请输入 1–128 个字符" }
          ]}
        >
          <Input maxLength={128} placeholder="如 orders.read" />
        </Form.Item>
        <Form.Item name="description" label="描述" rules={[{ max: 255, message: "最多 255 个字符" }]}>
          <Input.TextArea rows={4} maxLength={255} showCount placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface AdminAppSelectProps extends Pick<SelectProps<string>, "allowClear" | "onChange" | "placeholder" | "value"> {
  client: ReturnType<typeof createMfeApiClient>;
  "aria-label": string;
}

function AdminAppSelect({ client, value, onChange, ...selectProps }: AdminAppSelectProps) {
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<AdminApp>();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const normalizedSearch = search.trim();
  const appsQuery = useQuery({
    queryKey: ["admin-apps", "resource-scope-options", normalizedSearch],
    queryFn: () =>
      listAdminApps(client, {
        page: 1,
        page_size: APP_OPTION_PAGE_SIZE,
        keyword: normalizedSearch || undefined
      })
  });

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  useEffect(() => {
    const match = appsQuery.data?.items?.find((app) => app.app_id === value);
    if (match) setSelectedApp(match);
    if (!value) setSelectedApp(undefined);
  }, [appsQuery.data, value]);

  const apps = mergeAppOptions(appsQuery.data?.items || [], selectedApp);
  const incomplete = (appsQuery.data?.total || 0) > (appsQuery.data?.items?.length || 0);
  const options = apps.map((app) => ({
    value: app.app_id,
    label: `${app.name}（${app.app_id}）${app.is_enabled ? "" : " · 已禁用"}`
  }));

  const scheduleSearch = (nextSearch: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(nextSearch), 250);
  };

  return (
    <Space direction="vertical" size={4} className="full-width">
      <Select<string>
        {...selectProps}
        value={value}
        aria-label={selectProps["aria-label"]}
        showSearch
        filterOption={false}
        optionFilterProp="label"
        suffixIcon={<SearchOutlined />}
        loading={appsQuery.isLoading || appsQuery.isFetching}
        options={options}
        onSearch={scheduleSearch}
        onChange={(nextValue, option) => {
          setSelectedApp(apps.find((app) => app.app_id === nextValue));
          onChange?.(nextValue, option);
        }}
        notFoundContent={
          appsQuery.isLoading ? (
            <Spin size="small" />
          ) : appsQuery.isError ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="应用加载失败" />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到应用" />
          )
        }
      />
      {appsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="应用选项加载失败"
          action={
            <Button type="link" size="small" onClick={() => appsQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : null}
      {incomplete ? (
        <Alert type="info" showIcon message="应用结果超过 100 条，当前列表不完整，请输入关键词缩小范围。" />
      ) : null}
    </Space>
  );
}

function mergeAppOptions(apps: AdminApp[], selectedApp?: AdminApp) {
  if (!selectedApp || apps.some((app) => app.app_id === selectedApp.app_id)) return apps;
  return [selectedApp, ...apps];
}

function normalizeScopeValues(values: AdminResourceScopeCreate): AdminResourceScopeCreate {
  return {
    target_app_id: values.target_app_id,
    scope_code: values.scope_code.trim(),
    description: values.description?.trim() || ""
  };
}

function cleanFilters(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Filters;
}

function toSelectValue(value?: boolean) {
  return value === undefined ? "" : String(value);
}

function fromSelectValue(value: string): boolean | undefined {
  return value === "" ? undefined : value === "true";
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
