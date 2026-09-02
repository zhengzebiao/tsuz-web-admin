import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Form, Modal, Select, Space, Spin, Tag, Typography } from "antd";
import type { ApiClient } from "@tsuz/api";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminUserRoles,
  listAssignableAdminRoles,
  replaceAdminUserRoles,
  type AdminRoleSummary,
  type AdminUser,
  type AdminUserRolesResponse
} from "../../services/admin-users-api";

interface UserRolesModalProps {
  client: ApiClient;
  user?: AdminUser;
  open: boolean;
  onClose: () => void;
}

export default function UserRolesModal({ client, user, open, onClose }: UserRolesModalProps) {
  const [form] = Form.useForm<{ role_ids: number[] }>();
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const userId = user?.id;
  const rolesQuery = useQuery({
    queryKey: ["admin-users", "roles", userId],
    queryFn: () => getAdminUserRoles(client, userId!),
    enabled: open && userId !== undefined
  });
  const availableRolesQuery = useQuery({
    queryKey: ["admin-roles", "assignable"],
    queryFn: () => listAssignableAdminRoles(client),
    enabled: open
  });

  useEffect(() => {
    if (open && rolesQuery.data) {
      form.setFieldsValue({ role_ids: rolesQuery.data.roles.map((role) => role.id) });
    }
    if (!open) form.resetFields();
  }, [form, open, rolesQuery.data]);

  const options = useMemo(
    () => mergeRoleOptions(availableRolesQuery.data?.items || [], rolesQuery.data?.roles || []),
    [availableRolesQuery.data, rolesQuery.data]
  );
  const isIncomplete = (availableRolesQuery.data?.total || 0) > (availableRolesQuery.data?.items.length || 0);
  const loading = rolesQuery.isLoading || availableRolesQuery.isLoading;
  const failed = rolesQuery.isError || availableRolesQuery.isError;

  const retry = () => {
    void Promise.all([rolesQuery.refetch(), availableRolesQuery.refetch()]);
  };

  const handleSave = async (values: { role_ids: number[] }) => {
    if (!userId || !rolesQuery.data) return;
    setSaving(true);
    try {
      const result = await replaceAdminUserRoles(client, userId, {
        role_ids: values.role_ids || [],
        version: rolesQuery.data.version
      });
      message.success(result.changed ? "角色已更新" : "角色未发生变化");
      if (result.revoked_sessions > 0) message.info(`已撤销 ${result.revoked_sessions} 个会话`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users", "roles", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users", "detail", userId] })
      ]);
      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "角色保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="分配用户角色"
      okText="保存角色"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => form.submit()}
      okButtonProps={{ disabled: loading || failed || !rolesQuery.data || !availableRolesQuery.data }}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" className="full-width">
        <Typography.Text>
          用户：<Typography.Text strong>{user?.display_name || user?.email}</Typography.Text>
        </Typography.Text>
        <Alert type="warning" showIcon message="角色变更可能撤销该用户的登录会话，请确认后再保存。" />
        {isIncomplete ? (
          <Alert type="info" showIcon message="可选角色超过单页上限，当前列表不完整，请联系管理员处理。" />
        ) : null}
        {failed ? (
          <Alert type="error" showIcon message="角色数据加载失败" action={<a onClick={retry}>重新加载</a>} />
        ) : loading ? (
          <Spin tip="正在加载角色..." />
        ) : (
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="role_ids" label="角色">
              <Select
                mode="multiple"
                placeholder="请选择角色"
                optionFilterProp="label"
                showSearch
                options={options.map((role) => ({
                  value: role.id,
                  label: role.is_enabled ? role.name : `${role.name}（已禁用）`,
                  disabled: !role.is_enabled
                }))}
              />
            </Form.Item>
          </Form>
        )}
      </Space>
    </Modal>
  );
}

function mergeRoleOptions(available: AdminRoleSummary[], assigned: AdminRoleSummary[]) {
  const roles = new Map<number, AdminRoleSummary>();
  for (const role of available) roles.set(role.id, role);
  for (const role of assigned) {
    if (!roles.has(role.id)) roles.set(role.id, role);
  }
  return Array.from(roles.values());
}
