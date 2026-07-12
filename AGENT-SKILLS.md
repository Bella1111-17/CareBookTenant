# Skills

```
✔ on   ask-matt          · user   · 路由入口 — 告诉你该用哪个 skill
🔒      grill-me          · user   · 无代码库时打磨计划（无状态）
🔒      grill-with-docs   · user   · 有代码库时打磨计划，同时更新领域模型
✔ on   grilling          · user   · 穷举式追问，直到达成共识
✔ on   prd               · user   · 生成高质量 PRD
✔ on   to-prd            · user   · 将对话合成 PRD 并发布到 issue tracker
✔ on   to-issues         · user   · 将 PRD 拆分为独立可领取的 issues
✔ on   implement         · user   · 根据 PRD/issues 实现功能
✔ on   handoff           · user   · 压缩对话为跨会话传递文档
✔ on   triage            · user   · 对 issue tracker 中的问题分类定级
✔ on   code-review       · user   · 双轴审查 PR/分支（Standards + Spec）
✔ on   diagnosing-bugs    · user   · 困难 bug 的系统化诊断循环
✔ on   improve-codebase-architecture · user · 发现代码深化机会，生成可视化报告
✔ on   tdd               · user   · 测试驱动开发红→绿循环参考
✔ on   domain-modeling   · user   · 构建和淬炼项目领域模型
✔ on   codebase-design   · user   · 深度模块设计词汇（module/interface/depth/seam…）
✔ on   prototype         · user   · 构建一次性原型回答设计问题
✔ on   research          · user   · 委托后台 agent 做一手资料调研
✔ on   setup-matt-pocock-skills · user · 初始化 issue tracker 等配置
✔ on   writing-great-skills     · user · 编写和编辑 skill 的规范参考
✔ on   teach             · user   · 多会话教学 workspace
✔ on   pdf               · user   · PDF 读取与解析
✔ on   deep-research     · user   · 深度网络调研，生成引用报告
✔ on   verify            · user   · 运行应用验证代码变更是否有效
✔ on   simplify          · user   · 代码复用/简化/效率审查并应用修复
✔ on   code-review       · user   · 正确性 bug 和代码质量审查
✔ on   review            · user   · PR 审查
✔ on   security-review   · user   · 安全审查
✔ on   loop              · user   · 定时循环运行 slash 命令
✔ on   fewer-permission-prompts · user · 扫描 transcript 减少权限提示
✔ on   claude-api        · user   · Claude API / SDK 参考
✔ on   update-config     · user   · 配置 Claude Code harness（settings.json）
✔ on   keybindings-help  · user   · 自定义键盘快捷键

✔ on   uview-pro         · project · uView Pro 组件库完整技能集
✔ on   uni-app           · project · uni-app 开发参考
✔ on   nestjs-patterns   · project · NestJS 模式参考
✔ on   mermaid-expert    · project · Mermaid 图表专家
✔ on   frontend-design-direction · project · 前端设计方向指导
✔ on   echarts-visualization-guide · project · ECharts 可视化指南
✔ on   dify-dsl-generator · project · Dify 工作流 DSL 生成器
✔ on   find-skills       · project · 搜索和安装 agent skills
✔ on   run               · project · 启动并驱动项目验证变更
✔ on   init              · project · 初始化 CLAUDE.md
```

## 状态说明

| 标记 | 含义 |
|---|---|
| `✔ on` | 已启用，model 可调用 |
| `🔒` | user-only，仅限手动触发 |

## 类型说明

| 类型 | 含义 |
|---|---|
| `user` | 用户级 skill（手动触发为主） |
| `project` | 项目内置 skill（model 可调用） |
