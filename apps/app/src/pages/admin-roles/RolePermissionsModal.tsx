import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Form, Modal, Select, Space, Spin, Typography } from "antd";
import type { ApiClient } from "@tsuz/api";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminRolePermissions,
  listAdminPermissions,
  replaceAdminRolePermissions,
  type AdminPermissionSummary,
  type AdminRole,
  type AdminRolePermissionsResponse
} from "../../services/admin-roles-api";

interface RolePermissionsModalProps {
  client: ApiClient;
  role?: AdminRole;
  open: boolean;
  onClose: () => void;
}

export default function RolePermissionsModal({ client, role, open, onClose }: RolePermissionsModalProps) {
  const [form] = Form.useForm<{ permission_ids: number[] }>();
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const roleId = role?.id;
  const assignedQuery = useQuery({
    queryKey: ["admin-roles", "permissions", roleId],
    queryFn: () => getAdminRolePermissions(client, roleId!),
    enabled: open && roleId !== undefined
  });
  const availableQuery = useQuery({
    queryKey: ["admin-permissions", "assignable"],
    queryFn: () => listAdminPermissions(client),
    enabled: open
  });

  useEffect(() => {
    if (open && assignedQuery.data)
      form.setFieldsValue({ permission_ids: assignedQuery.data.permissions.map((permission) => permission.id) });
    if (!open) form.resetFields();
  }, [assignedQuery.data, form, open]);

  const options = useMemo(
    () => mergePermissionOptions(availableQuery.data?.items || [], assignedQuery.data?.permissions || []),
    [assignedQuery.data, availableQuery.data]
  );
  const loading = assignedQuery.isLoading || availableQuery.isLoading;
  const failed = assignedQuery.isError || availableQuery.isError;
  const incomplete = (availableQuery.data?.total || 0) > (availableQuery.data?.items.length || 0);
  const retry = () => void Promise.all([assignedQuery.refetch(), availableQuery.refetch()]);

  const save = async (values: { permission_ids: number[] }) => {
    if (!roleId || !assignedQuery.data) return;
    setSaving(true);
    try {
      const result = await replaceAdminRolePermissions(client, roleId, {
        permission_ids: values.permission_ids || [],
        version: assignedQuery.data.version
      });
      message.success(result.changed ? "权限已更新" : "权限未发生变化");
      if (result.revoked_sessions > 0) message.info(`已撤销 ${result.revoked_sessions} 个会话`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-roles"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-roles", "permissions", roleId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-roles", "detail", roleId] })
      ]);
      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "权限保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="分配角色权限"
      okText="保存权限"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => form.submit()}
      okButtonProps={{ disabled: loading || failed || !assignedQuery.data || !availableQuery.data }}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" className="full-width">
        <Typography.Text>
          角色：<Typography.Text strong>{role?.name}</Typography.Text>
        </Typography.Text>
        <Alert type="warning" showIcon message="权限变更可能影响用户访问，请确认后再保存。" />
        {incomplete ? (
          <Alert type="info" showIcon message="可用权限超过单页上限，当前列表不完整，请联系管理员处理。" />
        ) : null}
        {failed ? (
          <Alert type="error" showIcon message="权限数据加载失败" action={<a onClick={retry}>重新加载</a>} />
        ) : loading ? (
          <Spin />
        ) : (
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item name="permission_ids" label="权限">
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="请选择权限"
                options={options.map((permission) => ({
                  value: permission.id,
                  label: permission.is_enabled
                    ? `${permission.display_name}（${permission.name}）`
                    : `${permission.display_name}（已禁用）`,
                  disabled: !permission.is_enabled
                }))}
              />
            </Form.Item>
          </Form>
        )}
      </Space>
    </Modal>
  );
}

function mergePermissionOptions(available: AdminPermissionSummary[], assigned: AdminPermissionSummary[]) {
  const permissions = new Map<number, AdminPermissionSummary>();
  for (const permission of available) permissions.set(permission.id, permission);
  for (const permission of assigned) if (!permissions.has(permission.id)) permissions.set(permission.id, permission);
  return Array.from(permissions.values());
}
