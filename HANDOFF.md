# HANDOFF

## 当前任务

在 `D:\aworkspace2607\CareBookTenant` 这个 pnpm monorepo 中，剔除“系统管理”大模块下旧功能：

- 通知公告
- 广告管理

本轮只处理：

- `apps/admin-vue3`
- `apps/server`
- `docs`
- `scripts`
- `deployment`

项目实际使用 PostgreSQL。不要再处理或修改 `apps/server/db/mysqlinit.sql`，用户已明确指出“没有 mysql 的事情，用的是 pgsql”。

## 已完成内容

### 前端

已删除通知公告前端模块：

- `apps/admin-vue3/src/api/system/notice.js`
- `apps/admin-vue3/src/views/system/notice/index.vue`

源码残留扫描已确认没有：

- `api/system/notice`
- `system/notice`
- `system:notice`
- `NoticeModule`
- `NoticeService`
- `SysNotice`
- `NoticeController`

### 后端

已删除通知公告后端模块：

- `apps/server/src/module/system/notice/dto/index.ts`
- `apps/server/src/module/system/notice/entities/notice.entity.ts`
- `apps/server/src/module/system/notice/notice.controller.ts`
- `apps/server/src/module/system/notice/notice.module.ts`
- `apps/server/src/module/system/notice/notice.service.ts`

已更新：

- `apps/server/src/module/system/system.module.ts`

其中移除了：

- `NoticeModule` import
- `NoticeModule` 注册

### OpenAPI 生成产物

已从以下文件删除 `/system/notice*` 文档片段：

- `apps/server/openApi.json`
- `apps/server/public/openApi.json`

没有重新启动服务生成 Swagger，是直接解析 JSON 后删除相关 paths。

### PostgreSQL 初始化与清理脚本

已更新：

- `apps/server/db/init.sql`

删除内容包括：

- `DROP TABLE IF EXISTS sys_notice`
- `CREATE TABLE sys_notice`
- `sys_notice_type`
- `sys_notice_status`
- `sys_notice` seed 数据
- 通知公告菜单 `107`
- 通知公告按钮 `1035-1038`
- 普通角色对通知公告菜单/按钮的授权
- `sys_notice` sequence reset
- 旧轮播图/广告管理菜单 `108`
- 旧轮播图/广告管理按钮 `2000-2003`
- 普通角色对轮播图菜单/按钮的授权

同时保留并补齐了智能护理下的新菜单：

- `tenant-care/gps/index`
- `tenant-care/event/index`
- `tenant-care:gps:*`
- `tenant-care:event:*`

已更新 ToB 清理脚本，移除旧广告/轮播图清理项：

- `apps/server/db/tob_cleanup_precheck.sql`
- `apps/server/db/tob_cleanup_execute.sql`

已新增 PostgreSQL 专用人工清理脚本：

- `apps/server/db/remove_system_notice_ad_management.sql`

该脚本用于人工备份后清理现存库里的旧内容：

- `system:notice:%`
- `system/notice/index`
- `path = notice`
- `system:carousel:%`
- `system/carousel/%`
- `path = carousel`
- `sys_notice_type`
- `sys_notice_status`
- `DROP TABLE IF EXISTS sys_notice`
- `DROP TABLE IF EXISTS sys_carousel`

注意：这个 SQL 只是写入代码库，本轮没有执行任何生产数据库操作。

### 文档

已从工程规范目录结构中移除旧目录引用：

- `docs/engineering/服务端规范.md`
  - 删除 `notice/`
- `docs/engineering/管理后台工程规范.md`
  - 删除 `notice/`
  - 删除 `carousel/`

## 当前验证结果

已执行并通过：

- `pnpm build`
- `pnpm --dir apps/server build`
- `pnpm --dir apps/admin-vue3 build:prod`
- `pnpm lint`

已执行但失败：

- `pnpm --dir apps/server test:e2e`

失败原因不是本次删除导致。当前错误是 Jest e2e 配置无法解析 `src/*` alias：

```text
Cannot find module 'src/common/guards/auth.guard' from '../src/app.module.ts'
```

测试在加载 `app.module.ts` 阶段就失败，没有进入通知公告或广告管理相关逻辑。

## 当前卡点

主要卡点不是代码删除，而是工作区状态很脏，包含大量本轮之前已有的改动。不要误以为 `git status` 里所有变更都是本轮产生的。

当前 `git status --short` 里有很多与本任务无关或上一任务相关的改动，例如：

- 智能工牌删除相关文件
- 智能护理 tenant-care 相关改动
- deployment 脚本
- `CLAUDE.md`、`README.md`、`docs/README.md`
- `docs/history/`
- `dump.rdb`

