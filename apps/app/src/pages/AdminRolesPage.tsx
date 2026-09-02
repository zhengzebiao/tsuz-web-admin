import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Dropdown,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@tsuz/ui";
import { createMfeApiClient } from "../services/api-client";
import {
  createAdminRole,
  disableAdminRole,
  enableAdminRole,
  getAdminRole,
  listAdminRoles,
  updateAdminRole,
  type AdminRole,
  type AdminRoleCreate
} from "../services/admin-roles-api";
import RolePermissionsModal from "./admin-roles/RolePermissionsModal";
import RoleUsersModal from "./admin-roles/RoleUsersModal";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
type Filters = { keyword?: string; is_enabled?: boolean };
type ModalState = { type: "create" | "edit" | "detail" | "disable"; role?: AdminRole } | undefined;

export default function AdminRolesPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const client = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>();
  const [permissionsRole, setPermissionsRole] = useState<AdminRole>();
  const [usersRole, setUsersRole] = useState<AdminRole>();
  const [busy, setBusy] = useState(false);
  const [confirmRole, setConfirmRole] = useState<AdminRole>();
  const [confirmAction, setConfirmAction] = useState<"enable" | "disable">();
  const rolesQuery = useQuery({
    queryKey: ["admin-roles", page, filters],
    queryFn: () => listAdminRoles(client, { page, page_size: PAGE_SIZE, ...filters })
  });
  const detailQuery = useQuery({
    queryKey: ["admin-roles", "detail", modal?.role?.id],
    queryFn: () => getAdminRole(client, modal!.role!.id),
    enabled: modal?.type === "detail" && Boolean(modal.role)
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      const result = (await action()) as { changed?: boolean; revoked_sessions?: number };
      message.success(result.changed === false ? "操作未发生变化" : fallback);
      if (result.revoked_sessions) message.info(`已撤销 ${result.revoked_sessions} 个会话`);
      await refresh();
      setModal(undefined);
      setConfirmRole(undefined);
      setConfirmAction(undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!confirmRole || !confirmAction) return;
    const role = confirmRole;
    const action = confirmAction;
    setConfirmRole(undefined);
    setConfirmAction(undefined);
    if (action === "enable") {
      Modal.confirm({
        title: "启用角色",
        content: `确认启用角色“${role.name}”？`,
        okText: "确认",
        cancelText: "取消",
        onOk: () => run(() => enableAdminRole(client, role.id), "角色已启用")
      });
    }
  }, [confirmRole, confirmAction]);
  const columns: ColumnsType<AdminRole> = [
    { title: "角色 ID", dataIndex: "id", width: 90 },
    {
      title: "角色名称",
      dataIndex: "name",
      width: 180,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>
    },
    { title: "描述", dataIndex: "description", ellipsis: true },
    {
      title: "启用状态",
      dataIndex: "is_enabled",
      width: 120,
      render: (value, role) => (
        <Switch
          checked={value}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={(checked) => {
            setConfirmRole(role);
            setConfirmAction(checked ? "enable" : "disable");
            if (!checked) setModal({ type: "disable", role });
          }}
        />
      )
    },
    { title: "创建时间", dataIndex: "created_at", width: 170, render: formatDate },
    { title: "更新时间", dataIndex: "updated_at", width: 170, render: formatDate },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_, role) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setModal({ type: "detail", role })}>
            详情
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: "edit", icon: <EditOutlined />, label: "编辑", onClick: () => setModal({ type: "edit", role }) },
                { key: "permissions", icon: <KeyOutlined />, label: "权限", onClick: () => setPermissionsRole(role) },
                { key: "users", icon: <TeamOutlined />, label: "关联用户", onClick: () => setUsersRole(role) }
              ]
            }}
            trigger={["click"]}
          >
            <Button type="link" size="small">
              更多 <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      )
    }
  ];
  const apply = () => {
    setPage(1);
    setFilters(cleanFilters(draft));
  };
  const reset = () => {
    setPage(1);
    setDraft({});
    setFilters({});
  };
  const submitModal = async (
    type: Exclude<NonNullable<ModalState>["type"], "detail">,
    values: Record<string, unknown>
  ) => {
    const role = modal?.role;
    if (type === "create") await run(() => createAdminRole(client, values as unknown as AdminRoleCreate), "角色已创建");
    if (type === "edit" && role)
      await run(
        () =>
          updateAdminRole(client, role.id, {
            name: values.name as string,
            description: values.description as string,
            version: Number(values.version)
          }),
        "角色已更新"
      );
    if (type === "disable" && role)
      await run(() => disableAdminRole(client, role.id, values.reason as string), "角色已禁用");
  };
  return (
    <PageContainer
      title="角色管理"
      description="管理系统角色、权限和成员"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ type: "create" })}>
          创建角色
        </Button>
      }
    >
      <Card className="admin-users-card">
        <Flex className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="关键词" className="admin-users-keyword">
            <Input
              value={draft.keyword}
              allowClear
              placeholder="角色名称 / 描述"
              onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
              onPressEnter={apply}
            />
          </Form.Item>
          <Form.Item label="启用状态">
            <Select
              value={draft.is_enabled === undefined ? "" : String(draft.is_enabled)}
              options={[
                { value: "", label: "全部" },
                { value: "true", label: "已启用" },
                { value: "false", label: "已禁用" }
              ]}
              onChange={(value) => setDraft({ ...draft, is_enabled: value === "" ? undefined : value === "true" })}
            />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={apply}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={reset}>
              重置
            </Button>
          </Space>
        </Flex>
        <Table
          rowKey="id"
          loading={rolesQuery.isLoading}
          dataSource={rolesQuery.data?.items || []}
          columns={columns}
          scroll={{ x: 1100 }}
          onChange={(pagination: TablePaginationConfig) => setPage(pagination.current || 1)}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: rolesQuery.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
          locale={{
            emptyText: rolesQuery.isError ? (
              <Space direction="vertical">
                <span>角色列表加载失败</span>
                <Button onClick={() => rolesQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无角色"
            )
          }}
        />
      </Card>
      <RoleModal
        state={modal}
        loading={busy}
        detail={detailQuery.data}
        detailLoading={detailQuery.isLoading}
        onCancel={() => setModal(undefined)}
        onSubmit={submitModal}
      />
      <RolePermissionsModal
        client={client}
        role={permissionsRole}
        open={Boolean(permissionsRole)}
        onClose={() => setPermissionsRole(undefined)}
      />
      <RoleUsersModal
        client={client}
        role={usersRole}
        open={Boolean(usersRole)}
        onClose={() => setUsersRole(undefined)}
      />
    </PageContainer>
  );
}

