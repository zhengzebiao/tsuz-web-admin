# 管理员子应用路由与资源代理：第二阶段执行记录

> 状态：部分完成
>
> 执行日期：2026-09-01
>
> 总实施方案：[SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md](./SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md)
>
> 阶段实现计划：[SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md)

## 1. 执行范围与结论

本次在 `/Users/zhengzebiao/code/tsuz-web-admin` 完成管理员子应用的可配置静态资源 base 改造，并同步 Docker、Compose、部署 workflow、环境示例和文档。

阶段结论：代码和本地构建验证通过；`VITE_PUBLIC_BASE=/subapps/admin/` 构建后的入口 HTML 已引用 `/subapps/admin/assets/*`，但服务器外层 Nginx、CCR 发布和主/子应用真实 qiankun 联调未执行，因此阶段标记为“部分完成”，可进入第三阶段。

实际完成：

1. Vite 配置读取并规范化 `VITE_PUBLIC_BASE`，默认保持 `/`；
2. Dockerfile、Compose 和 admin deploy workflow 传递 `VITE_PUBLIC_BASE`；
3. admin 环境示例和类型声明移除旧 `VITE_MFE_APP_ENTRY`，补充测试环境 `/subapps/admin/` 示例；
4. README 更新 `/app/admin`、`/subapps/admin/` 和构建时变量说明；
5. 新增本方案、第二阶段计划和执行记录。

未实现/未执行：

- 未改动服务器外层 Nginx；
- 未执行 CCR push、真实 tag 发布和测试服务器部署；
- 未在真实主应用 + admin 容器环境执行浏览器 qiankun 联调；
- 未改动主应用路由、host props、API 或管理员业务页面。

## 2. 实际代码与配置变更

### 2.1 Vite base

- [`apps/app/vite.config.ts`](../apps/app/vite.config.ts)：使用 `loadEnv` 读取 `VITE_PUBLIC_BASE`，通过 `normalizeBase` 确保资源 base 为 `/` 或带首尾斜杠的绝对路径；保留 React、qiankun、7201、CORS 和 alias 配置。
- [`apps/app/src/vite-env.d.ts`](../apps/app/src/vite-env.d.ts)：声明 `VITE_PUBLIC_BASE`。

最终行为：

```text
未设置 VITE_PUBLIC_BASE        → /
VITE_PUBLIC_BASE=/              → /
VITE_PUBLIC_BASE=/subapps/admin/ → /subapps/admin/
```

### 2.2 构建和部署配置

- [`Dockerfile`](../Dockerfile)：增加 `ARG/ENV VITE_PUBLIC_BASE=/`；
- [`docker-compose.yml`](../docker-compose.yml)：增加 `VITE_PUBLIC_BASE` build arg；
- [` .github/workflows/deploy.yml`](../.github/workflows/deploy.yml)：服务器构建、远程 shell 参数和部署 `.env` 使用 `VITE_PUBLIC_BASE`，保留服务器构建/CCR 发布逻辑；
- [` .env.deploy.example`](../.env.deploy.example)、[`apps/app/.env.example`](../apps/app/.env.example)：提供 CCR、服务器和 `/subapps/admin/` 非敏感示例。

### 2.3 文档

- [`README.md`](../README.md)：更新本地 standalone/host mode、测试环境资源 base、构建时变量和部署方式；
- [`SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md`](./SUBAPP_ROUTING_IMPLEMENTATION_PLAN.md)：记录总设计；
- [`SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md`](./SUBAPP_ROUTING_IMPLEMENTATION_PHASE_2_PLAN.md)：记录本阶段实施契约；
- 本文件：记录实际变更和验证结果。

本阶段没有新增 npm 依赖、数据迁移、API Schema 或持久状态。

## 3. 关键设计结果

1. 管理员镜像测试/生产构建应设置 `VITE_PUBLIC_BASE=/subapps/admin/`；
2. 主应用 entry 与子应用资源 base 分离：主应用使用 `VITE_ADMIN_APP_ENTRY=https://test.tusz.online/subapps/admin/`，admin 使用 `VITE_PUBLIC_BASE=/subapps/admin/`；
3. 子应用根页面由其自身容器 Nginx 处理，外层 Nginx 需要把 `/subapps/admin/` 前缀去除后转给 7201；
4. 主应用用户路径 `/app/admin` 仍必须转给 7200，不能直接转给 7201；
5. 旧 `VITE_MFE_APP_ENTRY` 在 admin 配置、workflow 和文档中已移除，qiankun 技术注册名 `mfe-app` 保留以兼容现有 plugin。

## 4. 与阶段计划的差异

实现与阶段计划一致。阶段执行中确认 admin deploy workflow 已由用户/前序工作同步为服务器构建模式，本阶段在该现状上接入 `VITE_PUBLIC_BASE`，未撤销其远程构建改动。

## 5. 测试与验证结果

