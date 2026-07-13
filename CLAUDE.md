# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

众保康护理 (BaoKang CareBook) — 企业级护理管理 SaaS，monorepo 包含三个应用：

- `apps/server/` — NestJS API（端口 8080，PostgreSQL 16 + Redis）
- `apps/admin-vue3/` — Vue 3 管理后台（端口 8888）
- `apps/wechat-miniprogram/` — uni-app 微信小程序

## 常用命令

```bash
# 开发
bun dev:api              # 后端 API（热重载）
bun dev:admin            # 管理后台
bun dev:mp-weixin        # 微信小程序
bun dev                  # API + 后台同时启动

# 构建
bun build                # server + admin 生产构建
bun build:mp             # 小程序构建

# 测试 & 代码质量
bun --dir apps/server test               # 单元测试
bun --dir apps/server test:e2e           # E2E 测试
bun lint                                # ESLint（server + 小程序）
bun format                              # Prettier（server）
```

Swagger: http://localhost:8080/swagger-ui
默认账号：`admin` / `admin123`

## 文档入口

| 文档 | 用途 |
|------|------|
| `CONTEXT.md` | 业务域模型、核心对象及关系 |
| `docs/product/PRD.md` | 产品需求主文档 |
| `docs/engineering/服务端规范.md` | 后端 NestJS 完整工程规范 |
| `docs/engineering/管理后台工程规范.md` | 管理后台 Vue3 完整工程规范 |
| `docs/engineering/小程序工程规范.md` | 小程序 uni-app 完整工程规范 |
| `docs/engineering/订单模块.md` | 订单、服务关系数据模型 |
| `docs/engineering/护理订单履约日报V1实施方案.md` | 护理日报生成规则与实施方案 |
| `docs/README.md` | 文档总索引与阅读顺序 |

## 关键实现规范

详细规范见各端工程文档，以下为快速摘要：

### 数据库

配置：`apps/server/src/config/dev.yml`（开发）、`prod.yml`（生产）
远程 PostgreSQL：host `101.133.170.55`，port `5432`，database `carebook_tenant`

- 金额：整数分（如 `30000` = 300 元）
- 布尔：`char(1)` 存 `'0'`/`'1'`
- 软删除：`delFlag = '0'` 正常，`'1'` 已删
- 分页：`PagingDto` 入参，`{ rows/list, total }` 出参
- 查询必须加 `.andWhere('alias.delFlag = :delFlag', { delFlag: '0' })`

### 后端（apps/server）

- 所有实体继承 `BaseEntity`（`src/common/entities/base.ts`）
- Service 注入 Repository：`@InjectRepository(Entity)`
- 使用 `createQueryBuilder` 做复杂查询，不用 `EntityManager`
- 响应格式：`{ code, msg, data }`，HTTP 状态码始终 200
- 定时任务：业务逻辑写在业务 Service，`@Task` 在 `task.service.ts` 做入口
- 面向 ToC 展示的业务单号由后端统一生成与返回，前端只展示，不自行裁剪或拼接前缀
- 新模块：放在 `src/module/` 下，手动 import 到 `app.module.ts`

### 管理后台（apps/admin-vue3）

- API 走 `/dev-api` 代理，JWT 在 `Authorization: Bearer <token>` Header
- 动态路由从后端 `/getRouters` 获取，组件路径用 `import.meta.glob` 解析
- 图片/文件字段在表单中用**逗号分隔字符串**存储，不是数组
- 权限指令：`v-hasPermi`、`v-hasRole`
- 新建页面需在 `sys_menu` 表插入数据，详见 `docs/engineering/服务端规范.md`

### 小程序（apps/wechat-miniprogram）

- UnoCSS 主力样式，图标用 `@iconify-json/ph`（`<view class="i-ph-xxx" />`）
- **优先使用箭头函数**，禁止 `function` 声明式
- uView Pro 组件使用前查阅 `.agents/skills/uview-pro/SKILL.md`
- 时间处理用 `dayjs`，禁止拼接字符串
- 请求主力是 `src/http/http.ts`（基于 `uni.request`）
- ToC 页面只展示用户可理解的信息，内部规则编码、策略建议、渠道单号等排障字段默认不向用户暴露

## Agent Skills

### Issue tracker

GitHub Issues。外部 PR 作为需求入口。详见 `docs/agents/issue-tracker.md`。

### Triage labels

五个标准标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局。`CONTEXT.md` 为主要业务入口，`docs/adr/` 为架构决策记录。详见 `docs/agents/domain.md`。
