import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@tsuz/ui";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography
} from "antd";
import type { SelectProps } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { listAdminApps, type AdminApp } from "../services/admin-apps-api";
import { listAdminResourceScopes, type AdminResourceScope } from "../services/admin-resource-scopes-api";
import {
  createAdminServiceGrant,
  listAdminServiceGrants,
  revokeAdminServiceGrant,
  type AdminServiceGrant,
  type AdminServiceGrantCreate,
  type AdminServiceGrantListParams,
  type AdminServiceGrantStatus
} from "../services/admin-service-grants-api";
import { createMfeApiClient } from "../services/api-client";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
const OPTION_PAGE_SIZE = 100;
const grantsQueryKey = ["admin-service-grants"];

type ApiClient = ReturnType<typeof createMfeApiClient>;
type Filters = Omit<AdminServiceGrantListParams, "page" | "page_size">;
type CreateGrantFormValues = {
  caller_app_id: string;
  target_app_id: string;
  scope_id: number;
  valid_from?: unknown;
  expires_at?: unknown;
};

export default function AdminServiceGrantsPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const apiClient = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeGrant, setRevokeGrant] = useState<AdminServiceGrant>();
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

  const grantsQuery = useQuery({
    queryKey: [...grantsQueryKey, page, filters],
    queryFn: () => listAdminServiceGrants(apiClient, { page, page_size: PAGE_SIZE, ...filters })
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: grantsQueryKey });
  const grantItems = Array.isArray(grantsQuery.data?.items) ? grantsQuery.data.items : [];
  const grantTotal = typeof grantsQuery.data?.total === "number" ? grantsQuery.data.total : 0;
  const columns: ColumnsType<AdminServiceGrant> = [
    { title: "记录 ID", dataIndex: "id", width: 90 },
    {
      title: "调用应用 ID",
      dataIndex: "caller_app_id",
      width: 210,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>
    },
    {
      title: "目标应用 ID",
      dataIndex: "target_app_id",
      width: 210,
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>
    },
    {
      title: "Scope",
      key: "scope",
      width: 230,
      render: (_, grant) => (
        <div>
          <Typography.Text strong>{grant.scope_code}</Typography.Text>
          <br />
          <Typography.Text type="secondary">ID: {grant.scope_id}</Typography.Text>
        </div>
      )
    },
    {
      title: "服务端状态",
      dataIndex: "status",
      width: 120,
      render: (status: AdminServiceGrantStatus) => (
        <Tag color={status === "enabled" ? "success" : "default"}>{status === "enabled" ? "已启用" : "已撤销"}</Tag>
      )
    },
    { title: "生效时间", dataIndex: "valid_from", width: 180, render: formatServerDate },
    { title: "到期时间", dataIndex: "expires_at", width: 180, render: formatServerDate },
    { title: "创建人 ID", dataIndex: "created_by", width: 110 },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatServerDate },
    { title: "撤销人 ID", dataIndex: "revoked_by", width: 110, render: renderOptionalValue },
    { title: "撤销时间", dataIndex: "revoked_at", width: 180, render: formatServerDate },
    {
      title: "撤销原因",
      dataIndex: "revoke_reason",
      width: 200,
      ellipsis: true,
      render: renderOptionalValue
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, grant) =>
        grant.status === "enabled" ? (
          <Button type="link" danger size="small" onClick={() => setRevokeGrant(grant)}>
            撤销
          </Button>
        ) : (
          <Typography.Text type="secondary">只读</Typography.Text>
        )
    }
  ];

  const applyFilters = () => {
    setPage(1);
    setFilters(cleanFilters(draftFilters));
  };

  return (
    <PageContainer
      className="admin-list-page"
      title="服务授权管理"
      description="管理应用调用目标服务资源范围的授权关系"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          创建服务授权
        </Button>
      }
    >
      <Card ref={cardRef} className="admin-users-card">
        <Flex ref={filtersRef} className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="调用应用" className="admin-users-keyword">
            <AdminAppSelect
              client={apiClient}
              queryScope="filter-caller"
              value={draftFilters.caller_app_id}
              aria-label="调用应用筛选"
              placeholder="搜索并选择调用应用"
              allowClear
              onChange={(value) => setDraftFilters({ ...draftFilters, caller_app_id: value })}
            />
          </Form.Item>
          <Form.Item label="目标应用" className="admin-users-keyword">
            <AdminAppSelect
              client={apiClient}
              queryScope="filter-target"
              value={draftFilters.target_app_id}
              aria-label="目标应用筛选"
              placeholder="搜索并选择目标应用"
              allowClear
              onChange={(value) => setDraftFilters({ ...draftFilters, target_app_id: value })}
            />
          </Form.Item>
          <Form.Item label="服务端状态">
            <Select<AdminServiceGrantStatus | "">
              aria-label="服务端状态"
              value={draftFilters.status || ""}
              options={[
                { value: "", label: "全部" },
                { value: "enabled", label: "已启用" },
                { value: "revoked", label: "已撤销" }
              ]}
              onChange={(value) =>
                setDraftFilters({ ...draftFilters, status: value ? (value as AdminServiceGrantStatus) : undefined })
              }
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
          loading={grantsQuery.isLoading}
          dataSource={grantItems}
          columns={columns}
          scroll={{ x: 2100, y: tableScrollY }}
          onChange={(pagination: TablePaginationConfig) => setPage(pagination.current || 1)}
          locale={{
            emptyText: grantsQuery.isError ? (
              <Space direction="vertical">
                <span>服务授权列表加载失败</span>
                <Button onClick={() => grantsQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无服务授权"
            )
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: grantTotal,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
            className: "admin-service-grants-pagination"
          }}
        />
      </Card>
      {createOpen ? (
        <CreateServiceGrantModal
          client={apiClient}
          onCancel={() => setCreateOpen(false)}
          onCreated={(changed) => {
            setCreateOpen(false);
            message.success(changed === false ? "操作未发生变化" : "服务授权创建成功");
            void refresh().catch(() => undefined);
          }}
        />
      ) : null}
      {revokeGrant ? (
        <RevokeServiceGrantModal
          client={apiClient}
          grant={revokeGrant}
          onCancel={() => setRevokeGrant(undefined)}
          onRevoked={(changed) => {
            setRevokeGrant(undefined);
            message.success(changed === false ? "操作未发生变化" : "服务授权已撤销");
            void refresh().catch(() => undefined);
          }}
        />
      ) : null}
    </PageContainer>
  );
}

