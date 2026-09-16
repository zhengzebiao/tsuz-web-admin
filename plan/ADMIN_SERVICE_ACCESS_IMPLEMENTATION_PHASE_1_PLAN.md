# 管理端服务访问管理：第 1 阶段“应用管理”实现计划

> 状态：部分完成；代码与本地质量门禁已完成，真实环境读写联调待执行
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[第 1 阶段“应用管理”执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)
>
> 范围：接入 `admin-apps` 列表、创建、详情、编辑、启用/禁用与初始 Secret 一次性展示；不提前实现 Resource Scopes、Service Grants 或 regenerate-secret。

## 1. 背景与阶段基准

### 1.1 前置阶段状态

本功能没有前置开发阶段。可直接复用：

- [`apps/app/src/services/api-client.ts`](../apps/app/src/services/api-client.ts) 的 API 基地址、Bearer Token 和 401 处理；
- [`apps/app/src/stores/app.store.ts`](../apps/app/src/stores/app.store.ts) 的 standalone/qiankun 宿主参数；
- [`apps/app/src/pages/AdminRolesPage.tsx`](../apps/app/src/pages/AdminRolesPage.tsx) 的创建、详情、编辑和状态操作模式；
- [`apps/app/src/pages/AdminPermissionsPage.tsx`](../apps/app/src/pages/AdminPermissionsPage.tsx) 的分页筛选、详情查询和错误重试模式；
- TanStack Query、Ant Design 和 `PageContainer`。

### 1.2 当前仓库事实

- 实施前 Git 工作区干净，当前分支为 `main`；
- 依赖已安装，不需要新增依赖或修改锁文件；
- 当前导航只有 `/users`、`/roles`、`/permissions`；
- 2026-09-16 读取的 OpenAPI 暴露 Apps 列表、创建、详情、编辑、启用、禁用和 regenerate-secret；
- 用户明确排除 regenerate-secret；
- OpenAPI 使用数字记录 `id` 作为详情/写操作路径参数，响应另有字符串业务 `app_id`；
- 创建响应包含 `app` 和只能在该响应取得的 `app_secret`。

### 1.3 本阶段目标

1. 在 `/apps` 提供可测试的应用管理完整页面；
2. 正确映射六个纳入范围的 Apps 接口和并发 `version`；
3. 安全交付创建时的初始 Secret，关闭后清除；
4. 保持现有三个管理模块和 qiankun/standalone 契约不变；
5. 补齐定向、全量测试及三类实施文档。

## 2. 范围与约束

### 2.1 本阶段实现

- Apps 关键词/启用状态筛选、20 条服务端分页、空态、失败和重试；
- 创建 App 及初始 Secret 一次性结果弹窗；
- App 详情和资料编辑；
- 启用 Switch、禁用原因表单与启用确认；
- `/apps` 导航和路由；
- API、页面、导航测试；
- 总方案、阶段计划和执行记录同步。

### 2.2 本阶段明确不实现

- `POST /admin/apps/{app_id}/regenerate-secret` 的类型、函数、按钮或弹窗；
- Apps 删除、批量操作、导入导出；
- Resource Scopes 和 Service Grants 的 Service、页面或路由；
- 后端、数据库、部署配置或权限策略改造；
- 未经明确授权的真实环境创建、编辑、启停操作。

### 2.3 已确认约束

- `name`、`service_account_name` 为 1–128 字符；
- `access_url` 必填且为最长 2048 的 URI；`icon_url` 可空，否则同样为最长 2048 的 URI；
- PATCH 始终携带当前正整数 `version`；
- disable 请求体必须存在，空原因发送 `null`；enable 无请求体；
- Apps 接口路径使用数字 `id`，字符串 `app_id` 只展示并为后续阶段提供引用；
- Secret 只存页面局部状态，不进入 Query Cache、Zustand、Storage、URL 或日志；
- 外部 URL 仅显示文本，不加载远程图标或自动打开链接。

### 2.4 临时数据与隔离测试规则

- API 和页面自动化测试全部使用 Mock，不访问长期保留的开发、测试或生产 API；
- 测试 Secret 使用固定非生产占位值，不输出到日志；
- 本阶段不涉及 PostgreSQL、Redis、迁移或临时基础设施；
- 如后续获授权执行真实联调，需使用受控测试 App 命名和明确清理/恢复方案，并单独记录副作用。

### 2.5 前置依赖与环境条件

| 依赖           | 所需状态             | 当前状态                  | 不满足时的处理                   |
| -------------- | -------------------- | ------------------------- | -------------------------------- |
| Apps OpenAPI   | 路径和 Schema 可读取 | 已满足；2026-09-16 已读取 | 契约漂移则暂停写操作并更新计划   |
| 前端依赖       | 已安装且可运行测试   | 已满足                    | 报告环境阻塞，不跳过质量门禁     |
| 真实管理员凭证 | 仅真实联调需要       | 未提供/未授权             | 只执行 Mock 测试，标记待环境验证 |