本轮通知公告/广告管理相关的核心改动集中在：

- `apps/admin-vue3/src/api/system/notice.js`
- `apps/admin-vue3/src/views/system/notice/index.vue`
- `apps/server/src/module/system/notice/**`
- `apps/server/src/module/system/system.module.ts`
- `apps/server/db/init.sql`
- `apps/server/db/tob_cleanup_precheck.sql`
- `apps/server/db/tob_cleanup_execute.sql`
- `apps/server/db/remove_system_notice_ad_management.sql`
- `apps/server/openApi.json`
- `apps/server/public/openApi.json`
- `docs/engineering/服务端规范.md`
- `docs/engineering/管理后台工程规范.md`

## 下一步计划

1. 如需继续推进，先不要清理整个工作区，只针对上述本轮相关文件复核 diff。
2. 再跑一次残留扫描：

```powershell
rg -n "api/system/notice|system/notice|system:notice|sys_notice|NoticeModule|NoticeService|SysNotice|NoticeController" apps/admin-vue3/src apps/server/src apps/server/openApi.json apps/server/public/openApi.json apps/server/db/init.sql docs/engineering
rg -n "system/carousel|system:carousel|sys_carousel|carousel/index|轮播图管理|广告管理" apps/admin-vue3/src apps/server/src apps/server/db/init.sql apps/server/db/tob_cleanup_precheck.sql apps/server/db/tob_cleanup_execute.sql docs/engineering
```

预期这两个命令都没有输出。

3. 如果用户要实际清理数据库，只能基于 PostgreSQL，并且先备份目标库，再人工执行或审阅：

```text
apps/server/db/remove_system_notice_ad_management.sql
```

4. 如果要修 e2e，需要单独处理 Jest alias 配置，让 `src/*` 能在 `apps/server/test/jest-e2e.json` 下解析。这不是本次删除任务的一部分。

## 绝对不要再踩的坑

### 1. 不要再改 `mysqlinit.sql`

用户明确说了项目用 PostgreSQL，没有 MySQL 的事情。之前误扫到 `apps/server/db/mysqlinit.sql` 并尝试清理过，后来已经用 `git checkout-index -f -- apps/server/db/mysqlinit.sql` 恢复，当前没有业务 diff。

后续所有数据库脚本都以 PostgreSQL 为准。

### 2. 不要用 PowerShell `Set-Content` 直接写中文文件

踩过严重编码坑：用 `Set-Content` 处理 `init.sql` 和中文 docs 时，会造成 UTF-8/GBK/BOM/乱码问题。

正确方式：

- 尽量用 `apply_patch`
- 大块机械处理用 Node `fs.readFileSync(..., 'utf8')` / `fs.writeFileSync(..., 'utf8')`
- 不要让 PowerShell 参与中文文件重写

### 3. PowerShell 会吃掉 Node inline 脚本里的 `$1`

之前 `node -e` 里写 `text.replace(..., "$1...")` 被 PowerShell 解析，导致脚本失败。

如果必须跑复杂 Node 逻辑：

- 临时写一个 `.js` 文件
- 执行后删除
- 或者完全避免 `$1` 这种 shell 会解析的内容

### 4. 不要把“通知”关键词一刀切删除

保留项包括：

- 护理日报/微信通知
- 支付通知/退款通知
- 设备回调通知
- 订单履约通知状态
- `apps/admin-vue3/src/plugins/modal.js` 里的 UI 通知提示

本任务只删除系统管理下的“通知公告”模块。

### 5. 不要把订单 `banners` 当成广告管理删掉

`docs/history/订单模块.md` 和 `docs/engineering/订单模块ER图.md` 中的 `banners` 是订单/服务商品多图字段，不是系统管理广告模块。

### 6. 不要误删智能护理

智能护理必须保留，尤其是：

- 护工管理
- 设备管理
- 录音管理
- AI 日报
- GPS 定位
- 设备事件

`GPS定位`、`设备事件` 这些名称可能和旧模块重名，但 `tenant-care/*` 归属智能护理，不能删除。

### 7. 不要因为 e2e 失败去改本任务无关代码

当前 e2e 失败是 Jest alias 解析问题：

```text
Cannot find module 'src/common/guards/auth.guard'
```

不是通知公告/广告管理删除引起。除非用户明确要求修测试配置，否则不要扩大范围。

## 已知环境/文档情况

- `docs/product/PRD.md` 当前不存在。
- `docs/product/` 下只有 `服务退款规则.md`。
- `AGENTS.md`、`CLAUDE.md`、`CONTEXT.md`、`docs/README.md` 已读。
- `CLAUDE.md` 和部分文档本身在工作区已有修改，不要擅自还原。

