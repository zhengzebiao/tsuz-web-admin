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
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  KeyOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@tsuz/ui";
import { createMfeApiClient } from "../services/api-client";
import {
  blacklistAdminUser,
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  forceLogoutAdminUser,
  getAdminUser,
  listAdminUsers,
  recoverAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
  type AdminUserCreate
} from "../services/admin-users-api";
import { useAppStore } from "../stores/app.store";

const PAGE_SIZE = 20;
const queryKey = ["admin-users"];

type Filters = {
  keyword?: string;
  is_active?: boolean;
  is_blacklisted?: boolean;
};
type ModalState =
  { type: "create" | "edit" | "detail" | "disable" | "blacklist" | "reset-password"; user?: AdminUser } | undefined;

export default function AdminUsersPage() {
  const hostProps = useAppStore((state) => state.hostProps);
  const apiClient = useMemo(() => createMfeApiClient(hostProps), [hostProps]);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [filters, setFilters] = useState<Filters>({});
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<ModalState>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionUser, setActionUser] = useState<AdminUser>();
  const [pendingAction, setPendingAction] = useState<"enable" | "recover" | "force-logout">();

  const usersQuery = useQuery({
    queryKey: [...queryKey, page, filters],
    queryFn: () => listAdminUsers(apiClient, { page, page_size: PAGE_SIZE, ...filters })
  });

  const detailQuery = useQuery({
    queryKey: [...queryKey, "detail", modalState?.user?.id],
    queryFn: () => getAdminUser(apiClient, modalState!.user!.id),
    enabled: modalState?.type === "detail" && Boolean(modalState.user)
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setConfirmLoading(true);
    try {
      const result = await action();
      const response = result as { message?: string; revoked_sessions?: number };
      message.success(response.message || successMessage);
      if (response.revoked_sessions !== undefined) {
        message.info(`已撤销 ${response.revoked_sessions} 个会话`);
      }
      await refresh();
      setModalState(undefined);
      setActionUser(undefined);
      setPendingAction(undefined);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSwitch = (user: AdminUser, field: "active" | "blacklisted", checked: boolean) => {
    setActionUser(user);
    if (field === "active") {
      if (checked) {
        setPendingAction("enable");
      } else {
        setModalState({ type: "disable", user });
      }
    } else if (checked) {
      setModalState({ type: "blacklist", user });
    } else {
      setPendingAction("recover");
    }
  };

  useEffect(() => {
    if (!pendingAction || !actionUser || pendingAction === "force-logout") return;
    const user = actionUser;
    const action = pendingAction;
    setPendingAction(undefined);
    Modal.confirm({
      title: action === "enable" ? "开启用户" : "解禁用户",
      content:
        action === "enable"
          ? `确认开启 ${user.email}？该用户将可以继续登录系统。`
          : `确认解除 ${user.email} 的黑名单状态？`,
      okText: "确认",
      cancelText: "取消",
      onOk: () =>
        runAction(
          action === "enable" ? () => enableAdminUser(apiClient, user.id) : () => recoverAdminUser(apiClient, user.id),
          "操作成功"
        ),
      onCancel: () => setActionUser(undefined)
    });
  }, [pendingAction, actionUser]);

  const columns: ColumnsType<AdminUser> = [
    { title: "用户 ID", dataIndex: "id", width: 90 },
    {
      title: "用户",
      key: "user",
      render: (_, user) => (
        <div>
          <Typography.Text strong>{user.display_name || "未设置显示名称"}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{user.email}</Typography.Text>
        </div>
      )
    },
    {
      title: "启用状态",
      dataIndex: "is_active",
      width: 120,
      render: (value: boolean, user) => (
        <Switch
          checked={value}
          checkedChildren="开启"
          unCheckedChildren="禁用"
          onChange={(checked) => handleSwitch(user, "active", checked)}
        />
      )
    },
    {
      title: "黑名单",
      dataIndex: "is_blacklisted",
      width: 120,
      render: (value: boolean, user) => (
        <Switch
          checked={value}
          checkedChildren="已拉黑"
          unCheckedChildren="正常"
          onChange={(checked) => handleSwitch(user, "blacklisted", checked)}
        />
      )
    },
    { title: "创建时间", dataIndex: "created_at", width: 170, render: formatDate },
    { title: "更新时间", dataIndex: "updated_at", width: 170, render: formatDate },
    {
      title: "操作",
      key: "actions",
      width: 190,
      render: (_, user) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setModalState({ type: "detail", user })}
          >
            详情
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: "edit",
                  icon: <EditOutlined />,
                  label: "编辑",
                  onClick: () => setModalState({ type: "edit", user })
                },
                {
                  key: "reset-password",
                  icon: <KeyOutlined />,
                  label: "重置密码",
                  onClick: () => setModalState({ type: "reset-password", user })
                },
                {
                  key: "force-logout",
                  icon: <LogoutOutlined />,
                  label: "强制下线",
                  onClick: () => {
                    setActionUser(user);
                    setPendingAction("force-logout");
                  }
                }
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

  const handleTableChange = (pagination: TablePaginationConfig) => setPage(pagination.current || 1);
  const rows = usersQuery.data?.items || [];

  return (
    <PageContainer
      title="用户管理"
      description="管理系统用户和账户状态"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalState({ type: "create" })}>
          新增用户
        </Button>
      }
    >
      <Card className="admin-users-card">
        <Flex className="admin-users-filters" gap={12} wrap="wrap" align="end">
          <Form.Item label="关键词" className="admin-users-keyword">
            <Input
              value={draftFilters.keyword}
              placeholder="邮箱 / 显示名称 / 用户 ID"
              allowClear
              onChange={(event) => setDraftFilters({ ...draftFilters, keyword: event.target.value })}
              onPressEnter={() => {
                setPage(1);
                setFilters(cleanFilters(draftFilters));
              }}
            />
          </Form.Item>
          <Form.Item label="启用状态">
            <Select
              value={toSelectValue(draftFilters.is_active)}
              options={[
                { value: "", label: "全部" },
                { value: "true", label: "已启用" },
                { value: "false", label: "已禁用" }
              ]}
              onChange={(value) => setDraftFilters({ ...draftFilters, is_active: fromSelectValue(value) })}
            />
          </Form.Item>
          <Form.Item label="黑名单状态">
            <Select
              value={toSelectValue(draftFilters.is_blacklisted)}
              options={[
                { value: "", label: "全部" },
                { value: "false", label: "正常" },
                { value: "true", label: "已拉黑" }
              ]}
              onChange={(value) => setDraftFilters({ ...draftFilters, is_blacklisted: fromSelectValue(value) })}
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              onClick={() => {
                setPage(1);
                setFilters(cleanFilters(draftFilters));
              }}
            >
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
          loading={usersQuery.isLoading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1000 }}
          onChange={handleTableChange}
          locale={{
            emptyText: usersQuery.isError ? (
              <Space direction="vertical">
                <span>用户列表加载失败</span>
                <Button onClick={() => usersQuery.refetch()}>重新加载</Button>
              </Space>
            ) : (
              "暂无用户"
            )
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: usersQuery.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>
      <UserModal
        state={modalState}
        loading={confirmLoading}
        detail={detailQuery.data}
        detailLoading={detailQuery.isLoading}
        onCancel={() => {
          setModalState(undefined);
          setActionUser(undefined);
        }}
        onSubmit={async (type, values) => {
          const user = modalState?.user;
          if (type === "create")
            await runAction(() => createAdminUser(apiClient, values as AdminUserCreate), "用户创建成功");
          if (type === "edit" && user)
            await runAction(
              () =>
                updateAdminUser(apiClient, user.id, {
                  email: values.email,
                  display_name: values.display_name,
                  version: Number(values.version)
                }),
              "用户更新成功"
            );
          if (type === "disable" && user)
            await runAction(() => disableAdminUser(apiClient, user.id, values.reason), "用户已禁用");
          if (type === "blacklist" && user)
            await runAction(() => blacklistAdminUser(apiClient, user.id, values.reason), "用户已拉黑");
          if (type === "reset-password" && user)
            await runAction(() => resetAdminUserPassword(apiClient, user.id, values.new_password), "密码已重置");
        }}
      />
      <ConfirmAction
        state={pendingAction === "force-logout" ? "force-logout" : undefined}
        user={actionUser}
        loading={confirmLoading}
        onCancel={() => {
          setPendingAction(undefined);
          setActionUser(undefined);
        }}
        onConfirm={() =>
          actionUser && runAction(() => forceLogoutAdminUser(apiClient, actionUser.id), "已强制用户下线")
        }
      />
    </PageContainer>
  );
}

function UserModal({
  state,
  loading,
  detail,
  detailLoading,
  onCancel,
  onSubmit
}: {
  state: ModalState;
  loading: boolean;
  detail?: AdminUser;
  detailLoading: boolean;
  onCancel: () => void;
  onSubmit: (type: Exclude<NonNullable<ModalState>["type"], "detail">, values: Record<string, any>) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const type = state?.type;
  useEffect(() => {
    if (!state) return;
    form.resetFields();
    if (type === "edit" && state.user)
      form.setFieldsValue({
        email: state.user.email,
        display_name: state.user.display_name,
        version: state.user.version
      });
    if (type === "create") form.setFieldsValue({ is_active: true });
  }, [state, type]);
  if (!type || type === "detail") {
    return (
      <Modal open={type === "detail"} title="用户详情" footer={null} onCancel={onCancel} confirmLoading={detailLoading}>
        {detailLoading ? <Typography.Paragraph type="secondary">正在加载详情...</Typography.Paragraph> : null}
        <Descriptions
          bordered
          column={1}
          items={
            detail
              ? [
                  ["用户 ID", detail.id],
                  ["邮箱", detail.email],
                  ["显示名称", detail.display_name || "未设置显示名称"],
                  [
                    "启用状态",
                    <Tag color={detail.is_active ? "success" : "default"}>{detail.is_active ? "已启用" : "已禁用"}</Tag>
                  ],
                  [
                    "黑名单状态",
                    <Tag color={detail.is_blacklisted ? "error" : "success"}>
                      {detail.is_blacklisted ? "已拉黑" : "正常"}
                    </Tag>
                  ],
                  ["禁用原因", detail.disabled_reason || "-"],
                  ["拉黑原因", detail.blacklisted_reason || "-"],
                  ["禁用时间", formatDate(detail.disabled_at)],
                  ["拉黑时间", formatDate(detail.blacklisted_at)],
                  ["密码更新时间", formatDate(detail.password_changed_at)],
                  ["创建时间", formatDate(detail.created_at)],
                  ["更新时间", formatDate(detail.updated_at)],
                  ["数据版本", detail.version]
                ].map(([label, children]) => ({ key: String(label), label, children }))
              : []
          }
        />
      </Modal>
    );
  }
  const isCreate = type === "create";
  const title = {
    edit: "编辑用户",
    disable: "禁用用户",
    blacklist: "拉黑用户",
    "reset-password": "重置用户密码",
    create: "新增用户"
  }[type];
  return (
    <Modal
      open
      title={title}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={isCreate ? "创建" : "确认"}
      cancelText="取消"
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit(type, values)}>
        {isCreate || type === "edit" ? (
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
            <Input />
          </Form.Item>
        ) : null}
        {isCreate || type === "edit" ? (
          <Form.Item name="display_name" label="显示名称" rules={[{ max: 128, message: "最多 128 个字符" }]}>
            <Input />
          </Form.Item>
        ) : null}
        {isCreate ? (
          <>
            <Form.Item name="password" label="初始密码" rules={[{ required: true, message: "请输入初始密码" }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="禁用" />
            </Form.Item>
          </>
        ) : null}
        {type === "edit" ? (
          <Form.Item name="version" hidden>
            <Input />
          </Form.Item>
        ) : null}
        {type === "disable" || type === "blacklist" ? (
          <Form.Item
            name="reason"
            label={type === "disable" ? "禁用原因" : "拉黑原因"}
            rules={[{ required: true, min: 1, max: 500, message: "请输入 1–500 个字符的原因" }]}
          >
            <Input.TextArea showCount maxLength={500} rows={4} />
          </Form.Item>
        ) : null}
        {type === "reset-password" ? (
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: "请输入新密码" }]}>
            <Input.Password />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}

function ConfirmAction({
  state,
  user,
  loading,
  onCancel,
  onConfirm
}: {
  state?: "force-logout";
  user?: AdminUser;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={state === "force-logout"}
      title="强制下线"
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={loading}
      okText="确认下线"
      cancelText="取消"
    >
      确认强制 {user?.email} 的所有登录会话下线？
    </Modal>
  );
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
