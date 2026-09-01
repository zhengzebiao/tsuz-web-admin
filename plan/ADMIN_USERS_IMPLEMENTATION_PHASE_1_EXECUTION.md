# admin-users 第一阶段执行记录

> 状态：部分完成
>
> 阶段计划：[ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 总方案：[ADMIN_USERS_IMPLEMENTATION_PLAN.md](./ADMIN_USERS_IMPLEMENTATION_PLAN.md)
>
> 执行日期：2026-09-02

## 实际修改

- `apps/app/src/services/admin-users-api.ts`：新增用户列表、创建、详情、资料更新、状态、密码和强制下线 API 类型及请求函数。
- `apps/app/src/pages/AdminUsersPage.tsx`：实现服务端分页列表、关键词/状态筛选、两个状态 Switch、创建/编辑/详情/禁用/拉黑/重置密码/强制下线弹窗及反馈。
- `apps/app/src/providers/AppProviders.tsx`：增加 Ant Design `App` 上下文，为全局 message 提供运行时容器。
- `apps/app/src/styles/main.css`：补充用户页卡片、筛选区和表格横向滚动样式。
- `apps/app/src/services/admin-users-api.test.ts`：覆盖 API 路径、方法、query 和 body 映射。
- `apps/app/src/pages/AdminUsersPage.test.tsx`：覆盖列表渲染、分页总数、状态操作弹窗和创建角色入口排除。
- `apps/app/src/App.test.tsx`：为用户页新增 Query/Ant Design provider，保持导航回归测试有效。
- `apps/app/src/test/setup.ts`：补充 jsdom 对 Ant Design Table 所需的兼容 mock。
- `plan/ADMIN_USERS_IMPLEMENTATION_PHASE_1_PLAN.md`：记录阶段实现契约。

## 关键行为

- `is_active` 和 `is_blacklisted` 在表格使用 Switch。
- 禁用和拉黑先填写 1–500 字符 reason；开启和解禁使用二次确认。
- 强制下线按 API 可选 body 规则使用二次确认，不发送虚构 reason。
- 所有写操作成功后失效用户列表，失败只提示错误且不乐观修改状态。
- 编辑提交当前列表项 version；详情独立请求，不展示密码。
- 未实现创建角色、角色分配、批量、导入导出和删除。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-users-api.test.ts` | 通过，4 tests |
| `pnpm --filter tsuz-web-admin-app test -- --run src/pages/AdminUsersPage.test.tsx` | 通过，3 tests |
| `pnpm lint` | 通过 |
| `pnpm format:check` | 通过 |
| `pnpm test` | 通过，app 20 tests；workspace 全部通过 |
| `pnpm build` | 通过；Vite 报既有/未阻塞的单 chunk 超过 500 kB 警告 |

## 未执行与遗留

- 未执行测试 API 真实写操作：需要有效 Bearer token、受控管理员账号和明确的真实环境操作授权；不能据此宣称联调通过。
- 当前仓库没有自动化真实端到端浏览器测试，因此弹窗流程以组件测试和本地构建验证。
- jsdom 测试会使用 Ant Design/rc-table 的异步布局逻辑；现已补充兼容 mock，定向测试和全量测试无 unhandled error。
- 下一阶段可单独评估用户角色读取/替换，不得加入创建角色接口。

## 阶段结论

代码和本地质量门禁已完成；真实测试环境联调仍待授权和环境条件，故阶段记录为“部分完成”，总方案不应标记为整体完成。
