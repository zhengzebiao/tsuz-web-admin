import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@tsuz/ui";
import {
  createAdminApp,
  disableAdminApp,
  enableAdminApp,
  getAdminApp,
  listAdminApps,
  updateAdminApp,
  type AdminApp,
  type AdminAppCreate,
  type AdminAppCreateResponse,
  type AdminAppListParams
} from "../services/admin-apps-api";
import { createMfeApiClient } from "../services/api-client";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
const queryKey = ["admin-apps"];

type Filters = Omit<AdminAppListParams, "page" | "page_size">;
type AppFormState = { type: "create" } | { type: "edit" | "disable"; app: AdminApp };
type ModalState = AppFormState | { type: "detail"; app: AdminApp } | undefined;

export default function AdminAppsPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const apiClient = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<ModalState>();
  const [secretResult, setSecretResult] = useState<AdminAppCreateResponse>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(240);

  useEffect(() => {
    const updateTableScrollY = () => {
      const card = cardRef.current;
      const filters = filtersRef.current;
      if (!card || !filters) return;
      setTableScrollY(Math.max(240, card.clientHeight - filters.offsetHeight - 110));
    };
    updateTableScrollY();
    const observer = new ResizeObserver(updateTableScrollY);
    if (cardRef.current) observer.observe(cardRef.current);
    if (filtersRef.current) observer.observe(filtersRef.current);
    return () => observer.disconnect();
  }, []);

  const selectedApp = modalState && "app" in modalState ? modalState.app : undefined;

  const appsQuery = useQuery({
    queryKey: [...queryKey, page, filters],
    queryFn: () => listAdminApps(apiClient, { page, page_size: PAGE_SIZE, ...filters })
  });
  const detailQuery = useQuery({
    queryKey: [...queryKey, "detail", selectedApp?.id],
    queryFn: () => getAdminApp(apiClient, selectedApp!.id),
    enabled: modalState?.type === "detail" && Boolean(selectedApp)
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const runAction = async (action: () => Promise<{ changed: boolean }>, successMessage: string) => {
    setConfirmLoading(true);
    try {
      const result = await action();
      message.success(result.changed === false ? "操作未发生变化" : successMessage);
      await refresh();
      setModalState(undefined);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setConfirmLoading(false);
    }
  };

  const createApp = async (values: Record<string, unknown>) => {
    setConfirmLoading(true);
    try {
      const result = await createAdminApp(apiClient, normalizeAppValues(values));
      setSecretResult(result);
      setModalState(undefined);
      message.success("应用创建成功，请立即保存初始 Secret");
      await refresh().catch(() => undefined);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setConfirmLoading(false);
    }
  };

  const enableApp = (app: AdminApp) => {
    modal.confirm({
      title: "启用应用",
      content: `确认启用“${app.name}（${app.app_id}）”？`,
      okText: "确认",
      cancelText: "取消",
      onOk: () => runAction(() => enableAdminApp(apiClient, app.id), "应用已启用")
    });
  };

  const columns: ColumnsType<AdminApp> = [
    { title: "记录 ID", dataIndex: "id", width: 90 },
    {
      title: "应用",
      key: "app",
      width: 230,
      render: (_, app) => (
        <div>
          <Typography.Text strong>{app.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{app.app_id}</Typography.Text>
        </div>
      )
    },
    { title: "Service Account", dataIndex: "service_account_name", width: 190, ellipsis: true },
    {
      title: "Access URL",
      dataIndex: "access_url",
      width: 260,
      ellipsis: true,
      render: (value: string) => <Typography.Text>{value}</Typography.Text>
    },
    {
      title: "启用状态",
      dataIndex: "is_enabled",
      width: 120,
      render: (enabled: boolean, app) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          disabled={confirmLoading}
          onChange={(checked) => {
            if (checked) enableApp(app);
            else setModalState({ type: "disable", app });
          }}
        />
      )
    },
    { title: "Secret 更新时间", dataIndex: "secret_updated_at", width: 180, render: formatDate },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    { title: "更新时间", dataIndex: "updated_at", width: 180, render: formatDate },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, app) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setModalState({ type: "detail", app })}
          >
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setModalState({ type: "edit", app })}>
            编辑
          </Button>
        </Space>
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
      title="应用管理"
      description="管理服务应用及其访问状态"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalState({ type: "create" })}>
          创建应用
        </Button>
      }
    >
      <Card ref={cardRef} className="admin-users-card">
        <Flex ref={filtersRef} className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="关键词" className="admin-users-keyword">
            <Input
              aria-label="关键词"
              value={draftFilters.keyword}
              placeholder="应用名称 / 应用 ID"
              allowClear
              maxLength={128}
              onChange={(event) => setDraftFilters({ ...draftFilters, keyword: event.target.value })}
              onPressEnter={applyFilters}
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
          loading={appsQuery.isLoading}
          dataSource={appsQuery.data?.items || []}
          columns={columns}
          scroll={{ x: 1550,y: tableScrollY  }}
          onChange={(pagination: TablePaginationConfig) => setPage(pagination.current || 1)}
          locale={{
            emptyText: appsQuery.isError ? (
              <Space direction="vertical">
                <span>应用列表加载失败</span>
                <Button onClick={() => appsQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无应用"
            )
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: appsQuery.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
            className: "admin-apps-pagination"
          }}
        />
      </Card>
      <AppModal
        state={modalState}
        detail={detailQuery.data}
        detailLoading={detailQuery.isLoading}
        detailError={detailQuery.isError}
        loading={confirmLoading}
        onCancel={() => setModalState(undefined)}
        onRetry={() => detailQuery.refetch()}
        onSubmit={async (type, values) => {
          if (type === "create") {
            await createApp(values);
            return;
          }
          if (!selectedApp) return;
          if (type === "edit") {
            await runAction(
              () =>
                updateAdminApp(apiClient, selectedApp.id, {
                  ...normalizeAppValues(values),
                  version: Number(values.version)
                }),
              "应用信息已更新"
            );
          }
          if (type === "disable") {
            await runAction(
              () => disableAdminApp(apiClient, selectedApp.id, String(values.reason || "")),
              "应用已禁用"
            );
          }
        }}
      />
      {secretResult ? <InitialSecretModal result={secretResult} onClose={() => setSecretResult(undefined)} /> : null}
    </PageContainer>
  );
}

