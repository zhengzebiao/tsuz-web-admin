# admin-roles 角色管理模块执行记录

> 状态：部分完成
>
> 实施方案：[ADMIN_ROLES_IMPLEMENTATION_PLAN.md](./ADMIN_ROLES_IMPLEMENTATION_PLAN.md)
>
> 执行日期：2026-09-02

## 实际修改

- `apps/app/src/services/admin-roles-api.ts`：新增角色列表、创建、详情、编辑、启用、禁用、权限读取/替换和关联用户 API 类型与请求函数。
- `apps/app/src/pages/AdminRolesPage.tsx`：实现角色列表、筛选、分页、创建/编辑/详情/启用/禁用，以及权限、关联用户操作入口。
- `apps/app/src/pages/admin-roles/RolePermissionsModal.tsx`：实现权限并行加载、多选、禁用权限保留、version 提交、重试和反馈。
- `apps/app/src/pages/admin-roles/RoleUsersModal.tsx`：实现关联用户只读分页表格和筛选。
- `apps/app/src/services/admin-roles-api.test.ts`：覆盖角色 API 契约和创建角色请求。
- `apps/app/src/pages/AdminRolesPage.test.tsx`：覆盖角色列表和创建角色入口/表单。
- `apps/app/src/pages/admin-roles/RolePermissionsModal.test.tsx`：覆盖权限回填和权限 version 提交。
- `apps/app/src/pages/admin-roles/RoleUsersModal.test.tsx`：覆盖关联用户只读表格。
- `plan/ADMIN_ROLES_IMPLEMENTATION_PLAN.md`：新增角色模块实施方案。
- `plan/ADMIN_ROLES_IMPLEMENTATION_EXECUTION.md`：新增角色模块执行记录。

## 关键行为

- 创建角色使用 `POST /admin/roles`，表单校验名称 1–64 字符、描述最多 255 字符。
- 角色列表使用服务端分页和关键词/启用状态筛选。
- 启用使用无 body 二次确认；禁用使用可选 reason 表单并发送 `{ reason: string | null }`。
- 权限替换使用权限查询响应 version，不复用角色资料 version；支持空数组。
- 关联用户为只读，不修改用户角色。
- 未实现角色删除、权限创建、角色用户写操作及批量功能。

## 验证结果

| 命令                                                                                                                                                                                                                      | 结果                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-roles-api.test.ts src/pages/AdminRolesPage.test.tsx src/pages/admin-roles/RolePermissionsModal.test.tsx src/pages/admin-roles/RoleUsersModal.test.tsx` | 通过，9 tests                                      |
| `pnpm --filter tsuz-web-admin-app lint`                                                                                                                                                                                   | 通过                                               |
| 改动源文件 Prettier check                                                                                                                                                                                                 | 通过                                               |
| `pnpm lint`                                                                                                                                                                                                               | 通过                                               |
| `pnpm test`                                                                                                                                                                                                               | 通过，workspace 全部通过                           |
| `pnpm build`                                                                                                                                                                                                              | 通过；Vite 有单 chunk 超过 500 kB 的非阻塞 warning |

测试运行存在 Ant Design `useForm` 连接 warning，但无失败和 unhandled error。

## 未执行与遗留

- 未执行真实测试 API 的创建、编辑、启用/禁用或权限替换写操作：没有受控管理员凭证和明确授权。
- 权限选项固定读取前 100 条，超过上限时提示列表不完整，未实现后端分页搜索联动。
- 尚未新增浏览器端到端测试，当前通过 Vitest、TypeScript 和构建验证。

## 阶段结论

角色模块核心代码、创建角色能力、权限分配、关联用户查询和本地质量门禁均已完成；真实环境写操作仍待授权联调，因此阶段标记为“部分完成”。
