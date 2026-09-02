import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Flex, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import type { ApiClient } from "@tsuz/api";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useState } from "react";
import { listAdminRoleUsers, type AdminRole, type AdminRoleUser } from "../../services/admin-roles-api";

interface RoleUsersModalProps {
  client: ApiClient;
  role?: AdminRole;
  open: boolean;
  onClose: () => void;
}

type Filters = { keyword?: string; is_active?: boolean; is_blacklisted?: boolean };

export default function RoleUsersModal({ client, role, open, onClose }: RoleUsersModalProps) {
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const roleId = role?.id;
  const query = useQuery({
    queryKey: ["admin-roles", "users", roleId, page, filters],
    queryFn: () => listAdminRoleUsers(client, roleId!, { page, page_size: 20, ...filters }),
    enabled: open && roleId !== undefined
  });
  const columns: ColumnsType<AdminRoleUser> = [
    { title: "用户 ID", dataIndex: "id", width: 90 },
    { title: "显示名称", dataIndex: "display_name", render: (value) => value || "未设置显示名称" },
    { title: "邮箱", dataIndex: "email" },
    {
      title: "启用状态",
      dataIndex: "is_active",
      render: (value) => <Tag color={value ? "success" : "default"}>{value ? "已启用" : "已禁用"}</Tag>
    },
    {
      title: "黑名单",
      dataIndex: "is_blacklisted",
      render: (value) => <Tag color={value ? "error" : "success"}>{value ? "已拉黑" : "正常"}</Tag>
    },
    { title: "创建时间", dataIndex: "created_at", render: formatDate, width: 170 }
  ];
  const applyFilters = () => {
    setPage(1);
    setFilters(cleanFilters(draft));
  };
  const resetFilters = () => {
    setPage(1);
    setDraft({});
    setFilters({});
  };
  const onTableChange = (pagination: TablePaginationConfig) => setPage(pagination.current || 1);
  return (
    <Modal
      open={open}
      title={`关联用户：${role?.name || ""}`}
      footer={null}
      width={900}
      onCancel={onClose}
      destroyOnHidden
    >
      <Flex className="admin-users-filters" gap={12} wrap="wrap" align="end">
        <Form.Item label="关键词" className="admin-users-keyword">
          <Input
            value={draft.keyword}
            allowClear
            placeholder="邮箱 / 显示名称 / 用户 ID"
            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
            onPressEnter={applyFilters}
          />
        </Form.Item>
        <Form.Item label="启用状态">
          <Select
            value={toSelectValue(draft.is_active)}
            options={[
              { value: "", label: "全部" },
              { value: "true", label: "已启用" },
              { value: "false", label: "已禁用" }
            ]}
            onChange={(value) => setDraft({ ...draft, is_active: fromSelectValue(value) })}
          />
        </Form.Item>
        <Form.Item label="黑名单状态">
          <Select
            value={toSelectValue(draft.is_blacklisted)}
            options={[
              { value: "", label: "全部" },
              { value: "false", label: "正常" },
              { value: "true", label: "已拉黑" }
            ]}
            onChange={(value) => setDraft({ ...draft, is_blacklisted: fromSelectValue(value) })}
          />
        </Form.Item>
        <Space>
          <Button type="primary" onClick={applyFilters}>
            查询
          </Button>
          <Button onClick={resetFilters}>重置</Button>
        </Space>
      </Flex>
      {query.isError ? (
        <Alert
          type="error"
          message="关联用户加载失败"
          action={
            <Button type="link" onClick={() => query.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : (
        <Table
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data?.items || []}
          columns={columns}
          scroll={{ x: 800 }}
          onChange={onTableChange}
          pagination={{
            current: page,
            pageSize: 20,
            total: query.data?.total || 0,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
          locale={{ emptyText: "暂无关联用户" }}
        />
      )}
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
