# 管理端服务访问管理实施方案

> 状态：实施中；第一阶段 `admin-apps` 代码与本地质量门禁已完成，真实环境联调待执行
>
> 本方案基于当前 React + TypeScript + Ant Design + TanStack Query + qiankun 管理子应用，以及 2026-09-16 读取的本地测试 API OpenAPI 契约。
>
> 接口基准：[本地 Swagger UI](http://127.0.0.1:8000/docs) / [本地 OpenAPI JSON](http://127.0.0.1:8000/openapi.json)
>
> 第一阶段：[实现计划](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_PLAN.md) / [执行记录](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)

## 1. 已确认业务配置与关键决策

| 项目        | 决策或配置                                                                                   | 状态/来源                  |
| ----------- | -------------------------------------------------------------------------------------------- | -------------------------- |
| 模块范围    | 按 `admin-apps`、`admin-resource-scopes`、`admin-service-grants` 的依赖顺序接入              | 已确认；用户需求           |
| Apps Secret | 不接入 `POST /admin/apps/{app_id}/regenerate-secret`；创建时返回的初始 Secret 仅一次性展示   | 已确认；用户需求           |
| Apps 标识   | 数字 `id` 用于 Apps 详情/编辑/状态接口；字符串 `app_id` 用于跨模块业务引用                   | 已确认；OpenAPI            |
| Scope 创建  | `target_app_id` 从 Apps 可搜索下拉选择；`scope_code` 由管理员手工填写                        | 已确认；用户确认           |
| Grant 创建  | caller/target 从 Apps 选择，按 target 加载启用 Scope，最终提交 `caller_app_id` 和 `scope_id` | 已确认；用户确认与 OpenAPI |
| 认证        | 复用宿主传入的 API 基地址、Bearer Token 和 401 logout                                        | 已确认；仓库现状           |
| UI          | 复用 users/roles/permissions 的 Table、筛选、Switch、Modal 与分页交互                        | 合理默认；仓库现状         |
| 真实写操作  | 自动测试使用 Mock；受控环境写操作需要有效管理员凭证和单独授权                                | 已确认；安全边界           |

## 2. 背景与现状

### 2.1 背景

管理端需要维护可调用服务的应用、目标服务暴露的 Scope，以及应用到 Scope 的授权关系。第一阶段实施前管理子应用只有用户、角色和权限管理；当前 Apps 管理入口已落地，Scopes 和 Grants 仍待后续阶段接入。

### 2.2 当前架构

- [`apps/app/src/App.tsx`](../apps/app/src/App.tsx)：注册左侧导航和子应用路由；
- [`apps/app/src/services/api-client.ts`](../apps/app/src/services/api-client.ts)：构造带 API 基地址、Bearer Token 和 401 处理的客户端；
- [`apps/app/src/stores/app.store.ts`](../apps/app/src/stores/app.store.ts)：保存 standalone/qiankun 运行时宿主参数；
- [`apps/app/src/providers/query-client.ts`](../apps/app/src/providers/query-client.ts)：提供 TanStack Query 客户端；
- [`apps/app/src/pages/AdminRolesPage.tsx`](../apps/app/src/pages/AdminRolesPage.tsx)：提供创建、详情、编辑和状态操作模式；
- [`apps/app/src/pages/AdminPermissionsPage.tsx`](../apps/app/src/pages/AdminPermissionsPage.tsx)：提供筛选分页、详情查询和失败重试模式；
- [`apps/app/src/pages/AdminAppsPage.tsx`](../apps/app/src/pages/AdminAppsPage.tsx)：第一阶段已新增 Apps 列表、创建、详情、编辑、启停和初始 Secret 一次性展示；
- [`apps/app/src/services/admin-apps-api.ts`](../apps/app/src/services/admin-apps-api.ts)：第一阶段已新增 Apps 领域类型和请求函数，可供第二阶段选项查询复用；
- [`packages/api/src/index.ts`](../packages/api/src/index.ts)：提供通用 GET/POST/PATCH/PUT/DELETE 封装；
- [`packages/ui/src/index.tsx`](../packages/ui/src/index.tsx)：提供 `PageContainer`。

### 2.3 现状差距

1. Apps 的领域 API、页面、路由、导航和初始 Secret 一次性交付已在第一阶段落地，本地质量门禁通过；
2. Resource Scopes 和 Service Grants 的领域 API、页面、路由及测试仍未实现；
3. 后两类操作应复用 Apps 的字符串业务 `app_id`，Grant 还依赖 Scope 的数字 `id`；
4. 本地 API 未允许管理端开发源跨域，第一阶段真实列表读取和写操作尚未联调；
5. Scope 列表最多返回 100 条且不支持按 `scope_code` 搜索，Grant 创建选项可能不完整。

## 3. 目标与非目标

### 3.1 目标

1. 提供 Apps 的分页查询、创建、详情、编辑和启用/禁用管理；
2. 提供 Resource Scopes 的分页查询、创建和启用/禁用管理；
3. 提供 Service Grants 的分页查询、创建和撤销管理；
4. 使用 Apps 和 Scopes 形成受约束的联动选择，避免手工输入既有实体标识；
5. 保持现有认证、路由运行模式和 API Client 契约不变；
6. 为请求映射、页面交互、敏感信息和失败状态补充自动化测试与阶段文档。

### 3.2 非目标

- 不接入 Apps Secret 重新生成接口及 UI；
- 不实现 Apps 删除、Scope 编辑/删除、Grant 编辑/删除/恢复；
- 不实现批量操作、导入导出或审计日志独立页面；
- 不修改后端接口、数据库、权限模型或部署基础设施；
- 不由前端推断 App、Scope、Grant 之间的级联状态；
- 不在未经授权时执行测试环境或生产环境写操作。

## 4. 需求与核心流程

### 4.1 参与者和使用场景

| 参与者 | 前置条件                         | 操作                   | 预期结果                                  |
| ------ | -------------------------------- | ---------------------- | ----------------------------------------- |
| 管理员 | 具备 `admin-apps` 权限           | 创建和维护应用         | 得到业务 `app_id`；初始 Secret 仅展示一次 |
| 管理员 | 存在目标应用                     | 为目标应用声明 Scope   | Scope 与选定的字符串 `app_id` 关联        |
| 管理员 | 存在调用方、目标应用及启用 Scope | 创建服务授权           | 提交调用方 `app_id` 与数字 `scope_id`     |
| 管理员 | 存在有效授权                     | 撤销授权并填写可选原因 | 授权变为服务端返回的撤销状态              |

### 4.2 正常流程

```text
创建/维护 App
  ↓
使用业务 app_id 为目标 App 创建 Resource Scope
  ↓
选择 caller App 与 target App
  ↓
按 target_app_id 加载启用 Scope
  ↓
提交 caller_app_id + scope_id + 可选有效期
  ↓
展示服务端返回的 Grant 状态和审计字段
```

### 4.3 异常与边界流程

- 列表或详情失败：展示失败状态和重试入口，不伪造数据；
- 写操作失败：保留弹窗和服务端原状态，不乐观修改列表；
- `version` 冲突：Apps 编辑以服务端拒绝为准，提示后重新加载最新数据；
- 重复状态操作：根据响应 `changed` 区分实际变更与幂等无变化；
- Apps/Scopes 选择超过 API 的 100 条上限：明确提示可能不完整，不宣称全量；
- 日期：Grant 创建提交 ISO 8601，前端校验到期时间晚于生效时间，最终规则以后端为准；
- 401/403：401 复用宿主 logout；403 作为授权失败展示，不绕过后端权限；
- 创建 App 成功但列表刷新失败：仍先交付一次性 Secret，再允许列表重试。

## 5. 当前架构适配与总体设计

### 5.1 设计原则

- 每个领域使用独立 Service 文件集中维护 OpenAPI 类型和请求映射；
- 页面通过 `useAppStore` 与 `createMfeApiClient` 复用现有认证边界；
- TanStack Query 只缓存非敏感列表和详情，Secret 不进入 Query Cache 或全局 Store；
- 写操作成功后失效对应领域查询，由服务端响应重新建立页面状态；
- 只实现 OpenAPI 已提供且本方案明确纳入的能力，不为后续阶段提前扩展公共接口。

### 5.2 目标架构

```text
App.tsx 导航/路由
  ↓
AdminAppsPage / AdminResourceScopesPage / AdminServiceGrantsPage
  ↓
admin-*-api.ts 领域请求函数
  ↓
createMfeApiClient
  ↓
/admin/apps /admin/resource-scopes /admin/service-grants
```

### 5.3 兼容策略

- 新路由为增量入口，不改变 `/users`、`/roles`、`/permissions`；
- 不改变 `MicroAppProps`、API base URL、Token 注入或 qiankun basename；
- 无数据库迁移，新前端版本可通过回滚镜像/代码撤回；
- 已创建的 App、Scope、Grant 或已撤销的 Grant 是服务端持久副作用，前端回滚不能撤销。

## 6. 接口与外部契约设计

### 6.1 Apps

| 能力 | 接口                                | 关键契约                                                                                        |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| 列表 | `GET /admin/apps`                   | `page`、`page_size`、`keyword`、`is_enabled`                                                    |
| 创建 | `POST /admin/apps`                  | `name`、可选 `icon_url`、`access_url`、`service_account_name`；返回 `app` 和一次性 `app_secret` |
| 详情 | `GET /admin/apps/{app_id}`          | 路径参数实际使用响应中的数字 `id`                                                               |
| 编辑 | `PATCH /admin/apps/{app_id}`        | 可更新资料并必须提交正整数 `version`                                                            |
| 禁用 | `POST /admin/apps/{app_id}/disable` | 请求体中的 `reason` 为字符串或 `null`                                                           |
| 启用 | `POST /admin/apps/{app_id}/enable`  | 无请求体                                                                                        |

`POST /admin/apps/{app_id}/regenerate-secret` 明确不接入，不定义前端调用函数。

### 6.2 Resource Scopes

| 能力 | 接口                                             | 关键契约                                           |
| ---- | ------------------------------------------------ | -------------------------------------------------- |
| 列表 | `GET /admin/resource-scopes`                     | `page`、`page_size`、`target_app_id`、`is_enabled` |
| 创建 | `POST /admin/resource-scopes`                    | `target_app_id`、`scope_code`、`description`       |
| 禁用 | `POST /admin/resource-scopes/{scope_id}/disable` | 无请求体；响应包含 `changed`                       |
| 启用 | `POST /admin/resource-scopes/{scope_id}/enable`  | 无请求体；响应包含 `changed`                       |

### 6.3 Service Grants

| 能力 | 接口                                           | 关键契约                                                     |
| ---- | ---------------------------------------------- | ------------------------------------------------------------ |
| 列表 | `GET /admin/service-grants`                    | `caller_app_id`、`target_app_id`、`status` 和分页            |
| 创建 | `POST /admin/service-grants`                   | `caller_app_id`、`scope_id`、可选 `valid_from`、`expires_at` |
| 撤销 | `POST /admin/service-grants/{grant_id}/revoke` | `reason` 为字符串或 `null`；响应包含 `changed`               |

## 7. 数据模型、迁移与状态设计

本项目不新增数据库模型和迁移，只消费后端契约。前端状态分为：

- 可缓存：Apps、Scopes、Grants 列表和 Apps 详情；
- 页面局部表单状态：筛选条件、页码、当前操作实体；
- 敏感短暂状态：创建 App 返回的初始 Secret，仅存在于创建页面组件内并在结果弹窗关闭时清除；
- 不使用 LocalStorage、SessionStorage、URL query、Zustand 或 Query Cache 保存 Secret。

## 8. 模块与服务拆分

### `admin-apps-api.ts`

负责 Apps 类型、列表、创建、详情、编辑、启用和禁用请求映射；不负责 Secret 持久化或 regenerate-secret。

### `admin-resource-scopes-api.ts`

负责 Scope 类型、分页、创建和状态请求；复用 Apps 查询作为 UI 选项，但不反向依赖 Apps 页面。

### `admin-service-grants-api.ts`

负责 Grant 类型、分页、创建和撤销请求；页面组合 Apps 与 Scopes 查询完成联动，不把 UI 临时 `target_app_id` 写入创建请求。

## 9. 配置、依赖与外部服务

- 不新增配置、依赖或锁文件变更；
- API 基地址继续由 `VITE_API_BASE_URL` 或宿主 `apiBaseUrl` 提供；
- Bearer Token 继续由宿主 `getAccessToken` 注入；
- 不记录 Token、Secret 或完整敏感错误载荷；
- 本地 `127.0.0.1:8000` 仅作为本次契约读取来源，不写入运行时默认配置。

## 10. 代码变更清单

### 第一阶段

- 新增 `apps/app/src/services/admin-apps-api.ts` 及测试；
- 新增 `apps/app/src/pages/AdminAppsPage.tsx` 及测试；
- 修改 `apps/app/src/App.tsx`、`App.test.tsx` 和最小必要样式；
- 校准 `AdminPermissionsPage.test.tsx` 的既有分页断言，并更新 README 中已过时的页面/路由说明；
- 新增第一阶段计划和执行记录。

### 后续阶段

- 第二阶段计划新增 Resource Scopes Service、页面和测试；
- 第三阶段计划新增 Service Grants Service、页面和测试；
- 每一阶段开始前依据当时 OpenAPI 和代码重新核对具体文件范围。

## 11. 异常处理与可观测性

| 场景         | 页面结果                   | 处理原则                   |
| ------------ | -------------------------- | -------------------------- |
| 422 参数错误 | 显示安全错误摘要，保留表单 | 前端校验与后端校验共同约束 |
| 401          | 触发宿主 logout            | 复用 API Client            |
| 403          | 提示无权限                 | fail closed，不隐藏为成功  |
| 404          | 提示实体不存在并允许刷新   | 不保留伪造详情             |
| 409/版本冲突 | 提示数据已变化             | 刷新后重新编辑             |
| 依赖列表失败 | 下拉不可保存并提供重试     | 不允许手填绕过既有实体选择 |

本期不新增日志、指标或追踪；浏览器控制台和测试输出不得记录初始 Secret。

## 12. 安全与权限要求

1. 所有接口继续要求 Bearer 认证和后端授权；
2. App 初始 Secret 只显示一次，不缓存、不持久化、不写日志；
3. 外部 URL 作为文本展示，不自动加载远程资源；
4. 表单按 OpenAPI 做长度、URL、枚举和时间顺序校验；
5. ID 选择使用后端返回实体，避免拼写、越权或类型混淆；
6. 写操作不自动重试，不通过乐观 UI 制造成功假象；
7. 禁用 App/Scope 与现有 Grant 的级联影响由后端决定，前端不 fail open；
8. 自动测试不连接共享测试/生产环境，不创建持久业务数据。

## 13. 测试与验收

### 13.1 单元与组件测试

- API 方法、路径、query、body、`version` 和无 body 操作；
- 列表分页、筛选、空态、失败与重试；
- 创建/编辑/状态弹窗、字段约束和失败状态；
- Secret 一次性展示、关闭清除及无 regenerate-secret 入口；
- Apps/Scopes 联动和 Grant 创建请求不携带 UI 临时 target 字段。

### 13.2 回归检查

- `pnpm lint`；
- `pnpm format:check`；
- `pnpm test`；
- `pnpm build`；
- `git diff --check`。

### 13.3 阶段外真实验证

真实创建 App 会生成不可再次读取的 Secret；创建 Scope/Grant、撤销 Grant 和状态操作都有持久副作用。需要受控管理员账号、明确授权和测试数据清理方案，不进入普通 CI。

## 14. 部署、迁移与回滚检查清单

- [ ] standalone 与 qiankun API 基地址、Token 注入已验证；
- [x] 无新增配置、依赖和数据库迁移；
- [ ] 各阶段定向和全量质量门禁通过；第一阶段已通过，后续阶段待实施；
- [ ] 受控环境权限和写操作验证已授权并记录；
- [x] 第一阶段初始 Secret 未写入日志、缓存、Storage 和构建产物；
- [x] 第一阶段旧三模块导航与测试回归通过；完整回滚仍待发布环境验证。

应用代码可通过回滚镜像/提交恢复；服务端已发生的创建、禁用和撤销操作必须依据后端能力人工恢复，不能由前端回滚代替。

## 15. 分阶段实施顺序

### 第一阶段：应用管理

> 状态：部分完成；代码与本地质量门禁已完成，真实环境读写联调待执行
>
> 阶段计划：[ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_PLAN.md](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_PLAN.md)
>
> 执行记录：[ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md](./ADMIN_SERVICE_ACCESS_IMPLEMENTATION_PHASE_1_EXECUTION.md)

前置依赖：Apps OpenAPI 可读取；仓库现有认证和管理页模式可复用。

开发内容：Apps 列表、创建、详情、编辑、启用/禁用、初始 Secret 一次性交付、路由导航、测试和文档。

本阶段不实现：regenerate-secret、Apps 删除、Scopes、Grants、真实环境写操作。

阶段验收：请求映射、数字 `id`/业务 `app_id` 区分、编辑 `version`、Secret 关闭清除、无 regenerate-secret 入口和本地质量门禁均已通过；浏览器路由与错误态通过，真实 API GET 因本地 CORS 未完成，写操作未获授权执行。

下一阶段入口：Apps Service 已可作为 Resource Scopes 的应用数据源；第二阶段开始前需重新读取 OpenAPI，并确认目标环境 CORS 与管理员权限。

### 第二阶段：资源范围管理

> 状态：未开始；阶段计划与执行记录待创建

前置依赖：第一阶段 Apps 查询能力已落地；重新核对 OpenAPI。

开发内容：Scope 列表、Apps 下拉筛选/创建、手填 `scope_code`、启用/禁用和测试文档。

本阶段不实现：Grant、Scope 编辑/删除、状态级联。

阶段验收：`target_app_id` 提交业务 App ID；创建字段和状态操作正确；选项不完整时有明确提示。

### 第三阶段：服务授权管理

> 状态：未开始；阶段计划与执行记录待创建

前置依赖：Apps 和 Scopes 查询能力已落地；重新核对 OpenAPI。

开发内容：Grant 列表、caller/target/Scope 联动选择、有效期、创建、撤销和测试文档。

本阶段不实现：Grant 编辑、删除、恢复、批量授权或 Secret 管理。

阶段验收：创建只提交 `caller_app_id`、`scope_id` 和有效期；撤销请求体正确；已撤销项只读；前端不改写服务端状态。

## 16. 风险、待确认项与决策记录

### 16.1 风险

| 风险                             | 影响                     | 缓解措施                                     | 状态   |
| -------------------------------- | ------------------------ | -------------------------------------------- | ------ |
| 初始 Secret 关闭后无法找回       | 管理员可能丢失凭证       | 强提示、复制能力、关闭即清除；不接入重新生成 | 已接受 |
| Apps/Scopes 选项受 100 条限制    | 目标实体可能不在当前选项 | Apps 远程关键词搜索；Scope 超限明确提示      | 开放   |
| App/Scope 禁用级联语义未公开     | 页面可能错误描述授权效果 | 不做前端级联推断，以服务端结果为准           | 已缓解 |
| 本地 OpenAPI 后续变化            | 请求或字段漂移           | 每阶段开始前重新读取契约并记录差异           | 开放   |
| 本地 7201 直连 8000 被 CORS 阻止 | 本地无法完成真实接口联调 | 配置本地 CORS、同源代理或使用实际宿主环境    | 开放   |
| 真实写操作不可由前端回滚         | 测试环境遗留数据         | 仅在明确授权和清理方案下联调                 | 已缓解 |

### 16.2 待确认项

当前没有阻塞第一阶段实施的待确认项。Scope 超过 100 条时是否增加后端搜索接口，留待第二阶段依据真实数据量确认。

### 16.3 方案决策记录

| 决策                       | 原因                             | 替代方案                         | 确认来源           |
| -------------------------- | -------------------------------- | -------------------------------- | ------------------ |
| Apps 先于 Scopes 和 Grants | 后两模块都引用业务 `app_id`      | 后续页面手工输入字符串           | 用户确认与依赖关系 |
| Scope Code 创建时手填      | 它是新资源标识，不是既有实体引用 | 下拉只能选择已有 Scope，无法创建 | 用户确认           |
| Grant 选择现有 Scope       | 创建契约只接受 `scope_id`        | 手填 code 容易错配目标 App       | 用户确认与 OpenAPI |
| 不接入 regenerate-secret   | 用户明确排除，且敏感操作风险更高 | 提供原因表单和新 Secret          | 用户要求           |
| Secret 不进入全局缓存      | 降低浏览器残留和误泄漏           | Query Cache/Store 保存便于重开   | 安全原则           |

## 17. 完成标准

```text
管理员创建并维护 App
  ↓
使用业务 app_id 创建目标 Scope
  ↓
选择 caller、target 与启用 Scope 创建 Grant
  ↓
服务端保存并返回授权状态
  ↓
管理员可查询和撤销 Grant，页面保留审计信息
```

方案整体完成要求：

- 三个阶段的代码、测试、计划和执行记录均互相链接且状态一致；
- 所有接口行为有自动化证据，旧 users/roles/permissions 回归通过；
- Secret、认证、输入和失败边界符合本方案安全要求；
- 未实现的 regenerate-secret 在 Service 和 UI 中均不存在；
- 真实环境未执行项明确列为发布前事项，不伪装为通过。
