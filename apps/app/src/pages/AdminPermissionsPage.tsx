import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
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
import { EditOutlined, EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@tsuz/ui";
import { createMfeApiClient } from "../services/api-client";
import {
  disableAdminPermission,
  enableAdminPermission,
  getAdminPermission,
  listAdminPermissions,
  updateAdminPermission,
  type AdminPermission,
  type AdminPermissionDetailResponse,
  type AdminPermissionListParams
} from "../services/admin-permissions-api";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
const queryKey = ["admin-permissions"];

type Filters = Omit<AdminPermissionListParams, "page" | "page_size">;
type ModalState = { type: "detail" | "edit" | "disable"; permission: AdminPermission } | undefined;

export default function AdminPermissionsPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const apiClient = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<ModalState>();
  const [confirmLoading, setConfirmLoading] = useState(false);

  const permissionsQuery = useQuery({
    queryKey: [...queryKey, page, filters],
    queryFn: () => listAdminPermissions(apiClient, { page, page_size: PAGE_SIZE, ...filters })
  });
  const detailQuery = useQuery({
    queryKey: [...queryKey, "detail", modalState?.permission.id],
    queryFn: () => getAdminPermission(apiClient, modalState!.permission.id),
    enabled: modalState?.type === "detail"
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setConfirmLoading(true);
    try {
      const result = (await action()) as { message?: string; revoked_sessions?: number };
      message.success(result.message || successMessage);
      if (result.revoked_sessions) message.info(`已撤销 ${result.revoked_sessions} 个会话`);
      await refresh();
      setModalState(undefined);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSwitch = (permission: AdminPermission, enabled: boolean) => {
    if (!enabled) {
      setModalState({ type: "disable", permission });
      return;
    }
    Modal.confirm({
      title: "开启权限",
      content: `确认开启“${permission.display_name || permission.name}”？`,
      okText: "确认",
      cancelText: "取消",
      onOk: () => runAction(() => enableAdminPermission(apiClient, permission.id), "权限已开启")
    });
  };

  const columns: ColumnsType<AdminPermission> = [
    { title: "权限 ID", dataIndex: "id", width: 90 },
    {
      title: "权限",
      key: "permission",
      width: 240,
      render: (_, permission) => (
        <div>
          <Typography.Text strong>{permission.display_name || permission.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{permission.name}</Typography.Text>
        </div>
      )
    },
    {
      title: "资源 / 动作",
      key: "resource-action",
      render: (_, permission) => `${permission.resource} / ${permission.action}`
    },
    {
      title: "声明状态",
      dataIndex: "is_declared",
      width: 110,
      render: (declared: boolean) => (
        <Tag color={declared ? "success" : "default"}>{declared ? "已声明" : "未声明"}</Tag>
      )
    },
    {
      title: "启用状态",
      dataIndex: "is_enabled",
      width: 125,
      render: (enabled: boolean, permission) => (
        <Switch
          checked={enabled}
          checkedChildren="开启"
          unCheckedChildren="禁用"
          onChange={(checked) => handleSwitch(permission, checked)}
        />
      )
    },
    { title: "接口数", dataIndex: "endpoint_count", width: 90 },
    { title: "角色数", dataIndex: "role_count", width: 90 },
    { title: "更新时间", dataIndex: "updated_at", width: 170, render: formatDate },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, permission) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setModalState({ type: "detail", permission })}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setModalState({ type: "edit", permission })}
          >
            编辑
          </Button>
        </Space>
      )
    }
  ];

  const rows = permissionsQuery.data?.items || [];
  const handleTableChange = (pagination: TablePaginationConfig) => setPage(pagination.current || 1);
  const applyFilters = () => {
    setPage(1);
    setFilters(cleanFilters(draftFilters));
  };

  return (
    <PageContainer title="权限管理" description="管理系统权限及其启用状态">
      <Card className="admin-users-card">
        <Flex className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="关键词" className="admin-users-keyword">
            <Input
              value={draftFilters.keyword}
              placeholder="权限名称 / 显示名称"
              allowClear
              onChange={(event) => setDraftFilters({ ...draftFilters, keyword: event.target.value })}
              onPressEnter={applyFilters}
            />
          </Form.Item>
          <Form.Item label="资源">
            <Input
              value={draftFilters.resource}
              placeholder="如 users"
              allowClear
              onChange={(event) => setDraftFilters({ ...draftFilters, resource: event.target.value })}
              onPressEnter={applyFilters}
            />
          </Form.Item>
          <Form.Item label="声明状态">
            <Select
              value={toSelectValue(draftFilters.is_declared)}
              options={booleanOptions("全部", "已声明", "未声明")}
              onChange={(value) => setDraftFilters({ ...draftFilters, is_declared: fromSelectValue(value) })}
            />
          </Form.Item>
          <Form.Item label="启用状态">
            <Select
              value={toSelectValue(draftFilters.is_enabled)}
              options={booleanOptions("全部", "已启用", "已禁用")}
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
          loading={permissionsQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1200 }}
          onChange={handleTableChange}
          locale={{
            emptyText: permissionsQuery.isError ? (
              <Space direction="vertical">
                <span>权限列表加载失败</span>
                <Button onClick={() => permissionsQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无权限"
            )
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: permissionsQuery.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>
      <PermissionModal
        state={modalState}
        detail={detailQuery.data}
        detailLoading={detailQuery.isLoading}
        detailError={detailQuery.isError}
        loading={confirmLoading}
        onCancel={() => setModalState(undefined)}
        onRetry={() => detailQuery.refetch()}
        onSubmit={async (type, values) => {
          const permission = modalState?.permission;
          if (!permission) return;
          if (type === "disable")
            await runAction(() => disableAdminPermission(apiClient, permission.id, values.reason), "权限已禁用");
          if (type === "edit") {
            await runAction(
              () =>
                updateAdminPermission(apiClient, permission.id, {
                  display_name: values.display_name,
                  description: values.description,
                  version: Number(values.version)
                }),
              "权限信息已更新"
            );
          }
        }}
      />
    </PageContainer>
  );
}

function PermissionModal({
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
  detail?: AdminPermissionDetailResponse;
  detailLoading: boolean;
  detailError: boolean;
  loading: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (type: "edit" | "disable", values: Record<string, any>) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const type = state?.type;
  useEffect(() => {
    if (!state) return;
    form.resetFields();
    if (type === "edit") {
      form.setFieldsValue({
        display_name: state.permission.display_name,
        description: state.permission.description,
        version: state.permission.version
      });
    }
  }, [form, state, type]);

  if (!type) return null;
  if (type === "detail") {
    const permission = detail;
    return (
      <Modal open title="权限详情" footer={null} onCancel={onCancel}>
        {detailLoading ? <Spin tip="正在加载详情..." /> : null}
        {detailError ? (
          <Space direction="vertical">
            <Typography.Text type="danger">权限详情加载失败</Typography.Text>
            <Button onClick={onRetry}>重新加载</Button>
          </Space>
        ) : null}
        {permission ? (
          <Descriptions
            bordered
            column={1}
            items={[
              ["权限 ID", permission.id],
              ["名称", permission.name],
              ["显示名称", permission.display_name],
              ["描述", permission.description || "-"],
              ["资源", permission.resource],
              ["动作", permission.action],
              ["声明状态", permission.is_declared ? "已声明" : "未声明"],
              ["启用状态", permission.is_enabled ? "已启用" : "已禁用"],
              ["禁用原因", permission.disabled_reason || "-"],
              ["禁用时间", formatDate(permission.disabled_at)],
              ["缺失时间", formatDate(permission.missing_at)],
              ["接口数量", permission.endpoints?.length ?? permission.endpoint_count],
              ["关联角色数", permission.role_count],
              ["创建时间", formatDate(permission.created_at)],
              ["更新时间", formatDate(permission.updated_at)],
              ["数据版本", permission.version]
            ].map(([label, children]) => ({ key: String(label), label, children }))}
          />
        ) : null}
        {permission ? (
          <Table
            className="admin-permission-endpoints"
            rowKey={(endpoint) => `${endpoint.http_method}-${endpoint.path}-${endpoint.route_name}`}
            size="small"
            pagination={false}
            dataSource={permission.endpoints}
            columns={[
              { title: "方法", dataIndex: "http_method", width: 90 },
              { title: "路径", dataIndex: "path" },
              { title: "路由名称", dataIndex: "route_name" }
            ]}
          />
        ) : null}
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={type === "edit" ? "编辑权限" : "禁用权限"}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="确认"
      cancelText="取消"
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit(type, values)}>
        {type === "edit" ? (
          <>
            <Form.Item name="display_name" label="显示名称" rules={[{ max: 128, message: "最多 128 个字符" }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="描述" rules={[{ max: 255, message: "最多 255 个字符" }]}>
              <Input.TextArea showCount maxLength={255} rows={4} />
            </Form.Item>
            <Form.Item name="version" hidden>
              <Input />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="reason" label="禁用原因" rules={[{ max: 500, message: "最多 500 个字符" }]}>
            <Input.TextArea showCount maxLength={500} rows={4} placeholder="可选" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function cleanFilters(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Filters;
}
function booleanOptions(all: string, yes: string, no: string) {
  return [
    { value: "", label: all },
    { value: "true", label: yes },
    { value: "false", label: no }
  ];
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
