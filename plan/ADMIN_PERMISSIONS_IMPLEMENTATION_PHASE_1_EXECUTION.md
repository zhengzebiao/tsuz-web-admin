# admin-permissions 第一阶段执行记录

> 状态：部分完成，待本地依赖安装后验证
>
> 阶段计划：[ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 总方案：[ADMIN_PERMISSIONS_IMPLEMENTATION_PLAN.md](./ADMIN_PERMISSIONS_IMPLEMENTATION_PLAN.md)
>
> 执行日期：2026-09-02

## 1. 实际修改

- `apps/app/src/services/admin-permissions-api.ts`：新增权限类型、列表/详情/编辑/启用/禁用请求函数。
- `apps/app/src/services/admin-permissions-api.test.ts`：覆盖 query、路径、PATCH version、禁用 reason 和 enable 无 body。
- `apps/app/src/pages/AdminPermissionsPage.tsx`：实现分页筛选表格、启用 Switch、禁用原因表单、启用确认、详情 endpoints 和编辑弹窗。
- `apps/app/src/pages/AdminPermissionsPage.test.tsx`：覆盖列表筛选、Switch 分流、详情、编辑和操作列。
- `plan/ADMIN_PERMISSIONS_IMPLEMENTATION_PLAN.md`：新增权限模块总方案。
- `plan/ADMIN_PERMISSIONS_IMPLEMENTATION_PHASE_1_PLAN.md`：新增第一阶段实现计划。

## 2. 关键行为

- 列表使用 `GET /admin/permissions`，支持关键词、资源、声明状态和启用状态筛选及服务端分页。
- `is_enabled` 使用 Switch；禁用先打开可选 reason 表单，启用使用确认弹窗。
- 详情和编辑均位于操作列；详情展示安全字段和 endpoints，编辑提交 `display_name`、`description` 与 `version`。
- mutation 成功后失效列表查询，失败只提示不乐观更新；认证和 401 处理复用现有 API client。
- 未实现创建、删除、批量和角色权限管理。

## 3. 验证结果

| 命令                                                                                                                                | 结果                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                    | 通过；workspace 依赖已安装                         |
| `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-permissions-api.test.ts src/pages/AdminPermissionsPage.test.tsx` | 通过，7 tests；有 Ant Design 非失败 warning        |
| `pnpm lint`                                                                                                                         | 通过                                               |
| `pnpm exec prettier --ignore-unknown --check ...`                                                                                   | 通过                                               |
| `pnpm test`                                                                                                                         | 通过，workspace 全部通过；app 31 tests             |
| `pnpm build`                                                                                                                        | 通过；Vite 有单 chunk 超过 500 kB 的非阻塞 warning |
| `git diff --check`                                                                                                                  | 通过                                               |

## 4. 未执行与遗留

- 未执行测试 API 真实写操作：需要有效 Bearer token、受控管理员账号和明确授权。
- 未新增浏览器端到端测试；页面交互由 Vitest/Testing Library 覆盖。
- 测试环境出现 Ant Design 的 `Spin tip` 和 `useForm` 生命周期 warning，未造成测试失败或 unhandled error。

## 5. 阶段结论

权限 API 接入、页面 UI、定向测试和本地质量门禁已完成。由于真实测试环境写操作未执行，本阶段仍保持“部分完成”，待受控联调后再更新整体验收状态。
