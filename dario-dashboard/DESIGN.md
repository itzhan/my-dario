# dario-dashboard — 设计方案

dario 自带的可视化只有终端 TUI(`src/tui/`),没有 Web 页面。本项目是一套独立的
Next.js Web 仪表盘 + 配置编辑器,通过 HTTP 跟运行中的 dario 代理对话,不改动 dario
本体的零依赖结构。

范围(已确认):
- 只读仪表盘:状态、实时请求流、分析图表、账号池、限流
- 写操作一:解除熔断(`POST /admin/resume`)
- 写操作二:编辑 `~/.dario/config.json`(需补后端写接口,见 §3)

---

## 1. 设计原则

- **不污染 dario 本体。** dario 的卖点是「零运行时依赖、一个周末读得完、MIT」。本仪表盘是
  独立 repo,纯靠 HTTP 跟代理通信。dario 侧最多新增两三个只读/写接口,且全部可选。
- **BFF(Backend-for-Frontend)模式。** 浏览器只跟 Next.js 服务端对话,Next.js 再去
  反代 dario。理由见 §6:解决 API key 不落浏览器、CORS、以及浏览器 SSE 无法带鉴权头。
- **读为主,写极少。** 写操作只有「解除熔断」和「存配置」两处,都要二次确认。

---

## 2. 总体架构

```
浏览器 (cult-ui / magic ui 页面, 纯展示)
   │  fetch / EventSource  —— 同源,无密钥
   ▼
Next.js Route Handlers (BFF)  —— 在这里注入 DARIO_API_KEY、反代 SSE、读写 config
   │  http://localhost:3456 (x-api-key: ***)
   ▼
dario proxy
```

- 浏览器永远拿不到 `DARIO_API_KEY`,它只存在 Next.js 服务端环境变量里。
- 所有对 dario 的请求都从 Next.js 服务端发出 → 同源、无 CORS 问题。
- SSE 也由 Next.js Route Handler 代理转发(浏览器 `EventSource` 不能设自定义头,无法直接带 key)。

---

## 3. 后端契约 & 缺口

### 3.1 现成的接口(dario 已暴露,直接消费)

| 接口 | 方法 | 用途 | 数据来源 |
|---|---|---|---|
| `/health` | GET | 探活 | `proxy.ts:1128` |
| `/status` | GET | 状态快照 | `proxy.ts:1162` → `getStatus()` |
| `/accounts` | GET | 账号池利用率/限流/冷却/粘连绑定 | `proxy.ts:1172` |
| `/analytics` | GET | 滚动窗口汇总 + 燃烧率 | `proxy.ts:1213` → `analytics.summary()` |
| `/analytics/stream` | GET (SSE) | 实时请求流 + 熔断事件 | `proxy.ts:1230` |
| `/admin/resume` | GET | 当前熔断状态 | `proxy.ts:1300` |
| `/admin/resume` | POST | 解除熔断 | `proxy.ts:1310` |
| `/v1/models` | GET | 可用模型清单 | `proxy.ts:1322` |

SSE 流连上时先回放最近 50 条记录,再实时 tail;命名事件:`overage_halt` /
`overage_warn` / `overage_resume`;每 25s 一个心跳注释帧。

### 3.2 缺口:配置读写(为「改配置」范围新增)

dario 目前**没有 HTTP 接口读写配置**(`proxy.ts:1172` 注释:mutation 只走 CLI)。
但 `src/config-file.ts` 已有齐全的底层函数:`loadConfig` / `saveConfig`(原子写,
`0o600`)/ `defaultConfig` / `mergeOver` / `resolveConfig`,以及 `DarioConfig` 类型
和 `CONFIG_SCHEMA_VERSION`。

两种补法,**推荐 A**:

