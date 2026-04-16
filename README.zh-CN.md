<div align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="108" />
  <h1>ReAgent</h1>
  <p><strong>一个面向长时研究工作流的 standalone、local-first runtime 与 CLI。</strong></p>
  <p>用一套常驻运行时统一承载 research、memory、channels、jobs 和可复用交付产物。</p>
  <p>
    <a href="./README.md"><strong>English</strong></a>
    <span>&nbsp;|&nbsp;</span>
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
  <p>
    <a href="./ROADMAP.md">Roadmap</a>
    <span>&nbsp;|&nbsp;</span>
    <a href="./OPERATIONS.md">Operations</a>
    <span>&nbsp;|&nbsp;</span>
    <a href="./CONTRIBUTING.md">Contributing</a>
  </p>
</div>

<p align="center">
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node.js 22+" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://www.prisma.io/">
    <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  </a>
  <a href="https://github.com/Sinlair/reagent/actions/workflows/ci.yml">
    <img src="https://github.com/Sinlair/reagent/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

<p align="center">
  <img src="./docs/reagent-console-zh.png" alt="ReAgent console" width="100%" />
</p>

## 一眼看懂

- 主产品名是 `reagent`
- 唯一官方 npm 安装入口是 `@sinlair/reagent`
- 唯一官方命令是 `reagent`
- 主控制面是 CLI，Web 控制台是辅助查看面
- 一套常驻 runtime 同时负责 research、memory、channels、jobs 和 durable artifacts
- 研究过程不是一次性聊天，而是可回看、可复用、可检查的工作区状态
- Hermes Agent 是明确的 runtime 设计参考，尤其是 hooks、tool orchestration、skills、jobs、delegation 这些 seams

## ReAgent 是什么

ReAgent 不是一个“聊天壳子 + 几个研究命令”的轻包装。

它是一个面向研究工作流的 runtime 与 CLI，适合这些诉求：

- 需要结构化 research brief，而不是零散 prompt
- 需要 durable memory，而不是只靠聊天上下文
- 需要可见的长任务状态，而不是黑盒后台执行
- 需要可复用产物，而不是一次性回答
- 需要可检查的 runtime seams，而不是不可解释的 orchestration

目前 ReAgent 最强的方向是：

- 研究任务编排
- 文件化 workspace memory
- 证据驱动的报告
- 可复用交付产物
- 本地 runtime 与服务控制

## 核心运行时能力

当前 runtime 已经包含：

- direct、UI、WeChat、OpenClaw 四类入口的 entry-aware toolsets
- canonical agent runtime surface：根 CLI 的 `reagent agent ...` 与 HTTP 的 `/api/agent/*`
- tool registry 与 tool execution pipeline
- runtime hooks、tool policies 与内建 audit trail
- 结构化 session digest，而不是只依赖最近聊天轮次
- progressive workspace skill disclosure，可带 reference files
- OpenClaw host session linkage，可显式看到 runtime session 与 host session 的对应关系
- 定时 discovery 与 memory compaction 的统一 job runtime observability
- research handoff workstreams：`search`、`reading`、`synthesis`
- bounded research-only delegation，并将 delegation 记录与 workstream artifact 持久化

面向 operator 的示例：

```bash
reagent runtime jobs
reagent agent runtime
reagent agent sessions
reagent agent session wechat:wx-user-1
reagent agent host sessions
reagent research discovery scheduler runtime
reagent memory scheduler runtime
reagent research handoff <taskId>
reagent research workstream <taskId> search
```

## 当前产品面

ReAgent 当前可以分成五个实用表面：

- `research`：排队或运行 research task，管理 direction profile，查看 discovery plan 与 scheduler run，记录 feedback，浏览 research memory graph，重新打开 paper、repo、module、presentation、direction-report 等 artifact
- `memory`：把长期记忆和日记式记录写入文件，支持 recall、search、manual compaction 和 scheduled compaction
- `channels`：通过 `mock`、`native`、`openclaw` 三类 provider 接收 UI 或 WeChat 消息，推送 outbound reply，查看 lifecycle state、OpenClaw events 和 cached sessions
- `agent runtime`：按 session 调整 role、skills、model route、fallback routes、reasoning effort，查看 hooks、runtime history、host linkage 与 delegation，而不是把所有聊天都看成一个不透明 agent
- `workspace control`：管理 LLM provider routes、MCP servers、workspace skills、inbound command authorization，以及 JSON-backed config