| 检查                    | 命令/方法                                                                 | 结果       | 证据                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Admin lint              | `cd /Users/zhengzebiao/code/tsuz-web-admin && pnpm lint`                  | 通过       | Turbo 4 个 task 成功                                                                                   |
| Admin unit tests        | `pnpm test`                                                               | 通过       | 4 个 task；admin app 4 个测试文件、13 个测试通过                                                       |
| 默认 production build   | `pnpm build`                                                              | 通过       | Vite 生产构建成功；仅有大 chunk warning                                                                |
| 子路径 production build | `VITE_PUBLIC_BASE=/subapps/admin/ pnpm --filter tsuz-web-admin-app build` | 通过       | 入口 HTML 生成 `/subapps/admin/assets/index-D_EG-ZpE.js` 和 `/subapps/admin/assets/index--m6sEEa7.css` |
| 根资源扫描              | 对 `apps/app/dist` 扫描 `/assets/`                                        | 通过       | 仅匹配完整的 `/subapps/admin/assets/`，没有根 `/assets/` 引用                                          |
| Diff 检查               | `git diff --check`                                                        | 通过       | 无 whitespace 错误                                                                                     |
| Prettier                | `pnpm exec prettier --check ...`                                          | 未完全执行 | Dockerfile 和 env 无 parser，README 存在 Markdown 格式提示；不是源码/build 错误                        |
| 真实 Nginx/部署         | 服务器操作                                                                | 未执行     | 属于第三阶段，具有外部副作用                                                                           |

## 6. 阶段验收结果

| 编号    | 验收标准                                            | 结果 | 证据                                       |
| ------- | --------------------------------------------------- | ---- | ------------------------------------------ |
| AC-2-01 | 默认 build 保持根资源路径                           | 通过 | 默认 `pnpm build` 成功；Vite 默认 base `/` |
| AC-2-02 | 前缀 build 的 JS/CSS 使用 `/subapps/admin/assets/*` | 通过 | 前缀构建 `dist/index.html` 静态检查        |
| AC-2-03 | 前缀 build 不存在根 `/assets/` 引用                 | 通过 | `dist` 扫描未发现独立根 `/assets/` 引用    |
| AC-2-04 | Docker、Compose、workflow 传递 `VITE_PUBLIC_BASE`   | 通过 | 三处配置均含 build arg/远程参数            |
| AC-2-05 | lint、测试和生产 build 通过                         | 通过 | 见验证汇总                                 |
| AC-2-06 | 真实 Nginx 和 qiankun 联调留给第三阶段              | 通过 | 未执行事项已明确记录                       |

## 7. 安全、兼容性与可观测性核对

### 安全

- `VITE_PUBLIC_BASE` 仅为非敏感资源路径；CCR token、SSH 私钥未写入配置示例；
- 资源路径与用户 `/app/admin` 路由分离，避免通过 Nginx 误绕过主应用鉴权；
- admin Nginx 的 CORS 仍只允许资源读取相关方法/headers，保留既有行为。

### 兼容性

- 本地 root standalone 和 host props basename 行为不变；
- qiankun lifecycle 注册名 `mfe-app` 不变；
- 旧镜像可通过不可变 tag 回滚，但会恢复旧根资源 base；
- 当前前缀构建仅影响新镜像，不修改历史镜像内容。

### 可观测性

- 未增加运行时日志；构建 workflow 保留镜像 inspect 输出；
- 第三阶段应通过浏览器 Network、Nginx access/error log 和两个容器状态检查动态资源加载。

## 8. 遗留问题与第三阶段入口

| 问题                                         | 影响                     | 条件                           | 处理阶段 |
| -------------------------------------------- | ------------------------ | ------------------------------ | -------- |
| 外层 Nginx 尚未代理 `/subapps/admin/` → 7201 | 公网 entry 尚不可用      | 修改并 reload 测试服务器 Nginx | 第三阶段 |
| 新 admin 镜像尚未发布                        | 测试环境仍使用旧构建产物 | 用新不可变 tag 发布            | 第三阶段 |
| 主应用/管理员真实 qiankun 联调未执行         | 无端到端通过证据         | 两个新镜像和测试账号就绪       | 第三阶段 |

第三阶段入口配置：

```nginx
location ^~ /subapps/admin/ {
    proxy_pass http://127.0.0.1:7201/;
}

location / {
    proxy_pass http://127.0.0.1:7200;
}
```

主应用 GitHub `test` Environment：

```text
VITE_API_BASE_URL=https://test-api.tusz.online
VITE_ADMIN_APP_ENTRY=https://test.tusz.online/subapps/admin/
```

管理员 GitHub `test` Environment：

```text
VITE_API_BASE_URL=https://test-api.tusz.online
VITE_PUBLIC_BASE=/subapps/admin/
```

## 9. 阶段结论

第二阶段代码和本地构建工作已完成，整体标记为部分完成：

- `VITE_PUBLIC_BASE` 已支持并验证；
- 默认本地构建和 `/subapps/admin/` 前缀构建均通过；
- 服务器 Nginx、CCR 发布和真实浏览器联调仍待第三阶段；
- 可进入第三阶段，不应将本地构建验证等同于公网部署验收。
