# admin-users 第二阶段执行记录

> 状态：部分完成
>
> 阶段计划：[ADMIN_USERS_IMPLEMENTATION_PHASE_2_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PHASE_2_PLAN.md)
>
> 总方案：[ADMIN_USERS_IMPLEMENTATION_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PLAN.md)
>
> 执行日期：2026-09-02

## 实际修改

- `apps/app/src/services/admin-users-api.ts`：新增角色摘要、角色列表、用户角色响应和角色替换请求类型；新增启用角色列表、用户角色读取、用户角色替换请求函数。
- `apps/app/src/pages/AdminUsersPage.tsx`：在列表操作栏“更多”菜单增加“分配角色”，接入角色分配弹窗。
- `apps/app/src/pages/admin-users/UserRolesModal.tsx`：新增角色并行查询、多选表单、已绑定禁用角色保留、数量上限提示、重试、版本提交、成功/失败反馈及相关 query 失效。
- `apps/app/src/services/admin-users-api.test.ts`：覆盖角色 API query、GET/PUT 路径和 body。
- `apps/app/src/pages/admin-users/UserRolesModal.test.tsx`：覆盖角色加载、禁用角色保留、使用角色响应 version 提交和加载失败禁用保存。
- `plan/ADMIN_USERS_IMPLEMENTATION_PHASE_2_PLAN.md`：记录第二阶段实现契约。
- `plan/ADMIN_USERS_IMPLEMENTATION_PHASE_2_EXECUTION.md`：记录实际执行内容。
- `plan/ADMIN_USERS_IMPLEMENTATION_PLAN.md`：待补充第二阶段状态、链接和决策状态。

## 关键行为

- 可选角色通过 `GET /admin/roles?page=1&page_size=100&is_enabled=true` 获取，不提供创建角色入口。
- 用户当前角色通过 `GET /admin/users/{id}/roles` 获取，PUT 使用响应的 `version`。
- 已绑定但已禁用角色合并进选项并标记为“已禁用”；不能新选禁用角色，但可移除。
- 角色变更前显示会话撤销警告，成功后反馈 changed 和 revoked_sessions。
- 角色数据加载失败提供重试，保存按钮禁用；PUT 失败保留弹窗和表单值。

## 验证结果

| 命令                                                                                                                                                                  | 结果                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-users-api.test.ts src/pages/admin-users/UserRolesModal.test.tsx src/pages/AdminUsersPage.test.tsx` | 通过，11 tests                                     |
| `pnpm lint`                                                                                                                                                           | 通过                                               |
| `pnpm exec prettier --check ...`                                                                                                                                      | 通过                                               |
| `pnpm test`                                                                                                                                                           | 通过，app 24 tests；workspace 全部通过             |
| `pnpm build`                                                                                                                                                          | 通过；Vite 有单 chunk 超过 500 kB 的非阻塞 warning |

测试输出存在 Ant Design 测试环境 warning（`Spin tip`、`useForm` 生命周期），未造成测试失败或 unhandled error。

## 未执行与遗留

- 未执行真实测试 API 的角色 PUT/写操作：当前会话没有受控管理员凭证和明确的真实写操作授权。
- 当前角色列表固定读取前 100 个启用角色；接口返回超过 100 条时 UI 会显示不完整提示，未实现后端分页搜索联动。
- 尚未新增浏览器端到端测试；通过 Vitest 组件测试和构建验证。

## 阶段结论

角色 API、角色分配 UI、版本并发保护和本地质量门禁已完成。由于真实测试环境角色替换未执行，阶段保持“部分完成”，不能标记整体方案完成。