- **方案 A(推荐)——BFF 直接读写文件。** 若仪表盘与 dario 跑在同一台机器(常见),
  Next.js 服务端直接读写 `~/.dario/config.json`,复用 dario 导出的
  `loadConfig`/`saveConfig`/`DarioConfig`(`@askalf/dario` 已从 `index.ts` 导出部分
  API;config 相关若未导出,可在 BFF 内薄封装一份等价的原子写)。
  - 优点:**dario 零改动**,符合「不污染本体」原则。
  - 缺点:仪表盘必须与代理同机、对该文件有读写权限。

- **方案 B —— 给 dario 加 `GET/PUT /admin/config` 路由。** 适合仪表盘与代理跨机部署。
  需在 dario 提 PR,且要走它的鉴权门(`DARIO_API_KEY`)。本仓库不强依赖它,作为可选增强。

### 3.3 关键约束:配置改完要重启代理

`overageGuard` / `pacing` / `pool` / `host` / `port` 等都是代理**启动时**构造的,改
`config.json` **不会热生效**。所以配置页保存后必须明确提示:「已保存,重启 `dario proxy`
后生效」。可选增强:加一个 `POST /admin/reload`(dario 侧)做软重载,但初版不做,如实提示即可。

---

## 4. 页面结构(对齐 TUI 标签页)

TUI 的六个标签页就是天然的信息架构,Web 直接照搬:

```
/                 → 重定向到 /status
/status           Status    —— 代理在线状态、熔断 banner、模板版本/捕获时效、当前账号
/analytics        Analytics —— 滚动窗口汇总、按模型占比、燃烧率、限流 5h/7d 进度
/hits             Hits      —— 实时请求流表格(SSE 驱动),可筛选/暂停/搜索
/accounts         Accounts  —— 账号池卡片:别名、5h/7d 利用率、claim、冷却、下一个被选中的号
/backends         Backends  —— 后端列表 + /v1/models
/config           Config    —— 配置编辑器(分组表单),保存 → 提示重启
```

顶部统一一个状态条:在线/离线点、当前活跃账号、熔断态(红色高亮 + 一键解除)。

---

## 5. 组件清单 & UI 选型

技术栈:**Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4**。
组件来自 **shadcn/ui 基座 + magic ui + cult-ui**(三者都是 shadcn registry 风格,
可共存,按 `npx shadcn add` 拉到本地 `components/ui`,无黑盒依赖)。

| 区域 | 组件 | 来源建议 |
|---|---|---|
| 顶部在线状态/熔断条 | Animated Beam / Border Beam、Pulse 点 | magic ui |
| 实时请求流(Hits) | 虚拟化表格 + 新行入场动画 | shadcn Table + framer-motion;magic ui `AnimatedList` 做「新请求飞入」 |
| 燃烧率 / 限流进度 | Progress、Number Ticker(数字滚动)、Gauge | magic ui `NumberTicker` + cult-ui 进度件 |
| 按模型占比 | 横向 Bar、Donut | Recharts(轻量,SSR 友好) |
| 账号池卡片 | 3D/光泽卡片、悬浮态 | cult-ui `Card` 系列、magic ui `MagicCard` |
| 配置编辑器 | 分组表单、Switch、Slider、Input、Select | shadcn Form + react-hook-form + zod |
| 熔断 banner | 警示 Alert + Shimmer | magic ui `ShineBorder` |
| 全局背景 | Dot/Grid pattern、渐变 | magic ui `DotPattern` / `Particles`(克制使用) |

动效原则:仪表盘是「盯着看的工具」,动效服务于「让变化被一眼看到」(新请求、熔断、数字跳动),
不堆装饰。Particles/光效这类纯装饰克制用。

---

## 6. 鉴权与安全

- **DARIO_API_KEY 只在 Next.js 服务端。** 放 `.env.local` 的 `DARIO_API_KEY`,Route
  Handler 转发时注入 `x-api-key`。浏览器侧任何代码都拿不到。
- **浏览器 SSE 走 BFF 代理。** `EventSource` 不能设头,所以前端连的是 Next.js 的
  `/api/stream`(同源、无需 key),由该 Route Handler 用 fetch 流式拉 dario 的
  `/analytics/stream` 再转发给浏览器。
