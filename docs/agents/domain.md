# 领域文档布局

**布局：** 单上下文

核心领域上下文位于仓库根目录，支持文档按 `docs/` 分组：

- `CONTEXT.md` — 项目领域模型、业务对象、核心规则
- `docs/README.md` — 文档索引与阅读顺序
- `docs/product/` — 产品需求与范围文档
- `docs/engineering/` — 技术设计、模块设计、实施类文档
- `docs/integrations/` — 第三方接口与设备集成文档
- `docs/operations/` — 环境与运维参考文档
- `docs/adr/` — 架构决策记录（ADR）

## 消费规则

以下 skill 会读取对应文档：

| Skill | 读取文件 |
|-------|---------|
| `/diagnosing-bugs` | `CONTEXT.md` |
| `/tdd` | `CONTEXT.md` |
| `/grill-with-docs` | `CONTEXT.md` + `docs/adr/` |

## ADR 命名规范

`docs/adr/` 下的 ADR 文件遵循格式：`####-title-with-dashes.md`

示例：`docs/adr/001-database-provider-choice.md`

## 相关文档

- `docs/product/PRD.md` — 完整业务需求
- `docs/engineering/小程序技术栈与工程约定.md` — 小程序技术栈
- `docs/engineering/服务端目录结构.md` — 后端结构与约定
