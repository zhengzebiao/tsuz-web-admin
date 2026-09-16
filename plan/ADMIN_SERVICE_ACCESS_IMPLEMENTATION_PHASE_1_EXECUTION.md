# 管理端服务访问管理：第 1 阶段“应用管理”执行记录

> 状态：部分完成；代码与本地质量门禁已完成，真实环境读写联调待执行
>
> 执行日期：2026-09-16
>
> 总实施方案：[管理端服务访问管理实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[第 1 阶段“应用管理”实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_PLAN.md)

## 1. 执行范围与结论

本次根据总方案完成第 1 阶段“应用管理”的代码、自动化测试、浏览器只读检查和文档同步。

阶段结论：Apps 的列表、创建、详情、编辑、启用/禁用及初始 Secret 一次性展示已落地，本地质量门禁全部通过；由于本地 API 未允许 `http://127.0.0.1:7201` 跨域且未提供受控管理员认证/写操作授权，真实 API 读取和写操作仍待环境验收，因此阶段状态为“部分完成”。

本阶段实际完成：

1. 新增 Apps API 类型和六个纳入范围的请求函数，严格使用数字记录 `id` 作为 Apps 写操作路径参数；
2. 新增 `/apps` 页面、导航和路由，实现筛选、分页、创建、详情、编辑、启用/禁用及失败重试；
3. 创建成功后一次性展示初始 Secret，结果只保存在页面局部状态，关闭弹窗立即卸载并清除；
4. 明确没有实现 regenerate-secret 类型、请求函数、路由或 UI；
5. 补充 API、页面和导航测试，并完成 lint、格式、全量测试、构建与浏览器只读检查；
6. 修复宽表格撑开管理页导致右上角操作按钮不可见的问题，并校准一个既有 permissions 分页测试的失效断言。

本阶段明确未实现或未执行：

- 未实现 Resource Scopes、Service Grants、Apps 删除、批量操作或 regenerate-secret；
- 未执行真实创建、编辑、启用或禁用请求；
- 未完成真实 Apps 列表读取：浏览器请求被本地 API CORS 策略阻止；
- 未执行部署、生产检查或后端改造。

## 2. 实际代码与配置变更

### 2.1 Apps API 契约

- [`apps/app/src/services/admin-apps-api.ts`](../apps/app/src/services/admin-apps-api.ts)：新增 `AdminApp`、列表/创建/更新/动作响应类型，以及列表、创建、详情、编辑、禁用、启用请求；
- [`apps/app/src/services/admin-apps-api.test.ts`](../apps/app/src/services/admin-apps-api.test.ts)：覆盖分页筛选、空关键词、创建请求、数字记录 ID、PATCH `version`、禁用原因规范化和 enable 无 body。

关键实现：

```text
GET /admin/apps?page&page_size&keyword&is_enabled
POST /admin/apps → { app, app_secret }
GET/PATCH /admin/apps/{数字记录 id}
POST /admin/apps/{数字记录 id}/disable → { reason: string | null }
POST /admin/apps/{数字记录 id}/enable → 无 body
```

Service 中没有 regenerate-secret 相关类型或请求函数。

### 2.2 应用管理页面

- [`apps/app/src/pages/AdminAppsPage.tsx`](../apps/app/src/pages/AdminAppsPage.tsx)：新增应用分页表格、筛选、失败重试、创建/详情/编辑弹窗、启用/禁用操作及初始 Secret 结果弹窗；
- [`apps/app/src/pages/AdminAppsPage.test.tsx`](../apps/app/src/pages/AdminAppsPage.test.tsx)：覆盖筛选分页、创建请求规范化、Secret 展示和清除、详情/编辑 ID 与 version、禁用失败不乐观更新、启用确认及无 regenerate-secret 入口。

关键行为：

```text
创建表单提交
  ↓
POST /admin/apps 成功
  ↓
先把 { app, app_secret } 放入页面局部状态并展示结果弹窗
  ↓
再失效 Apps 列表查询；刷新失败不隐藏 Secret
  ↓
管理员确认已保存并关闭
  ↓
结果组件直接卸载，Secret 从页面状态和 DOM 移除
```

- 列表和详情数据由 TanStack Query 管理；Secret 不进入 Query Cache、Zustand、Storage 或 URL；
- Switch 使用服务端查询值，不做乐观更新；失败时保留原状态；
- 创建和编辑字段提交前去除首尾空白，可选空 Icon URL 转为 `null`；
- URL 仅按文本展示，不加载远程图标或自动打开外链；
- 筛选控件补充可访问名称。

### 2.3 路由、导航与样式

- [`apps/app/src/App.tsx`](../apps/app/src/App.tsx)：新增“应用管理”菜单和 `/apps` 路由；
- [`apps/app/src/App.test.tsx`](../apps/app/src/App.test.tsx)：导航覆盖扩展为 users、roles、permissions、apps 四项；
- [`apps/app/src/styles/main.css`](../apps/app/src/styles/main.css)：加入 Apps 分页居中规则，并为共享管理 Card 设置 `min-width: 0`，使宽表格在自身容器滚动而不撑开整个页面；
- [`apps/app/src/pages/AdminPermissionsPage.test.tsx`](../apps/app/src/pages/AdminPermissionsPage.test.tsx)：把基线中依赖过期 Ant Design 内部样式/角色的断言改为稳定的滚动表体存在和分页 class 断言，未修改权限页业务行为；
- [`README.md`](../README.md)：更新管理页面职责和当前四项导航说明，移除已过时的占位页描述。

### 2.4 数据、迁移和状态

不涉及数据库、缓存、队列、迁移或持久状态变更。初始 Secret 仅存在于创建响应和页面局部状态；本次没有产生真实 Secret 或服务端业务数据。

### 2.5 API、Schema 或公共契约

本阶段未改变后端或 workspace 公共契约，只新增前端领域类型与调用封装。现有 `MicroAppProps`、API 基地址、Bearer Token 注入和 401 logout 行为保持不变。

### 2.6 配置、依赖和外部服务

- 未新增配置、依赖或锁文件变化；
- 浏览器检查临时使用 `VITE_API_BASE_URL=http://127.0.0.1:8000` 启动开发服务器，没有写入仓库配置；
- 本地 API 真实 GET 因缺少允许 `http://127.0.0.1:7201` 的 CORS 响应头而失败；
- 没有调用任何真实 POST、PATCH 或状态写接口；
- 没有记录真实 Token 或 Secret。

## 3. 关键设计结果

1. Apps 接口路径参数使用响应中的数字 `id`，字符串 `app_id` 作为业务标识展示，并作为后续 Scope/Grant 的候选值；
2. 创建 Secret 采用一次性局部状态结果弹窗，关闭时直接卸载而不是等待 Modal 关闭动画，保证 Secret 立即离开 DOM；
3. 写操作统一在成功后失效 `admin-apps` 查询，失败不做乐观更新；
4. 后续 Resource Scopes 阶段可直接复用 `listAdminApps` 获取目标应用选项；
5. regenerate-secret 仍是明确非目标，源码搜索未发现对应能力。

## 4. 与阶段计划的差异

| 差异                | 计划内容                  | 实际实施                             | 原因                                                                                               | 影响与处理                                |
| ------------------- | ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Secret 弹窗清除方式 | 关闭时清除局部结果状态    | 结果存在时才挂载弹窗，关闭后直接卸载 | Ant Design 关闭动画会短暂保留 DOM；敏感值需要立即清除                                              | 强化安全要求，不改变接口范围              |
| 管理 Card 宽度      | 只增加 Apps 分页样式      | 额外设置共享 Card `min-width: 0`     | 浏览器检查发现宽表格把 Card 撑到 1630px，使创建按钮移出视口                                        | 最小兼容修正，同时改善已有宽表格布局      |
| Permissions 测试    | 不计划修改                | 校准一个基线分页断言                 | `HEAD` 页面滚动为 450px，但测试断言 500px；当前 Ant Design 的分页角色也是 `list` 而非 `navigation` | 仅修复测试与真实 DOM 的不一致，无业务变更 |
| 浏览器 API 验证     | 只读验证 `/apps` 和错误态 | 页面通过，真实 GET 被 CORS 阻止      | 本地 API 未允许 7201 源                                                                            | 记录为待环境验证，不伪装为联调通过        |

上述调整没有扩大到 Resource Scopes、Service Grants、删除或 regenerate-secret。

## 5. 测试与验证结果

### 5.1 验证汇总

| 检查              | 命令或方法                                                                                                                                                                     | 结果     | 证据/说明                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| 定向测试          | `pnpm --filter tsuz-web-admin-app test -- --run src/services/admin-apps-api.test.ts src/pages/AdminAppsPage.test.tsx src/App.test.tsx src/pages/AdminPermissionsPage.test.tsx` | 通过     | 4 files，18 tests                                                           |
| Lint/类型         | `pnpm lint`                                                                                                                                                                    | 通过     | 4 个 workspace package 均通过 TypeScript no-emit 检查                       |
| 新增/修改文件格式 | `pnpm exec prettier --check ...`                                                                                                                                               | 通过     | 本阶段 TypeScript、CSS 和 Markdown 文件全部匹配                             |
| 仓库格式门禁      | `pnpm format:check`                                                                                                                                                            | 通过     | 仓库脚本覆盖的配置文件全部匹配                                              |
| 全量测试          | `pnpm test`                                                                                                                                                                    | 通过     | App 15 files / 51 tests；API 3 tests；Shared 3 tests；UI 无已配置测试       |
| 构建              | `pnpm build`                                                                                                                                                                   | 通过     | Vite 成功构建；存在单 chunk 超过 500 kB 的非阻塞警告                        |
| Diff 检查         | `git diff --check`                                                                                                                                                             | 通过     | 无空白错误                                                                  |
| 浏览器只读检查    | DevTools 打开 `http://127.0.0.1:7201/apps`                                                                                                                                     | 部分通过 | 路由、导航、筛选、表头、创建表单、错误重试和布局通过；真实 GET 受 CORS 阻止 |

### 5.2 失败与未执行项

- 首次全量测试发现既有 [`AdminPermissionsPage.test.tsx`](../apps/app/src/pages/AdminPermissionsPage.test.tsx) 对表格高度和分页角色的断言与 `HEAD` 页面/current Ant Design DOM 不一致；校准断言后全量测试通过；
- 浏览器真实列表读取未通过：本地 API 响应缺少允许 7201 源的 CORS 头；
- 未执行真实创建、编辑、启用和禁用：缺少受控认证、写操作授权和测试数据恢复方案；
- 全量测试仍输出既有 users/roles/permissions 的 Ant Design `Spin tip`/未连接 Form warning；本次新增 Apps 页面不再产生这两类 warning，且所有测试无 unhandled error；
- 构建存在仓库既有的大 chunk 非阻塞 warning，本阶段未引入代码拆分改造。

### 5.3 真实环境或人工验证

| 验证项             | 环境             | 副作用/授权            | 结果                                                              |
| ------------------ | ---------------- | ---------------------- | ----------------------------------------------------------------- |
| `/apps` 路由和布局 | 本地 Vite `7201` | 无写副作用             | 通过；布局修正后文档宽度 1440px，创建按钮可见，宽表格在容器内滚动 |
| Apps GET           | 本地 API `8000`  | 只读                   | 未通过；CORS 阻止浏览器读取                                       |
| 创建表单字段       | 本地 Vite        | 只打开弹窗，不提交     | 通过；字段为 name、service account、access URL、可选 icon URL     |
| Apps 写操作        | 未执行           | 需要受控账号与明确授权 | 未执行；网络记录只有 GET，没有 POST/PATCH                         |

## 6. 阶段验收结果

| 编号     | 验收标准                                               | 结果                      | 验证证据                                                        |
| -------- | ------------------------------------------------------ | ------------------------- | --------------------------------------------------------------- |
| AC-1-01  | Apps 列表分页和筛选映射正确，失败可重试                | 通过（Mock/浏览器错误态） | `admin-apps-api.test.ts`、`AdminAppsPage.test.tsx` 与浏览器快照 |
| AC-1-02  | 创建、详情、编辑、启用和禁用调用正确接口               | 通过（Mock）              | API 与页面定向测试                                              |
| AC-1-03  | 数字 `id` 与字符串 `app_id` 不混用，编辑携带 `version` | 通过                      | `admin-apps-api.test.ts` 与页面编辑断言                         |
| AC-1-04  | 初始 Secret 只在创建结果弹窗展示，关闭后清除           | 通过（Mock）              | `AdminAppsPage.test.tsx` 的展示/关闭断言                        |
| AC-1-05  | Service 和页面不存在 regenerate-secret 能力            | 通过                      | 源码搜索无结果；页面测试无入口                                  |
| AC-1-06  | `/apps` 导航可用且旧三路由回归通过                     | 通过                      | `App.test.tsx` 5 tests 与浏览器检查                             |
| AC-1-07  | 定向、lint、格式、全量测试和构建通过                   | 通过                      | 第 5.1 节命令结果                                               |
| AC-1-ENV | 真实 API 读取和受控写操作完成                          | 待环境验证                | GET 受 CORS 阻止；写操作未授权                                  |

本地必需验收项已通过；按照项目现有阶段口径，真实环境联调未完成前阶段保持“部分完成”。

## 7. 安全、兼容性与可观测性核对

### 安全

- Bearer Token、API base URL 和 401 logout 继续复用现有 API Client；
- 初始 Secret 未写入 Query Cache、Store、Storage、URL、日志或文档，关闭结果弹窗即从组件状态和 DOM 清除；
- 浏览器检查没有产生真实 Secret，也没有发送写请求；
- 外部 URL 只显示文本，不自动加载或跳转；
- regenerate-secret 不存在于本阶段源码。

### 兼容性

- `/users`、`/roles`、`/permissions` 路由测试继续通过；
- standalone 和 qiankun 公共契约未修改；
- 无依赖、锁文件、数据库或配置迁移；
- `min-width: 0` 只约束共享 Card 不被宽表格撑开，表格仍保留内部横向滚动。

### 可观测性

- 本阶段未新增日志、指标或追踪；
- 操作失败通过 Ant Design message 和页面重试态反馈；
- 真实 CORS 失败从浏览器 Network/Console 得到证据，但没有写入敏感响应内容。

## 8. 遗留问题与后续阶段入口

### 8.1 当前阶段遗留问题

| 问题                                    | 影响                         | 负责人/条件                            | 处理阶段        |
| --------------------------------------- | ---------------------------- | -------------------------------------- | --------------- |
| 本地 API 未允许 `127.0.0.1:7201` Origin | 本地直连 8000 无法读取列表   | 本地 CORS、同源代理或实际宿主环境      | 受控联调        |
| 缺少受控管理员 Token 和写操作授权       | 无法验证真实创建、编辑和启停 | 提供受控账号、测试命名与恢复方案       | 发布前/受控联调 |
| 既有测试仍有 Ant Design warning         | 测试输出有噪声，但不失败     | 可在独立维护任务中调整既有组件挂载方式 | 非本阶段阻塞    |
| 构建单 chunk 超过 500 kB                | 首屏包较大警告               | 独立性能/拆包评估                      | 非本阶段阻塞    |

### 8.2 下一阶段可复用能力

- `listAdminApps` 可作为 Resource Scopes 的 `target_app_id` 可搜索候选数据源；
- 选项显示可组合 `name` 和字符串业务 `app_id`，提交必须使用 `app_id` 而不是数字记录 `id`；
- 后续阶段仍不得引入 regenerate-secret；
- 第二阶段开始前需重新读取 OpenAPI，并处理 Apps 选项分页上限与真实环境 CORS/权限条件。

## 9. 文档同步记录

- [总实施方案](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PLAN.md)：更新第一阶段状态、计划/执行记录链接、验收结论和下一阶段入口；
- [第一阶段实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_PLAN.md)：更新阶段状态、验收结果和实际设计调整；
- 本执行记录：记录实际代码、验证结果、计划偏差、环境限制和遗留问题。

## 10. 阶段结论

第 1 阶段部分完成：

- Apps 前端管理能力、初始 Secret 安全交付和 regenerate-secret 排除边界已经落地；
- 定向测试、lint、格式、全量测试、构建和 diff 检查全部通过；
- 浏览器页面与错误态通过，真实 API GET 受 CORS 阻止，所有真实写操作均未执行；
- 可以开始准备第二阶段 Resource Scopes 的实现计划，但在宣称第一阶段完整验收或发布前，仍需完成受控真实环境联调。