示例：

```bash
reagent research directions
reagent research graph report --view asset
reagent memory recall "recent research choices"
reagent agent session wx-user-1
reagent agent profile wechat:wx-user-1
reagent agent hooks wechat:wx-user-1
reagent agent delegate wx-user-1 search --task <taskId>
reagent models routes
reagent mcp list
reagent skills list
reagent commands policy
```

## Canonical Agent Surface

ReAgent 现在有一套明确的一等公民 agent runtime surface：

- 根 CLI：`reagent agent ...`
- HTTP API：`/api/agent/*`
- Web console：`Agents` 与 `Sessions` 页面

这套 canonical surface 覆盖：

- runtime overview
- canonical session list 与 detail
- profile read/write：`role`、`skills`、`model`、`fallbacks`、`reasoning`
- runtime history 与 hook/audit inspection
- OpenClaw host session list/history：`agent host`
- bounded research-only delegation：`agent delegate` / `agent delegates`

兼容路径仍保留：

- `reagent channels agent ...`
- 顶层 `reagent sessions`、`reagent history`、`reagent watch`
- `/api/channels/wechat/agent*`

这意味着现有 operator 流程不会被直接打断，但新文档和新能力都应优先面向 canonical `agent` surface。

## 产品形态

ReAgent 的主循环是：

1. `reagent onboard`
2. `reagent home`
3. `reagent service ...`
4. `reagent runtime ...`
5. `reagent research ...`
6. `reagent memory ...`
7. 可选的 Web console 查看

设计原则很简单：

- 一个 runtime
- 一个 CLI
- 多个可复用的持久化产物

## 架构

代码层面，ReAgent 是一个 Fastify runtime：

- 提供 Web console
- 暴露 HTTP API
- 启动长任务相关的 scheduler

结构化 research 数据使用 Prisma 持久化，默认数据库是本地 SQLite。Workspace memory、channel traces、session digest、audit log 和 research artifacts 则保持 file-backed，方便 operator 直接检查。

当前 provider 栈包含：

- fallback 或 OpenAI LLM routes
- Crossref 与 arXiv discovery
- PDF parsing 与 paper reading
- 通过 mock、native、OpenClaw bridge 模式接入 WeChat

## Hermes Agent 视角

Hermes Agent 在这个仓库里不是一句“灵感来源”而已，而是 runtime 设计的明确参考系。

当前项目的基本判断是：

- `Hermes Agent` 更接近通用 agent runtime
- `ReAgent` 更接近 research workspace / research operating system
- ReAgent 应该吸收 Hermes 风格的 runtime seams：tool registry、runtime hooks、progressive skill disclosure、context compression、job runtime、constrained delegation
- ReAgent 不应该为了“像 Hermes”而丢掉自己的 research-first artifact / memory 模型

这些选择已经体现在 runtime、CLI 和仓库结构里，而不是停留在独立设计稿中。

## 快速开始

1. 安装依赖
2. 推送 Prisma schema
3. 启动 runtime，或先跑 onboarding

```bash
npm install
npm run db:push
npm run dev
```

然后打开 `http://127.0.0.1:3000/`。

最小本地配置：

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

如果 PowerShell 拦截 `npm`，可以使用 `npm.cmd`。

## 全局 CLI 安装

```bash
npm install -g @sinlair/reagent
reagent onboard
reagent home
reagent service run
```

发布包名是 `@sinlair/reagent`。  
安装后的命令是 `reagent`。

## 推荐 CLI 流程

首次使用：

```bash
reagent onboard
reagent home
reagent service run
```

修复流程：

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
reagent agent runtime
reagent agent sessions
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

## 运行时与服务模型

ReAgent 围绕常驻 runtime 设计。

常用入口：

