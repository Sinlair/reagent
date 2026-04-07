<div align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent 标志" width="108" />
  <h1>ReAgent</h1>
  <p><strong>把持续科研工作变成可复用流程，而不是一次性对话。</strong></p>
  <p>面向论文发现、证据整理、研究记忆与结果交付的本地优先研究工作台。</p>
  <p>
    <a href="./README.md">English</a>
    <span>&nbsp;|&nbsp;</span>
    <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
  </p>
  <p>
    <a href="./ROADMAP.md">路线图</a>
    <span>&nbsp;•&nbsp;</span>
    <a href="./CONTRIBUTING.md">贡献指南</a>
    <span>&nbsp;•&nbsp;</span>
    <a href="./OPERATIONS.md">运维说明</a>
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
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT 许可证" />
  </a>
</p>

<p align="center">
  <img src="./docs/reagent-console.png" alt="ReAgent 控制台截图" width="100%" />
</p>

<a id="目录"></a>
## 目录

- [为什么是 ReAgent](#为什么是-reagent)
- [核心亮点](#核心亮点)
- [工作流](#工作流)
- [快速开始](#快速开始)
- [运行模式](#运行模式)
- [仓库结构](#仓库结构)
- [开发校验](#开发校验)
- [OpenClaw 插件](#openclaw-插件)
- [相关文档](#相关文档)
- [参考项目](#参考项目)
- [许可证](#许可证)

<a id="为什么是-reagent"></a>
## 为什么是 ReAgent

> ReAgent 不是“外挂了几个研究按钮的聊天机器人”，它更接近一个本地化的 `Research Workspace / Research OS`。

它适合那些不满足于一次性回答、而是需要完整研究闭环的人：

- 🧭 用结构化 `Research Brief` 固定研究目标、baseline、约束条件和评估标准。
- 🔎 持续做 discovery，而不是每周从零开始重新搜索。
- 🧠 把论文、仓库、证据、反馈和记忆放进同一个 workspace。
- 🧾 把分析沉淀成报告、briefing、deck 和可复用模块笔记。
- 🌐 通过 Web 控制台、WeChat 和 OpenClaw 插件继续推进下一轮研究。

更适合这些场景：

- 长期跟踪一个或多个研究方向的个人研究者
- 需要把读论文、看 repo、做组会材料串成同一套流程的实验室成员
- 想验证 `research agent + workspace memory + delivery` 产品形态的团队
- 想在本地搭一套可控、可改、可扩展研究工作台的开发者

<a id="核心亮点"></a>
## 核心亮点

| 模块 | 你能得到什么 |
| --- | --- |
| 🔎 Brief 驱动 discovery | 检索始终围绕明确的目标、baseline 和评估标准展开，而不是松散 prompt。 |
| 📄 论文与仓库分析 | 在同一个闭环里做论文分析、repo 检查和可复用模块提取。 |
| 🧠 可积累研究记忆 | 通过文件化 memory 和可建图的数据结构沉淀 artifacts、报告与反馈。 |
| 🧾 面向交付的输出 | 生成方向报告、baseline 建议、日报摘要和组会 deck 材料。 |
| 🔌 多入口协同 | Web 工作台、WeChat 通道和 OpenClaw 插件共享同一套研究流程。 |
| ⚙️ 本地优先运行时 | 可以本地运行、后台常驻，并且保留对运行状态的可见性与可检查性。 |

<a id="工作流"></a>
## 工作流

```text
Research Brief
  -> Discovery
  -> Paper / Repo Analysis
  -> Synthesis
  -> Report / Deck / Briefing
  -> Feedback
  -> Memory
  -> Next Research Round
```

当前工作台主要界面包括：

- `Home`：看 workspace 脉搏、最新产出和快速入口
- `Command Center`：看健康状态、近期活动、交付态势和运行时可见性
- `Agent Desk`：用自然语言和 slash commands 驱动研究动作
- `Evidence Workspace`：管理 briefs、任务、scheduler、报告和 artifacts
- `Research Map`：查看方向、论文、仓库、模块和演示材料之间的关系
- `Knowledge Vault`：搜索、写入和预览 file-backed memory
- `Channels`：查看 WeChat / OpenClaw 状态、pairing、生命周期审计和恢复情况

<a id="快速开始"></a>
## 快速开始

1. 由 `.env.example` 创建本地 `.env` 文件。
2. 安装依赖。
3. 将 Prisma schema push 到默认 SQLite 数据库。
4. 启动开发服务。

```bash
npm install
npm run db:push
npm run dev
```

打开 `http://127.0.0.1:3000/`。

如果只是想先本地跑通最小闭环，可以使用：

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

如果 PowerShell 对 `npm` 有执行限制，请改用 `npm.cmd`。

全局 CLI 安装：

```bash
npm install -g @sinlair/reagent
reagent init
reagent gateway
```

发布到 npm 的包名是 `@sinlair/reagent`，安装后的命令名是 `reagent`。

常驻 gateway 生命周期：

```bash
reagent gateway install
reagent gateway status
reagent gateway restart
reagent gateway stop
```

<a id="运行模式"></a>
## 运行模式

根应用既可以前台开发运行，也可以后台常驻。

| 模式 | 命令 | 说明 |
| --- | --- | --- |
| 🧪 开发模式 | `npm run dev` | 本地实时开发 |
| ♻️ PM2 | `npm run pm2:start` / `npm run pm2:restart` / `npm run pm2:logs` | 适合后台常驻 |
| 🪟 Windows 服务 | `npm run service:install` / `npm run service:status` / `npm run service:start` / `npm run service:stop` | 适合 Windows 机器级常驻 |

部署和维护细节见 [OPERATIONS.md](./OPERATIONS.md)。

<a id="仓库结构"></a>
## 仓库结构

| 路径 | 作用 |
| --- | --- |
| `./` | ReAgent 根应用、Web 控制台、API 服务和完整运行时 |
| [`packages/reagent-core/`](./packages/reagent-core) | 可复用的核心研究逻辑 |
| [`packages/reagent-openclaw/`](./packages/reagent-openclaw) | 可安装的 OpenClaw 插件包 |
| [`package/`](./package) | 为兼容和联调保留在仓库内的 OpenClaw WeChat 参考包 |
| [`docs/`](./docs) | 产品截图、发行说明和补充文档 |

补充说明：

- 根应用现在可以作为 `@sinlair/reagent` 发布，并安装出全局 `reagent` 命令。
- 真正面向发布复用的包在 `packages/reagent-core` 和 `packages/reagent-openclaw`。

<a id="开发校验"></a>
## 开发校验

完整校验：

```bash
npm run check:all
npm run test
```

如果你只想验证可发布的 packages：

```bash
npm run build:packages
npm run check:packages
```

<a id="openclaw-插件"></a>
## OpenClaw 插件

安装 ReAgent 的 OpenClaw 插件：

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

插件源码位于 [packages/reagent-openclaw/](./packages/reagent-openclaw)。

<a id="相关文档"></a>
## 相关文档

- 📘 English README: [README.md](./README.md)
- 🧭 产品蓝图: [agent.md](./agent.md)
- 🗺️ 路线图: [ROADMAP.md](./ROADMAP.md)
- 🛠️ 运维说明: [OPERATIONS.md](./OPERATIONS.md)
- 🤝 贡献指南: [CONTRIBUTING.md](./CONTRIBUTING.md)
- 🔐 安全策略: [SECURITY.md](./SECURITY.md)

<a id="参考项目"></a>
## 参考项目

ReAgent 的定位和路线主要受这些 research-agent / research-workspace 项目影响：

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)

更细的对比见 [docs/research-agent-landscape.md](./docs/research-agent-landscape.md)。

<a id="许可证"></a>
## 许可证

本仓库基于 [MIT License](./LICENSE) 发布。