- **CORS 不再是问题。** 浏览器全程同源(只跟 Next.js 说话),dario 的 `DARIO_CORS_ORIGIN`
  无需配置。
- **仪表盘本身的访问控制。** 仪表盘暴露了订阅的全部观测面 + 改配置能力,**不能裸奔公网**。
  初版:仅本机/局域网 + Next.js 一道简单登录(`AUTH_SECRET` + 中间件 Basic/Cookie)。
  对外则前置 TLS(Caddy/nginx)。
- **写操作二次确认。** 解除熔断、保存配置都弹确认。

---

## 7. BFF 路由设计(Next.js Route Handlers)

```
app/api/
  status/route.ts          → GET   代理 dario /status
  analytics/route.ts       → GET   代理 dario /analytics
  accounts/route.ts        → GET   代理 dario /accounts
  models/route.ts          → GET   代理 dario /v1/models
  stream/route.ts          → GET   SSE 流式反代 dario /analytics/stream
  resume/route.ts          → GET/POST  熔断状态 / 解除
  config/route.ts          → GET/PUT   方案 A:直接读写 ~/.dario/config.json
```

统一封装一个 `lib/dario.ts`:`darioFetch(path, init)` 注入 baseUrl + key + 超时 +
错误归一化。配置写入复用 dario 的 `saveConfig` 或 BFF 内等价原子写(写临时文件 → rename,
`0o600`),保存前用 zod 按 `DarioConfig` 形状校验。

---

## 8. 目录结构

```
dario-dashboard/
  app/
    (dashboard)/
      status/page.tsx
      analytics/page.tsx
      hits/page.tsx
      accounts/page.tsx
      backends/page.tsx
      config/page.tsx
      layout.tsx            状态条 + 侧栏/标签导航
    api/                    见 §7
    layout.tsx
  components/
    ui/                     shadcn / magic ui / cult-ui 拉下来的组件
    dashboard/              业务组件:HitsTable, BurnRate, AccountCard, ConfigForm...
  lib/
    dario.ts                BFF 客户端封装
    config-schema.ts        zod 镜像 DarioConfig
    sse.ts                  前端 SSE hook (useEventStream)
  middleware.ts             登录门
  .env.local.example        DARIO_BASE_URL / DARIO_API_KEY / AUTH_SECRET
  DESIGN.md                 本文档
```

---

## 9. 迭代里程碑

1. **M1 脚手架 + 跑通一条命脉。** 建 Next.js 项目、接好 BFF、`/status` + 实时 SSE 在
   `/hits` 跑起来。验证标准:页面能实时滚出真实请求记录。
2. **M2 分析与账号。** `/analytics`(燃烧率、按模型、限流进度)、`/accounts`(池卡片)。
3. **M3 熔断。** 状态条熔断 banner + 一键解除(POST /admin/resume)+ SSE 事件联动。
4. **M4 后端 backends + 模型。** `/v1/models` 展示、后端列表(若需写,走方案 B 或 CLI 提示)。
5. **M5 配置编辑器。** 方案 A 读写 config.json + zod 校验 + 「保存后需重启」提示。
6. **M6 打磨。** 登录门、深色主题、动效收尾、空/错/离线态、移动端基本可用。

每个里程碑结束都有可演示的真实页面,而不是攒到最后。

---

## 10. 风险与取舍

- **dario 接口是内部契约,可能随版本变。** `/status`、`/analytics` 的字段不是对外稳定 API。
  对策:`lib/dario.ts` 做一层防御性解析,字段缺失降级而非崩溃;锁定一个 dario 版本基线。
- **配置不热生效。** 已在 §3.3 说明,保存即提示重启,初版不做软重载。
- **方案 A 要求同机。** 跨机部署再上方案 B 的 `/admin/config`。
- **合规边界不变。** 这只是个观测/配置前端,不改变 dario 本身「规避计费分级」的性质;
  多人共享订阅的风险此前已讨论,仪表盘不解决也不放大这一点。