- `reagent home` 查看总览
- `reagent onboard` 做首次初始化
- `reagent doctor` 做诊断和安全修复
- `reagent service ...` 管理常驻服务
- `reagent runtime ...` 查看 health、status、jobs、dashboard、logs、doctor
- `reagent agent ...` 查看 canonical agent runtime、host linkage 与 bounded delegation

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
- graph 与 memory
- task / report / presentation
- runtime 可见性
- agent runtime overview
- 选中 session 的 profile、history、hooks 与 delegation

CLI 更适合：

- 初始化
- runtime 控制
- 日常自动化
- 可重复脚本操作

## 受管运行时配置

运行时把可编辑的 JSON-backed config 放在 `workspace/channels/`：

- `llm-providers.json`：provider routes 与 defaults
- `mcp-servers.json`：remote MCP server registry
- `skills-config.json`：workspace skill enablement 与 env overrides
- `inbound-command-policy.json`：remote slash-command policy 与 allowlists

常用控制命令：

```bash
reagent config validate
reagent models routes
reagent mcp list
reagent skills list
reagent commands authorize openclaw wx-user-1 /memory-recall
```

## 知识、产物与运行时状态

ReAgent 会把研究状态真正落到工作区里，而不是只停留在聊天上下文。

关键层级：

- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- `memory-index.json`
- `channels/` 下的 runtime session digest、audit logs、agent runtime state
- `channels/agent-runtime.json`
- `channels/agent-delegations.json`
- `channels/openclaw-sessions.json` 与 `channels/openclaw-session-transcripts/`
- `research/task-runs.json`
- `research/rounds/<taskId>/`
- round 下的 `handoff.json`、`artifacts.json`、`workstreams/*.md`

持久化产物包括：

- report
- review
- presentation
- module asset
- workstream memo
- delegation record

## 仓库布局与主控入口

| 路径 | 用途 |
| --- | --- |
| `./` | 根 runtime、CLI、Web 与 API |
| [`src/`](./src) | runtime entry points、CLI surfaces、routes 与 core services |
| [`docs/`](./docs) | 配图与说明文档 |
| [`workspace/skills/`](./workspace/skills) | 工作区 skills 与参考文件 |
| [`package/`](./package) | 仓内 foundation package：插件宿主面与 SDK 对齐，供 bridge 与工具链共用 |
| [`upstream/openclaw/`](./upstream/openclaw) | 上游参考目录，用于 bridge 与兼容性对照 |

**怎么安装、谁来控场。** 官方路径仍然是全局安装 `@sinlair/reagent`，用唯一命令 `reagent` 做主控制面。运行时按“可检查、可对齐”来设计：WeChat bridge、宿主侧行为与扩展面都有对应落点，`package/` 里是这些契约的具体代码；需要宿主向操作时，同一套根 CLI 也提供 `reagent status`、`reagent sessions`、`reagent history`、`reagent watch`、`reagent inspect`、`reagent install` 等入口，与日常 research / memory 命令并列。

对于 agent runtime，优先使用 canonical root surface：

```bash
reagent agent runtime
reagent agent sessions
reagent agent session wechat:wx-user-1
reagent agent profile wechat:wx-user-1
reagent agent host sessions
reagent agent delegates
```

## 运行模式

| 模式 | 命令 | 说明 |
| --- | --- | --- |
| Development | `npm run dev` | 本地开发，带 live reload |
| PM2 | `npm run pm2:start` / `npm run pm2:restart` / `npm run pm2:logs` | 后台 runtime |
| Windows Service | `npm run service:install` / `npm run service:status` / `npm run service:start` / `npm run service:stop` | Windows 常驻服务 |

更多部署与维护细节见 [OPERATIONS.md](./OPERATIONS.md)。

## 开发校验

```bash
npm run check:all
npm run test
```

如果只想校验发布链路：

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
- 发布流程: [docs/release-process.md](./docs/release-process.md)
- 自演化能力图: [docs/reagent-self-evolution-map.md](./docs/reagent-self-evolution-map.md)
- 自演化任务清单: [docs/reagent-self-evolution-task-list.md](./docs/reagent-self-evolution-task-list.md)
- Research agent landscape notes: [docs/research-agent-landscape.md](./docs/research-agent-landscape.md)

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

## License

以 [MIT License](./LICENSE) 发布。