## 3. 详细设计与修改文件

### 3.1 Apps API Service

新增：

- `apps/app/src/services/admin-apps-api.ts`：OpenAPI 类型和六个请求函数；
- `apps/app/src/services/admin-apps-api.test.ts`：路径、方法、query、body、数字 ID、`version` 和空原因测试。

设计：

1. 列表空关键词映射为 `undefined`，布尔 `false` 不丢失；
2. 创建原样提交经过页面规范化的字段；
3. 详情、PATCH、disable、enable 均接收数字记录 ID；
4. disable 将空白原因规范化为 `null`；
5. 不定义 regenerate-secret 类型和请求函数。

### 3.2 应用管理页面

新增：

- `apps/app/src/pages/AdminAppsPage.tsx`：列表、筛选、分页、创建/详情/编辑/状态弹窗和 Secret 结果；
- `apps/app/src/pages/AdminAppsPage.test.tsx`：核心查询、交互、安全和失败边界。

设计：

- 列表 query key 包含页码和已应用筛选；详情 query 按数字记录 ID 隔离；
- 表格展示记录 ID、应用名称/业务 App ID、Service Account、Access URL、状态、Secret 更新时间、创建/更新时间；
- Switch 由查询结果控制，不做乐观写入；关闭时打开可选原因表单，开启时二次确认；
- 编辑使用当前实体的 `version`，成功后刷新列表；
- 创建成功先把 `{ app, app_secret }` 保存到页面局部结果状态并打开结果弹窗，再触发列表失效；
- 结果弹窗明确提示 Secret 关闭后无法再次查看，提供复制能力；关闭时把完整结果设为 `undefined`；
- URL 按文本展示，避免远程资源加载和不安全跳转。

### 3.3 导航和样式

修改：

- `apps/app/src/App.tsx`：增加“应用管理”和 `/apps`；
- `apps/app/src/App.test.tsx`：增加导航覆盖并把菜单数量更新为 4；
- `apps/app/src/styles/main.css`：将 Apps 分页类加入既有居中规则，并让共享管理 Card 可在 Grid 中收缩，宽表格仅在内部横向滚动；
- `apps/app/src/pages/AdminPermissionsPage.test.tsx`：校准阻塞全量门禁的既有分页 DOM 断言，不改变权限页行为；
- `README.md`：更新已实现的管理页和四项导航说明。

不重命名已有 `admin-users-*` 通用样式，避免无关重构。

### 3.4 数据、迁移或状态

不涉及数据库、缓存、队列或持久状态迁移。Secret 局部状态生命周期：

```text
POST 创建成功
  ↓
setSecretResult(response)
  ↓
一次性结果 Modal 展示
  ↓
管理员关闭
  ↓
setSecretResult(undefined)，从 DOM 和页面状态移除
```

### 3.5 API、Schema 或公共契约

本阶段不改变后端或共享公共契约，只消费：

- `GET/POST /admin/apps`；
- `GET/PATCH /admin/apps/{app_id}`；
- `POST /admin/apps/{app_id}/disable`；
- `POST /admin/apps/{app_id}/enable`。

### 3.6 配置、依赖和外部服务

- 不新增依赖、配置、环境变量或锁文件变化；
- 复用现有 API Client；
- 本地 OpenAPI 地址不进入应用运行配置；
- 自动测试不发起真实 HTTP 写请求。

### 3.7 安全、权限与可观测性

- 后端 Bearer 权限为最终授权边界，前端不绕过 401/403；
- 不输出 Secret、Token 或完整敏感错误内容；
- Secret 不进入全局/持久状态，关闭结果弹窗即清除；
- 写操作按钮在提交期间禁用，避免同一弹窗重复提交；
- 本阶段不新增日志、指标或追踪。

## 4. 实施步骤

1. 创建总方案和本阶段计划；
2. 实现 Apps API 类型、函数和映射测试；
3. 实现列表、筛选、分页和错误态；
4. 实现创建、一次性 Secret、详情、编辑和启停操作；
5. 接入 `/apps` 导航、路由和最小样式；
6. 补充页面/导航测试并按由窄到宽顺序验证；
7. 创建执行记录并同步总方案、阶段计划状态。

## 5. 测试与验证计划

### 5.1 定向测试

| 测试文件/范围            | 覆盖行为                                       | 预期结果                                |
| ------------------------ | ---------------------------------------------- | --------------------------------------- |
| `admin-apps-api.test.ts` | 六个接口的 path/query/body/version             | 与 OpenAPI 一致且没有 regenerate-secret |
| `AdminAppsPage.test.tsx` | 列表、筛选、分页、弹窗、Secret、安全和失败状态 | UI 行为稳定、失败不误改状态             |
| `App.test.tsx`           | `/apps` 导航与菜单数量                         | 四个管理入口均可进入                    |

