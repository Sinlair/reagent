# ReAgent

ReAgent 是一个面向长期研究工作流的 `standalone`、`local-first` 常驻 runtime 和 CLI。它把 research、memory、channels、jobs 和交付产物收进同一个控制面，而不是只停留在聊天上下文里。

## 核心定位

- 唯一官方 npm 安装入口是 `@sinlair/reagent`
- 唯一官方命令是 `reagent`
- 主控制面是 CLI，Web 控制台是辅助查看面
- 目标不是“聊天壳子”，而是可持续运行的 research workspace / research OS

## 现在已经具备的运行时能力

- entry-aware toolsets，按 `direct / ui / wechat / openclaw` 区分能力边界
- tool registry、tool execution pipeline、runtime hooks 和 tool policy
- 内建 audit trail，记录 LLM 调用、tool 执行、tool blocked、reply emit
- session digest，把短期上下文结构化，而不是只靠最近几轮对话
- workspace skills 的 progressive disclosure，支持按需披露正文和 reference 文件
- 统一 job runtime，当前已覆盖 research discovery scheduler 和 memory auto-compaction
- research handoff workstreams，把 `search / reading / synthesis` 三条研究分工落成持久化 memo

## 适合什么场景

- 先写 brief，再做研究
- 持续跟踪同一个主题，而不是一次性问答
- 保留 memory、task、report、review、presentation、artifact
- 让研究过程可恢复、可复盘、可重试
- 让 runtime 的能力边界和运行痕迹可检查

## 快速开始

```bash
npm install
npm run db:push
npm run dev
```

最小本地配置：

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

如果 PowerShell 阻止 `npm`，请使用 `npm.cmd`。

## 全局安装

```bash
npm install -g @sinlair/reagent
reagent onboard
reagent home
reagent service run
```

## 推荐 CLI 流程

首次启动：

```bash
reagent onboard
reagent home
reagent service run
```

排障：

```bash
reagent doctor
reagent doctor --fix --skip-db
```

日常使用：

```bash
reagent home
reagent runtime status
reagent runtime jobs
reagent runtime logs --follow
reagent research recent
reagent research tasks
reagent memory recall "recent research choices"
reagent channels status
```

研究流程示例：

```bash
reagent research enqueue "multimodal web agents" --question "Which open-source baselines are strongest?"
reagent research tasks
reagent research handoff <taskId>
reagent research workstream <taskId> search
reagent research report <taskId>
```

## 产品形态

ReAgent 的主循环是：

1. `reagent onboard`
2. `reagent home`
3. `reagent service ...`
4. `reagent runtime ...`
5. `reagent research ...`
6. `reagent memory ...`
7. 可选的 web console 查看

设计原则：

- 一个 runtime
- 一个 CLI
- 多个可复用的持久化产物

## 知识、产物与运行时状态

ReAgent 会把研究状态真正落到工作区里，而不是只停留在聊天上下文。

关键层级：

- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- `memory-index.json`
- `channels/` 下的 session digest、audit、job runtime 状态
- `research/task-runs.json`
- `research/rounds/<taskId>/`
- round 下的 `handoff.json`、`artifacts.json`、`workstreams/*.md`

持久化产物包括：

- report
- review
- presentation
- module asset
- workstream memo

## 运行时与服务模型

ReAgent 是围绕常驻 runtime 设计的。

常用入口：

- `reagent home` 查看总览
- `reagent onboard` 做首次初始化
- `reagent doctor` 做诊断和安全修复
- `reagent service ...` 管理常驻服务
- `reagent runtime ...` 查看 health、status、jobs、dashboard、logs、doctor

服务生命周期：

```bash
reagent service install
reagent service status
reagent service start
reagent service restart
reagent service stop
```

## Web Console

Web 控制台是辅助 inspection surface，不是主控制面。

适合查看：

- artifact 明细
- memory 与 graph
- task / report / presentation
- runtime 可见性

CLI 更适合：

- 初始化
- runtime 控制
- 日常自动化
- 重复性脚本操作

## 仓库布局与主控入口

| 路径 | 用途 |
| --- | --- |
| `./` | 根 runtime、CLI、Web、API |
| [`docs/`](./docs) | 配图与说明文档 |
| [`workspace/skills/`](./workspace/skills) | 工作区技能与参考文件 |
| [`package/`](./package) | 仓内 foundation：插件宿主面与 SDK 对齐，供 bridge 与工具链共用 |

**怎么安装、谁来控场。** 官方路径仍然是全局安装 `@sinlair/reagent`，用唯一命令 `reagent` 做主控制面。运行时按「可检查、可对齐」来设计：WeChat bridge、宿主侧行为与扩展面都有对应落点——`package/` 里是跟踪这些契约的具体代码；需要宿主向操作时，同一套根 CLI 也提供 `reagent status`、`reagent sessions`、`reagent history`、`reagent watch`、`reagent inspect`、`reagent install` 等入口，与日常 research / memory 命令并列。背景与迁移记录见 [docs/openclaw-realignment.md](./docs/openclaw-realignment.md)、[docs/openclaw-realignment-worklog.md](./docs/openclaw-realignment-worklog.md)。

## 开发校验

```bash
npm run check:all
npm run test
```

如果只想校验发布链：

```bash
npm run release:verify
npm run release:pack
```

## 文档

- English README: [README.md](./README.md)
- 路线图: [ROADMAP.md](./ROADMAP.md)
- 运维说明: [OPERATIONS.md](./OPERATIONS.md)
- 贡献指南: [CONTRIBUTING.md](./CONTRIBUTING.md)
- 安全说明: [SECURITY.md](./SECURITY.md)
- OpenClaw realignment: [docs/openclaw-realignment.md](./docs/openclaw-realignment.md)
- OpenClaw worklog: [docs/openclaw-realignment-worklog.md](./docs/openclaw-realignment-worklog.md)
- Hermes-agent 设计备忘: [docs/hermes-agent-for-reagent.md](./docs/hermes-agent-for-reagent.md)

## 灵感来源

ReAgent 参考了这些项目的产品或运行时思路：

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
