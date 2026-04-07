# ReAgent

<p align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="96" />
</p>

<p align="center">
  把持续科研做成一套可复用工作流，而不是一次性对话。
</p>

<p align="center">
  一个面向论文发现、证据整理、研究记忆和方向交付的本地研究工作台。
</p>

<p align="center">
  <a href="./README.en.md">English</a>
</p>

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/Sinlair/reagent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sinlair/reagent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![ReAgent Console](./docs/reagent-console.png)

## 是什么

ReAgent 不是“带几个研究按钮的聊天机器人”。

它更像一个本地 `Research Workspace / Research OS`：

- 用 `Research Brief` 固定研究目标、约束、baseline 和验证标准
- 持续做论文发现，而不是每周从零重搜
- 把论文、仓库、证据、反馈和记忆放进同一个 workspace
- 把输出沉淀成 report、briefing、deck 和 reusable module notes
- 通过网页工作台、WeChat 和 OpenClaw 插件继续推进下一步

## 适合谁

- 持续跟踪某个研究方向的个人研究者
- 需要整理论文、仓库和组会材料的实验室成员
- 想验证“研究 agent + workspace memory + delivery”产品形态的团队
- 想在本地搭一套可控、可改、可扩展研究工作台的开发者

## 当前能力

- 结构化 `Research Brief`
- brief 驱动的 discovery
- 论文分析、仓库分析、模块提取
- baseline suggestion 和 direction report
- feedback loop
- memory graph 和 file-backed memory
- meeting deck 生成
- WeChat / OpenClaw 运行时接入
- scheduler、lifecycle audit、always-on 运行可见性

## 工作台界面

- `Home`
  产品首页，展示 workspace pulse、最近产出和快速入口。
- `Command Center`
  看健康状态、近期活动、交付状态和最新输出。
- `Agent Desk`
  用自然语言和 slash commands 驱动研究、记忆和交付动作。
- `Evidence Workspace`
  管理 research brief、运行研究任务、配置 scheduler、查看报告和产物。
- `Research Map`
  看 direction、paper、repo、module、report、presentation 之间的关系。
- `Knowledge Vault`
  搜索、写入和预览 file-backed memory。
- `Channels`
  看 WeChat / OpenClaw 通道状态、pairing、lifecycle audit 和自动恢复。

## 快速开始

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:push
npm.cmd run dev
```

打开：

- `http://127.0.0.1:3000/`

最小本地联调配置：

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

如果你在 Windows PowerShell 下运行，建议直接使用 `npm.cmd`。

## 常驻运行

根应用已经支持常驻运行，不需要一直挂着前台终端。

可选方式：

- PM2
  - `npm.cmd run pm2:start`
  - `npm.cmd run pm2:restart`
  - `npm.cmd run pm2:logs`
- Windows service
  - `npm.cmd run service:install`
  - `npm.cmd run service:status`
  - `npm.cmd run service:start`
  - `npm.cmd run service:stop`

更多说明见 [OPERATIONS.md](./OPERATIONS.md)。

## 仓库结构

- 根目录
  ReAgent root app，本地网页工作台和完整运行时都在这里。
- [`packages/reagent-core/`](./packages/reagent-core)
  ReAgent 的可复用核心研究逻辑包。
- [`packages/reagent-openclaw/`](./packages/reagent-openclaw)
  ReAgent 的 OpenClaw 插件包。
- [`package/`](./package)
  OpenClaw WeChat channel 参考包，用于兼容/联调这条链路。
  它不是 ReAgent 主产品代码本体，保留它是为了和 OpenClaw WeChat 接入路径保持对齐。

说明：

- 根应用仓库是开源的，但根 `package.json` 仍保持 `private: true`，因为它不是面向 npm registry 发布的主包。
- 真正面向包化复用的代码在 `packages/reagent-core` 和 `packages/reagent-openclaw`。

## 开发与校验

```powershell
npm.cmd run check:all
npm.cmd run test
```

如果你只想检查可发布包：

```powershell
npm.cmd run build:packages
npm.cmd run check:packages
```

## OpenClaw 插件

安装 ReAgent 的 OpenClaw 插件：

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

插件源码见 [packages/reagent-openclaw/](./packages/reagent-openclaw)。

## 参考项目

这些项目更直接影响了 ReAgent 的定位和路线：

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)

更详细的比较见 [docs/research-agent-landscape.md](./docs/research-agent-landscape.md)。

## 相关文档

- 英文说明：[README.en.md](./README.en.md)
- 产品规划：[agent.md](./agent.md)
- 路线图：[ROADMAP.md](./ROADMAP.md)
- 运维说明：[OPERATIONS.md](./OPERATIONS.md)
- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 安全策略：[SECURITY.md](./SECURITY.md)

## 许可证

本仓库采用 [MIT License](./LICENSE)。