### 5.2 回归与质量检查

```bash
pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-apps-api.test.ts src/pages/AdminAppsPage.test.tsx src/App.test.tsx src/pages/AdminPermissionsPage.test.tsx
pnpm lint
pnpm format:check
pnpm test
pnpm build
git diff --check
git status --short
```

对本阶段新增的 TypeScript/Markdown 文件另执行 Prettier 格式化/检查；仓库 `format:check` 的既有脚本只覆盖指定配置文件，其结果不能替代新增文件检查。

### 5.3 真实环境验证

真实列表读取需要有效 Token；创建、编辑、启停有持久副作用，且创建 Secret 无法再次查询。本阶段未经用户额外授权不执行，执行记录标记“未执行/待受控联调”，不进入普通 CI。

## 6. 验收标准与追踪

| 编号     | 验收标准                                               | 实现位置     | 验证方式       | 状态       |
| -------- | ------------------------------------------------------ | ------------ | -------------- | ---------- |
| AC-1-01  | Apps 列表分页和筛选映射正确，失败可重试                | Service/Page | API 与页面测试 | 已满足     |
| AC-1-02  | 创建、详情、编辑、启用和禁用调用正确接口               | Service/Page | API 与页面测试 | 已满足     |
| AC-1-03  | 数字 `id` 与字符串 `app_id` 不混用，编辑携带 `version` | Service/Page | API 测试与断言 | 已满足     |
| AC-1-04  | 初始 Secret 只在创建结果弹窗展示，关闭后清除           | Page         | 组件测试       | 已满足     |
| AC-1-05  | Service 和页面不存在 regenerate-secret 能力            | Service/Page | 搜索与组件测试 | 已满足     |
| AC-1-06  | `/apps` 导航可用且旧三路由回归通过                     | App          | `App.test.tsx` | 已满足     |
| AC-1-07  | 定向、lint、格式、全量测试和构建通过                   | Workspace    | 质量门禁命令   | 已满足     |
| AC-1-ENV | 真实 API 读取和受控写操作完成                          | 环境         | 浏览器/人工    | 待环境验证 |

## 7. 风险、回滚与异常处理

| 风险或失败场景         | 影响                  | 预防/检测                 | 回滚或恢复                                |
| ---------------------- | --------------------- | ------------------------- | ----------------------------------------- |
| Secret 关闭前未保存    | 无法由本 UI 找回      | 强提示和复制能力          | 只能由后端受控流程处理；本期无 regenerate |
| 创建成功、列表刷新失败 | 用户误认为创建失败    | 先展示 Secret，再独立刷新 | 保留 Secret 弹窗并允许列表重试            |
| `version` 冲突         | 覆盖他人修改失败      | PATCH 始终带 version      | 刷新后重新编辑                            |
| 状态请求失败           | Switch 与服务端不一致 | 不做乐观更新              | 保留原查询值并重试                        |
| 应用代码回滚           | `/apps` 入口消失      | 无数据迁移                | 回滚镜像；后端数据需人工处理              |

## 8. 阶段交付物

代码与测试：Apps Service、页面、导航、样式及对应测试。

文档：

- 更新 [总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md) 第一阶段状态与链接；
- 更新本阶段计划状态和最终设计调整；
- 创建 [第一阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)。

## 9. 计划调整记录

| 调整项               | 原计划                 | 调整后                                          | 原因                                                            | 对总方案/后续阶段的影响              |
| -------------------- | ---------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------ |
| Secret 关闭清理      | 关闭时清空页面局部状态 | 结果存在时才挂载弹窗，关闭后直接卸载            | Ant Design 关闭动画会短暂保留敏感 DOM                           | 强化安全边界，无范围变化             |
| 宽表格布局           | 只增加 Apps 分页样式   | 共享管理 Card 增加 `min-width: 0`               | 浏览器检查发现宽表格会把创建按钮推离视口                        | 改善三类既有页面与后续页面的容器行为 |
| Permissions 基线测试 | 不修改既有模块         | 校准分页测试的内部样式/角色断言                 | `HEAD` 页面与测试断言、当前 Ant Design DOM 不一致，阻塞全量门禁 | 仅测试兼容修正，无业务影响           |
| 真实环境验证         | 只读检查页面和错误态   | 页面通过；真实 GET 因 CORS 未完成，写操作未执行 | 本地 API 未允许 7201 Origin，且没有写操作授权                   | 阶段保持部分完成，发布前继续追踪     |

上述调整未引入 Resource Scopes、Service Grants、删除或 regenerate-secret 能力。实际结果与证据见[阶段执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)。
