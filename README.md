# 众保康护理 (BaoKang CareBook)

企业级护理管理 SaaS 平台，基于 pnpm monorepo 架构，包含后端 API、管理后台与微信小程序三端。

## 项目结构

```
CareBook/
├── apps/
│   ├── server/                 # NestJS 后端 API 服务
│   ├── admin-vue3/             # Vue 3 + Element Plus 管理后台
│   └── wechat-miniprogram/     # uni-app 微信小程序
├── docs/                       # 项目文档
└── package.json                # 根 monorepo 配置
```

## 技术栈

| 端        | 技术                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 后端 API  | NestJS v10 · TypeORM · PostgreSQL 16 · Redis · JWT · Swagger · Winston  |
| 管理后台  | Vue 3 · Vite · Element Plus · Pinia · Vue Router · ECharts · Axios     |
| 微信小程序 | uni-app · Vue 3 · UnoCSS · Wot UI · Pinia · Alova · TypeScript          |

## 功能概览

### 后台管理（基于若依 RuoYi 体系）

- **RBAC 权限管理** — 用户 / 角色 / 菜单 / 部门 / 岗位，按钮级权限控制
- **认证与安全** — JWT 双 token（access + refresh）、验证码登录、RSA 加密
- **系统监控** — 在线用户、操作日志、登录日志、服务监控（CPU/内存/磁盘）、缓存监控
- **定时任务** — 基于 cron 的任务调度与执行日志
- **数据字典** — 动态字典类型与数据管理
- **代码生成器** — 支持 NestJS / Vue 模板的 CRUD 代码生成
- **文件上传** — 支持本地存储与腾讯云 COS 对象存储
- **数据备份** — 数据库备份与归档

### 微信小程序

- 面向终端用户的护理服务小程序（功能开发中）

## 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 10
- **PostgreSQL** 16
- **Redis** >= 6

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境要求

- **PostgreSQL** 16（本地或远程启动均可）
- **Redis** >= 6

### 3. 初始化数据库

```bash
# 创建数据库并导入初始数据
psql -U postgres -c "CREATE DATABASE nest_admin;"
psql -U postgres -d nest_admin -f apps/server/db/init.sql
```

### 4. 启动服务

```bash
# 启动后端 API（端口 8080）
pnpm dev:api

# 启动管理后台（端口 8888）
pnpm dev:admin

# 同时启动前后端
pnpm dev
```

Swagger 文档：http://localhost:8080/swagger-ui

### 默认账号

| 角色   | 账号    | 密码      |
| ------ | ------- | --------- |
| 管理员 | `admin` | `admin123` |

## 项目脚本

| 命令                | 说明               |
| ------------------- | ------------------ |
| `pnpm dev:api`      | 启动后端 API       |
| `pnpm dev:admin`    | 启动管理后台       |
| `pnpm dev:weixin`   | 启动小程序开发     |
| `pnpm dev`          | 同时启动 API + 后台 |
| `pnpm build`        | 构建全部应用       |
| `pnpm lint`         | 代码检查           |
| `pnpm format`       | 代码格式化         |

## 许可证

专有软件许可证协议
Copyright (C) 2026 众保康（上海）医疗管理有限公司