function AppModal({
  state,
  detail,
  detailLoading,
  detailError,
  loading,
  onCancel,
  onRetry,
  onSubmit
}: {
  state: ModalState;
  detail?: AdminApp;
  detailLoading: boolean;
  detailError: boolean;
  loading: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (type: "create" | "edit" | "disable", values: Record<string, unknown>) => Promise<void>;
}) {
  if (!state) return null;
  if (state.type === "detail") {
    return (
      <Drawer open title="应用详情" onClose={onCancel}>
        {detailLoading ? (
          <Space>
            <Spin />
            <Typography.Text type="secondary">正在加载详情...</Typography.Text>
          </Space>
        ) : null}
        {detailError ? (
          <Space direction="vertical">
            <Typography.Text type="danger">应用详情加载失败</Typography.Text>
            <Button onClick={onRetry}>重新加载</Button>
          </Space>
        ) : null}
        {detail ? <AppDescriptions app={detail} /> : null}
      </Drawer>
    );
  }

  return <AppFormModal state={state} loading={loading} onCancel={onCancel} onSubmit={onSubmit} />;
}

function AppFormModal({
  state,
  loading,
  onCancel,
  onSubmit
}: {
  state: AppFormState;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (type: "create" | "edit" | "disable", values: Record<string, unknown>) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const app = "app" in state ? state.app : undefined;

  useEffect(() => {
    form.resetFields();
    if (state.type === "edit" && app) {
      form.setFieldsValue({
        name: app.name,
        icon_url: app.icon_url,
        access_url: app.access_url,
        service_account_name: app.service_account_name,
        version: app.version
      });
    }
  }, [app, form, state.type]);

  const title = { create: "创建应用", edit: "编辑应用", disable: "禁用应用" }[state.type];
  return (
    <Modal
      open
      title={title}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={state.type === "create" ? "创建" : "确认"}
      cancelText="取消"
      maskClosable={!loading}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit(state.type, values)}>
        {state.type === "disable" ? (
          <Form.Item name="reason" label="禁用原因" rules={[{ max: 500, message: "最多 500 个字符" }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="可选" />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="name"
              label="应用名称"
              rules={[
                { required: true, message: "请输入应用名称" },
                { min: 1, max: 128, message: "请输入 1–128 个字符" }
              ]}
            >
              <Input maxLength={128} />
            </Form.Item>
            <Form.Item
              name="service_account_name"
              label="Service Account 名称"
              rules={[
                { required: true, message: "请输入 Service Account 名称" },
                { min: 1, max: 128, message: "请输入 1–128 个字符" }
              ]}
            >
              <Input maxLength={128} />
            </Form.Item>
            <Form.Item
              name="access_url"
              label="Access URL"
              rules={[
                { required: true, message: "请输入 Access URL" },
                { type: "url", message: "请输入有效 URL" },
                { max: 2048, message: "最多 2048 个字符" }
              ]}
            >
              <Input maxLength={2048} />
            </Form.Item>
            <Form.Item
              name="icon_url"
              label="Icon URL"
              rules={[
                { type: "url", message: "请输入有效 URL" },
                { max: 2048, message: "最多 2048 个字符" }
              ]}
            >
              <Input maxLength={2048} placeholder="可选" />
            </Form.Item>
            {state.type === "edit" ? (
              <Form.Item name="version" hidden>
                <Input />
              </Form.Item>
            ) : null}
          </>
        )}
      </Form>
    </Modal>
  );
}

function AppDescriptions({ app }: { app: AdminApp }) {
  return (
    <Descriptions
      bordered
      column={1}
      items={[
        ["记录 ID", app.id],
        ["应用 ID", app.app_id],
        ["应用名称", app.name],
        ["Service Account", app.service_account_name],
        ["Icon URL", app.icon_url || "-"],
        ["Access URL", app.access_url],
        ["启用状态", <Tag color={app.is_enabled ? "success" : "default"}>{app.is_enabled ? "已启用" : "已禁用"}</Tag>],
        ["禁用原因", app.disabled_reason || "-"],
        ["禁用时间", formatDate(app.disabled_at)],
        ["Secret 更新时间", formatDate(app.secret_updated_at)],
        ["创建时间", formatDate(app.created_at)],
        ["更新时间", formatDate(app.updated_at)],
        ["数据版本", app.version]
      ].map(([label, children]) => ({ key: String(label), label, children }))}
    />
  );
}

function InitialSecretModal({ result, onClose }: { result: AdminAppCreateResponse; onClose: () => void }) {
  return (
    <Modal
      open
      title="应用创建成功"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <Button type="primary" onClick={onClose}>
          我已保存并关闭
        </Button>
      }
    >
      <Space direction="vertical" size="middle" className="full-width">
        <Alert
          type="warning"
          showIcon
          message="请立即安全保存初始 Secret"
          description="关闭此窗口后，管理端不会再次显示该 Secret。"
        />
        <Descriptions
          bordered
          column={1}
          items={[
            { key: "app-id", label: "应用 ID", children: result.app.app_id },
            {
              key: "app-secret",
              label: "初始 Secret",
              children: (
                <Typography.Text code copyable={{ text: result.app_secret, tooltips: ["复制 Secret", "已复制"] }}>
                  {result.app_secret}
                </Typography.Text>
              )
            }
          ]}
        />
      </Space>
    </Modal>
  );
}

function normalizeAppValues(values: Record<string, unknown>): AdminAppCreate {
  return {
    name: String(values.name || "").trim(),
    service_account_name: String(values.service_account_name || "").trim(),
    access_url: String(values.access_url || "").trim(),
    icon_url: normalizeOptionalString(values.icon_url)
  };
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
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
