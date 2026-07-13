# CareBook 文档地图

`docs/` 按“产品需求、技术设计、外部集成、运维资料”四类收口，避免文档平铺在根目录，也避免分层过细导致维护成本上升。

## 推荐阅读顺序

新需求、新排障、新开发，默认按这个顺序阅读：

1. `CLAUDE.md`：仓库级工程约束、技术栈、实现约定
2. `CONTEXT.md`：业务领域语言、核心对象、关键约束
3. `docs/product/PRD.md`：产品需求主文档
4. `docs/engineering/`：技术设计、模块设计、目录结构、ER、实施方案
5. `docs/integrations/`：支付、设备、ASR、第三方接口资料
6. `docs/operations/`：部署、环境、服务器、运维辅助资料
7. `docs/adr/`：历史架构决策记录

## 目录划分

- `docs/product/`
  放产品需求、业务范围、流程口径。当前主入口是 `PRD.md`。

- `docs/engineering/`
  放技术设计、模块设计、目录结构、ER 图、实施方案。凡是“怎么实现”都优先放这里。

- `docs/integrations/`
  放第三方平台、智能设备、支付、ASR、回调协议等外部集成资料。

- `docs/operations/`
  放部署、环境、服务器、域名、运维辅助信息。

- `docs/agents/`
  放 AI 工程技能使用的配置文档，例如 issue tracker、triage labels、domain docs 布局。

- `docs/adr/`
  放架构决策记录。用于沉淀“为什么这么做”，不是重复实现细节。

## 落文档规则

- 新的业务需求文档，放 `docs/product/`
- 新的技术方案、表设计、模块设计、实现说明，放 `docs/engineering/`
- 新的第三方接口、设备协议、支付接入文档，放 `docs/integrations/`
- 新的部署、环境、服务器、运维说明，放 `docs/operations/`
- `CONTEXT.md` 只保留稳定的领域模型和关键规则，不堆实现细节
- 除索引型文档外，不再把长期文档直接平铺在 `docs/` 根目录

## 当前关键文档

- `docs/product/服务退款规则.md` — 线上订单取消与退款规则（保留参考）
- `docs/engineering/服务端规范.md` — 后端 NestJS 工程规范
- `docs/engineering/管理后台工程规范.md` — 管理后台 Vue3 工程规范
- `docs/engineering/小程序工程规范.md` — 小程序 uni-app 工程规范
- `docs/engineering/护理订单履约日报V1实施方案.md` — 护理日报生成规则
- `docs/integrations/智能工牌接口文档.md` — 智能工牌接口
- `docs/operations/项目辅助信息.md` — 运维辅助信息

## 历史文档

旧版 ToC 商城、订单、支付、小程序文档已迁移至 `docs/history/`：

- `history/PRD.md` — 旧版产品需求文档（已归档）
- `history/小程序工程规范.md` — 旧版 uni-app 小程序工程规范（已归档）
- `history/订单模块.md` — 旧版 ToC 订单与服务关系设计（已归档）
- `history/微信支付V3接入设计.md` — 旧版微信支付接入设计（已归档）