function CreateServiceGrantModal({
  client,
  onCancel,
  onCreated
}: {
  client: ApiClient;
  onCancel: () => void;
  onCreated: (changed: boolean) => void;
}) {
  const [form] = Form.useForm<CreateGrantFormValues>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const targetAppId = Form.useWatch("target_app_id", form);

  useEffect(() => {
    form.setFieldValue("scope_id", undefined);
  }, [form, targetAppId]);

  const createGrant = async (values: CreateGrantFormValues) => {
    setLoading(true);
    try {
      const result = await createAdminServiceGrant(client, normalizeCreateValues(values));
      onCreated(result.changed);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      title="创建服务授权"
      okText="创建"
      cancelText="取消"
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      onCancel={onCancel}
      onOk={() => form.submit()}
      width={620}
    >
      <Form form={form} layout="vertical" onFinish={createGrant}>
        <Form.Item name="caller_app_id" label="调用应用" rules={[{ required: true, message: "请选择调用应用" }]}>
          <AdminAppSelect
            client={client}
            queryScope="create-caller"
            aria-label="调用应用"
            placeholder="搜索并选择调用应用"
          />
        </Form.Item>
        <Form.Item name="target_app_id" label="目标应用" rules={[{ required: true, message: "请选择目标应用" }]}>
          <AdminAppSelect
            client={client}
            queryScope="create-target"
            aria-label="目标应用"
            placeholder="搜索并选择目标应用"
          />
        </Form.Item>
        <Form.Item name="scope_id" label="资源范围" rules={[{ required: true, message: "请选择资源范围" }]}>
          <AdminScopeSelect client={client} targetAppId={targetAppId} aria-label="资源范围" />
        </Form.Item>
        <Form.Item name="valid_from" label="生效时间">
          <DatePicker className="full-width" showTime format="YYYY-MM-DD HH:mm:ss" placeholder="请选择生效时间" />
        </Form.Item>
        <Form.Item
          name="expires_at"
          label="到期时间"
          dependencies={["valid_from"]}
          rules={[
            {
              validator: (_, value) => validateExpiration(value, form.getFieldValue("valid_from"))
            }
          ]}
        >
          <DatePicker className="full-width" showTime format="YYYY-MM-DD HH:mm:ss" placeholder="请选择到期时间" />
        </Form.Item>
        <Alert type="info" showIcon message="时间按本地时区输入，提交时转换为 UTC；留空生效时间则由服务端决定。" />
      </Form>
    </Modal>
  );
}

function RevokeServiceGrantModal({
  client,
  grant,
  onCancel,
  onRevoked
}: {
  client: ApiClient;
  grant: AdminServiceGrant;
  onCancel: () => void;
  onRevoked: (changed: boolean) => void;
}) {
  const [form] = Form.useForm<{ reason?: string }>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const revokeGrant = async (values: { reason?: string }) => {
    setLoading(true);
    try {
      const result = await revokeAdminServiceGrant(client, grant.id, values.reason);
      onRevoked(result.changed);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      title="撤销服务授权"
      okText="确认撤销"
      okButtonProps={{ danger: true }}
      cancelText="取消"
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Space direction="vertical" size="middle" className="full-width">
        <Alert
          type="warning"
          showIcon
          message={`确认撤销 ${grant.caller_app_id} 对 ${grant.target_app_id} / ${grant.scope_code} 的授权？`}
          description="本页面不提供已撤销授权的恢复能力。"
        />
        <Form form={form} layout="vertical" onFinish={revokeGrant}>
          <Form.Item name="reason" label="撤销原因" rules={[{ max: 500, message: "最多 500 个字符" }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="可选" />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}

interface AdminAppSelectProps extends Pick<SelectProps<string>, "allowClear" | "onChange" | "placeholder" | "value"> {
  client: ApiClient;
  queryScope: string;
  "aria-label": string;
}

function AdminAppSelect({ client, queryScope, value, onChange, ...selectProps }: AdminAppSelectProps) {
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<AdminApp>();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const normalizedSearch = search.trim();
  const appsQuery = useQuery({
    queryKey: ["admin-apps", "service-grant-options", queryScope, normalizedSearch],
    queryFn: () =>
      listAdminApps(client, {
        page: 1,
        page_size: OPTION_PAGE_SIZE,
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

  const loadedApps = Array.isArray(appsQuery.data?.items) ? appsQuery.data.items : [];
  const apps = mergeAppOptions(loadedApps, selectedApp);
  const incomplete = typeof appsQuery.data?.total === "number" && appsQuery.data.total > loadedApps.length;
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

function AdminScopeSelect({
  client,
  targetAppId,
  value,
  onChange,
  ...selectProps
}: Pick<SelectProps<number>, "onChange" | "value"> & {
  client: ApiClient;
  targetAppId?: string;
  "aria-label": string;
}) {
  const scopesQuery = useQuery({
    queryKey: ["admin-resource-scopes", "service-grant-options", targetAppId],
    queryFn: () =>
      listAdminResourceScopes(client, {
        page: 1,
        page_size: OPTION_PAGE_SIZE,
        target_app_id: targetAppId,
        is_enabled: true
      }),
    enabled: Boolean(targetAppId)
  });
  const scopes = Array.isArray(scopesQuery.data?.items) ? scopesQuery.data.items : [];
  const incomplete = typeof scopesQuery.data?.total === "number" && scopesQuery.data.total > scopes.length;
  const options = scopes.map((scope) => ({
    value: scope.id,
    label: `${scope.scope_code}（ID: ${scope.id}）`
  }));

  return (
    <Space direction="vertical" size={4} className="full-width">
      <Select<number>
        {...selectProps}
        value={value}
        aria-label={selectProps["aria-label"]}
        placeholder={targetAppId ? "选择启用的资源范围" : "请先选择目标应用"}
        disabled={!targetAppId || scopesQuery.isError}
        loading={scopesQuery.isLoading || scopesQuery.isFetching}
        options={options}
        onChange={onChange}
        notFoundContent={
          scopesQuery.isLoading ? (
            <Spin size="small" />
          ) : scopesQuery.isError ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="资源范围加载失败" />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可用的启用资源范围" />
          )
        }
      />
      {scopesQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="资源范围选项加载失败"
          action={
            <Button type="link" size="small" onClick={() => scopesQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : null}
      {incomplete ? (
        <Alert
          type="info"
          showIcon
          message="启用的资源范围超过 100 条，当前列表不完整；接口暂不支持搜索，请联系后端扩展查询能力。"
        />
      ) : null}
    </Space>
  );
}

function normalizeCreateValues(values: CreateGrantFormValues): AdminServiceGrantCreate {
  return {
    caller_app_id: values.caller_app_id,
    scope_id: Number(values.scope_id),
    ...toOptionalUtcDate("valid_from", values.valid_from),
    ...toOptionalUtcDate("expires_at", values.expires_at)
  };
}

function toOptionalUtcDate(key: "valid_from" | "expires_at", value: unknown) {
  const date = getDatePickerDate(value);
  return date ? { [key]: date.toISOString().replace(/Z$/, "") } : {};
}

function validateExpiration(expiresAt: unknown, validFrom: unknown) {
  const expiresAtTime = getDatePickerDate(expiresAt)?.getTime();
  if (expiresAtTime === undefined) return Promise.resolve();

  const validFromTime = getDatePickerDate(validFrom)?.getTime();
  if (validFromTime !== undefined && expiresAtTime <= validFromTime) {
    return Promise.reject(new Error("到期时间必须晚于生效时间"));
  }
  if (validFromTime === undefined && expiresAtTime <= Date.now()) {
    return Promise.reject(new Error("到期时间必须晚于当前时间"));
  }
  return Promise.resolve();
}

function getDatePickerDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) return undefined;
  const toDate = (value as { toDate?: unknown }).toDate;
  if (typeof toDate !== "function") return undefined;
  const date = toDate.call(value) as Date;
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mergeAppOptions(apps: AdminApp[], selectedApp?: AdminApp) {
  if (!selectedApp || apps.some((app) => app.app_id === selectedApp.app_id)) return apps;
  return [selectedApp, ...apps];
}

function cleanFilters(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Filters;
}

function formatServerDate(value?: string | null) {
  if (!value) return "-";
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderOptionalValue(value?: string | number | null) {
  return value ?? "-";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