function RoleModal({
  state,
  loading,
  detail,
  detailLoading,
  onCancel,
  onSubmit
}: {
  state: ModalState;
  loading: boolean;
  detail?: AdminRole;
  detailLoading: boolean;
  onCancel: () => void;
  onSubmit: (
    type: Exclude<NonNullable<ModalState>["type"], "detail">,
    values: Record<string, unknown>
  ) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const type = state?.type;
  useEffect(() => {
    if (!state) return;
    form.resetFields();
    if (state.role)
      form.setFieldsValue({ name: state.role.name, description: state.role.description, version: state.role.version });
  }, [form, state]);
  if (!type || type === "detail")
    return (
      <Modal open={type === "detail"} title="角色详情" footer={null} onCancel={onCancel}>
        {detailLoading ? (
          <Typography.Text type="secondary">正在加载详情...</Typography.Text>
        ) : (
          <Descriptions
            bordered
            column={1}
            items={
              detail
                ? [
                    ["角色 ID", detail.id],
                    ["角色名称", detail.name],
                    ["描述", detail.description || "-"],
                    [
                      "启用状态",
                      <Tag color={detail.is_enabled ? "success" : "default"}>
                        {detail.is_enabled ? "已启用" : "已禁用"}
                      </Tag>
                    ],
                    ["禁用原因", detail.disabled_reason || "-"],
                    ["禁用时间", formatDate(detail.disabled_at)],
                    ["创建时间", formatDate(detail.created_at)],
                    ["更新时间", formatDate(detail.updated_at)],
                    ["数据版本", detail.version]
                  ].map(([label, children]) => ({ key: String(label), label, children }))
                : []
            }
          />
        )}
      </Modal>
    );
  const title = { create: "创建角色", edit: "编辑角色", disable: "禁用角色" }[type];
  return (
    <Modal
      open
      title={title}
      confirmLoading={loading}
      okText={type === "create" ? "创建" : "确认"}
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit(type, values)}>
        <Form.Item
          name="name"
          label="角色名称"
          rules={[{ required: type !== "disable", min: 1, max: 64, message: "请输入 1–64 个字符" }]}
        >
          {type === "disable" ? null : <Input />}
        </Form.Item>
        {type !== "disable" ? (
          <Form.Item name="description" label="描述" rules={[{ max: 255, message: "最多 255 个字符" }]}>
            <Input.TextArea rows={4} showCount maxLength={255} />
          </Form.Item>
        ) : (
          <Form.Item name="reason" label="禁用原因">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        )}
        {type === "edit" ? (
          <Form.Item name="version" hidden>
            <Input />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
function cleanFilters(filters: Filters): Filters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Filters;
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}
