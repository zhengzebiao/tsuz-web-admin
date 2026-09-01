# 管理员子应用路由与资源代理：第二阶段“子路径构建”实现计划

> 状态：已实施
>
> 总实施方案：[SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md](./SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md)
>
> 阶段执行记录：[SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_EXECUTION.md](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_EXECUTION.md)
>
> 范围：实现 `/subapps/admin/` 生产资源前缀和构建配置同步；不提前执行服务器 Nginx、镜像发布或真实双应用联调。

## 1. 阶段基准

### 1.1 前置状态

- 主应用已确认 `/app/admin` 页面路由和 `VITE_ADMIN_APP_ENTRY` 契约；
- 管理员应用已有 qiankun 生命周期、host props、Router basename 和容器 Nginx；
- 实施前 admin 仓库 `main` 工作区干净；
- `apps/app/vite.config.ts` 没有 `base`，生产入口引用根 `/assets/*`。

### 1.2 阶段目标

1. 本地默认构建保持根 `/`；
2. `VITE_PUBLIC_BASE=/subapps/admin/` 构建生成带前缀的 JS/CSS 引用；
3. Docker、Compose、远程服务器构建 workflow 和环境示例传递新变量；
4. 保持现有业务、qiankun 生命周期、API 和 Router basename 行为不变；
5. 用真实生产构建产物证明没有根 `/assets/` 引用。

## 2. 范围与约束

### 2.1 本阶段实现

- Vite base 读取和规范化；
- `VITE_PUBLIC_BASE` Docker/Compose/workflow 传递；
- 环境类型、示例和 README；
- lint、unit test、默认 build、前缀 build 和静态资源路径检查；
- 本仓库总方案、阶段计划和执行记录。

### 2.2 本阶段不实现

- 不修改主应用；
- 不配置服务器外层 Nginx；
- 不执行 CCR push、真实部署或 tag 发布；
- 不接入管理员业务 API；
- 不实现其他子应用。

### 2.3 已确认约束

- 用户访问地址仍是 `https://test.tusz.online/app/admin`；
- 资源入口是 `https://test.tusz.online/subapps/admin/`；
- 管理员容器监听宿主机 7201；
- 本地 standalone 应继续使用 `/`；
- `VITE_PUBLIC_BASE` 与主应用 `VITE_ADMIN_APP_ENTRY` 职责不同。

## 3. 详细设计

### 3.1 Vite 资源前缀

`apps/app/vite.config.ts` 使用 `loadEnv(mode, process.cwd(), "")` 读取 `VITE_PUBLIC_BASE`。规范化规则：

- 空值或空白值 → `/`；
- `/` 保持 `/`；
- `subapps/admin`、`/subapps/admin`、`/subapps/admin/` 都规范化为 `/subapps/admin/`。

保留原 React、qiankun plugin、Vitest、7201、CORS headers 和 alias 配置。

### 3.2 构建与部署配置

- Dockerfile `ARG/ENV VITE_PUBLIC_BASE=/`；
- Compose 本地默认 `/`；
- GitHub `test`/`product` Environment 建议显式设置 `/subapps/admin/`；workflow 缺省也使用该生产前缀；
- 服务器远程构建将 `VITE_PUBLIC_BASE` 安全写入脚本环境并作为 Docker build arg；
- 生成的运行时 `.env` 记录构建配置，供 Compose 可追溯使用；不包含 Secret。

### 3.3 兼容性

- qiankun 注册名继续为 `mfe-app`；
- host props 和 `/app/admin` basename 不变；
- 本地开发和默认构建仍为根路径；
- 旧镜像可通过不可变 tag 回滚。

本阶段不改变数据、持久状态、API Schema 或依赖。

## 4. 实施步骤

1. 增加 Vite base 配置；
2. 同步 Dockerfile、Compose、workflow 和环境示例；
3. 清理仅用于模板兼容的 `VITE_MFE_APP_ENTRY`，改用 `VITE_PUBLIC_BASE`；
4. 更新 README 和分阶段文档；
5. 运行 lint、test 和默认生产构建；
6. 使用 `/subapps/admin/` 前缀重新构建并检查入口引用；
7. 记录真实验证结果和第三阶段入口。

## 5. 验收标准

| 编号    | 验收标准                                              | 验证方式                                            |
| ------- | ----------------------------------------------------- | --------------------------------------------------- |
| AC-2-01 | 默认 build 保持根资源路径                             | `pnpm build` 和 `dist/index.html`                   |
| AC-2-02 | 前缀 build 的 JS/CSS 引用为 `/subapps/admin/assets/*` | `VITE_PUBLIC_BASE=/subapps/admin/ ... build` + grep |
| AC-2-03 | 前缀 build 不存在根 `/assets/` 引用                   | `grep -RInE '/assets/' dist` 人工核对完整路径       |
| AC-2-04 | Docker、Compose 和 workflow 传递 `VITE_PUBLIC_BASE`   | 静态 diff/workflow 检查                             |
| AC-2-05 | 现有 lint、测试和生产 build 通过                      | 仓库命令                                            |
| AC-2-06 | 真实 Nginx 和 qiankun 联调明确留给第三阶段            | 执行记录                                            |

## 6. 风险与回滚

- `vite-plugin-qiankun` 会转换生产入口 script；必须检查转换后的最终 HTML，而非只看 Vite 配置。
- 外层 Nginx 必须以 `/subapps/admin/` location 和带尾斜杠的 proxy_pass 去除前缀；本阶段不推断其已配置。
- 若新镜像加载失败，可回滚旧不可变 tag；旧镜像仍使用旧资源契约。

## 7. 计划调整记录

管理员部署 workflow 在实施期间已同步为与主应用一致的服务器构建/CCR 模式。该变更由用户已有并行修改引入，本阶段保留并在其上接入 `VITE_PUBLIC_BASE`，不回退到 GitHub Runner 构建。
