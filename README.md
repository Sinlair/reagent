# ReAgent

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/Sinlair/reagent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sinlair/reagent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

面向研究工作的智能体控制台。

ReAgent 的目标不是做一个“通用聊天机器人”，而是做一个以研究流程为中心的个人研究操作台：发现论文、解析文章、分析代码仓库、沉淀记忆、生成方向报告和组会材料，并通过网页控制台和微信通道把这些能力串起来。

英文版说明见：[README.en.md](./README.en.md)

## 目录

- [为什么做这个项目](#为什么做这个项目)
- [适用场景](#适用场景)
- [核心能力](#核心能力)
- [典型使用流程](#典型使用流程)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [配置示例](#配置示例)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [工作区约定](#工作区约定)
- [关键接口](#关键接口)
- [开发状态](#开发状态)
- [路线图](#路线图)
- [常见问题](#常见问题)
- [相关文档](#相关文档)
- [贡献](#贡献)
- [许可证](#许可证)

## 为什么做这个项目

研究工作里最常见的问题，不是“找不到信息”，而是“信息太多，无法稳定沉淀成可复用的判断和产物”。

ReAgent 主要试图解决这些问题：

- 每日发现：根据研究方向自动搜集并排序近期论文
- 深度分析：从论文链接、文章链接或标题出发，生成结构化分析结果
- 代码挖掘：识别 GitHub 仓库，评估可复现性，提取可复用模块
- 研究综合：生成方向报告、基线建议、创新路线和组会演示稿
- 长期记忆：把方向偏好、研究目标、近期结论和工作产物保存在同一个工作区

## 适用场景

- 个人研究者想持续跟踪一个或多个研究方向
- 实验室成员想把论文阅读、代码挖掘和组会材料放到同一套工作流中
- 想验证“研究智能体 + 工作区记忆 + 微信通知”这类产品形态
- 想在本地搭一套可控、可改、可扩展的研究操作台

不太适合的场景：

- 单纯做大模型闲聊
- 不关心研究产物沉淀，只要一次性回答
- 只需要一个纯前端网页而不需要后端工作流

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 网页控制台 | 默认地址 `http://127.0.0.1:3000/` |
| 智能体运行时 | 支持角色、技能、模型路由、回退模型和推理强度 |
| 研究任务队列 | 支持任务状态追踪和结果持久化 |
| 论文发现 | 支持方向配置、自动检索计划和定时发现 |
| 多源发现 | 当前默认接入 Crossref 和 arXiv |
| 链接标准化 | 从文章中提取论文候选和 GitHub 仓库候选 |
| 论文深度分析 | 区分论文证据、代码证据、推断和猜测 |
| 仓库分析与模块提取 | 识别关键目录并下载可复用模块 |
| 反馈闭环 | 记录“有用 / 没用 / 更像这个 / 太理论”等反馈，并反向影响发现排序与调度 |
| 方向报告 | 生成方向概览、代表论文、常见基线、常见模块和建议路线 |
| 组会材料生成 | 生成演示稿草稿和相关产物 |
| 微信通道 | 支持 `mock`、`native`、`openclaw` |

## 典型使用流程

### 1. 建立研究方向

先把研究方向、偏好会场、关注数据集、当前目标等信息写进工作区。

### 2. 定时发现论文

系统根据研究方向生成检索计划，从论文源中抓取候选论文，做去重、排序和摘要，并在需要时通过微信推送。

### 3. 深入分析单篇论文

输入论文链接、文章链接或标题后，系统会：

- 标准化文章内容
- 提取论文候选
- 提取 GitHub 仓库候选
- 生成结构化分析结论

### 4. 挖掘代码和模块

如果存在代码仓库，系统会继续分析仓库结构、关键目录和可复用模块，并把相关信息沉淀到工作区。

### 5. 生成方向报告和组会材料

基于最近的论文、仓库和反馈信号，系统可以继续生成：

- 方向报告
- 基线建议
- 创新路线
- 组会演示稿草稿

## 系统架构

```text
用户 / 微信 / 网页控制台
          |
          v
+-------------------------+
|      Fastify 服务       |
|   路由 + 服务 + 运行时  |
+-------------------------+
          |
          +--> 智能体运行时
          |     - 角色
          |     - 技能
          |     - 工具路由
          |
          +--> 研究工作流
          |     - 方向管理
          |     - 论文发现
          |     - 链接标准化
          |     - 论文分析
          |     - 仓库分析
          |     - 模块提取
          |     - 基线建议
          |     - 方向报告
          |     - 演示稿生成
          |
          +--> 工作区状态
                - 记忆
                - 技能
                - 模型配置
                - MCP 配置
                - 研究产物
```

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本
- Windows PowerShell 环境下请优先使用 `npm.cmd`

### 启动开发环境

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd --prefix package install
npm.cmd run db:push
npm.cmd run dev
```

启动后打开：

- `http://127.0.0.1:3000/`

### 构建并运行

```powershell
npm.cmd run build
npm.cmd start
```

## 配置示例

最小本地联调：

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

使用 OpenAI `responses` 接口：

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WIRE_API=responses
OPENAI_MODEL=gpt-5.4
```

使用兼容 `chat/completions` 的接口：

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://example.com/v1
OPENAI_WIRE_API=chat-completions
OPENAI_MODEL=gpt-4o
```

微信通道配置：

```env
WECHAT_PROVIDER=native
OPENCLAW_CLI_PATH=D:/nodejs/openclaw.cmd
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_GATEWAY_PASSWORD=
OPENCLAW_WECHAT_CHANNEL_ID=openclaw-weixin
```

完整示例见 [`.env.example`](./.env.example)。

## 常用命令

```powershell
npm.cmd run check
npm.cmd run check:all
npm.cmd run test:root
npm.cmd run test
npm.cmd run db:push
npm.cmd run db:studio
```

说明：

- `check`：检查根项目 TypeScript 类型
- `check:all`：同时检查根项目和 `package/` 子包
- `test:root`：只运行根项目测试
- `test`：运行根项目测试和 `package/` 子包测试

## 项目结构

```text
.
├─ src/                  # 服务端代码
├─ web/                  # 控制台前端静态资源
├─ prisma/               # 数据库 schema
├─ tests/                # 根项目测试
├─ workspace/            # 运行期工作区
├─ package/              # OpenClaw 微信插件子包
├─ agent.md              # 产品和能力规划
└─ OPERATIONS.md         # 部署与运维说明
```

## 工作区约定

ReAgent 会把长期状态保存在 `workspace/` 下，常见内容包括：

- `workspace/skills/*/SKILL.md`：自定义技能
- `workspace/channels/llm-providers.json`：模型和提供方配置
- `workspace/channels/mcp-servers.json`：MCP 服务配置
- `workspace/memory/` 与 `workspace/MEMORY.md`：文件型记忆
- `workspace/research/`：研究产物

## 关键接口

- `GET /health`
- `GET /api/runtime/meta`
- `POST /api/research`
- `GET /api/research/:taskId`
- `GET /api/research/recent`
- `GET /api/research/tasks`
- `GET /api/research/feedback`
- `POST /api/research/feedback`
- `GET /api/research/direction-reports/recent`
- `POST /api/research/direction-reports/generate`

## 开发状态

当前仓库已经具备可用的研究闭环，但仍处于持续演进阶段。

已经完成的主干能力：

- 研究方向管理
- 定时论文发现
- 多源论文发现
- 文章链接标准化
- 论文与仓库分析
- 反馈闭环
- 方向报告
- 组会演示稿生成

仍在继续补强的方向：

- 更丰富的前端研究面板
- 更多发现源
- 更细粒度的反馈驱动调度策略

## 路线图

- [x] 研究方向管理
- [x] 定时论文发现
- [x] 文章链接标准化
- [x] 论文深度分析
- [x] 仓库分析与模块提取
- [x] 反馈闭环
- [x] 方向报告
- [x] 组会演示稿草稿生成
- [ ] 更完整的前端研究视图
- [ ] 更多发现源接入
- [ ] 更强的调度策略和推送控制

## 常见问题

### 1. 这个项目适合直接线上部署吗？

目前更适合开发、验证和持续迭代。可以常驻运行，但仍建议把它视为一个持续演进中的研究工作台，而不是已经完全产品化的托管服务。

### 2. 没有 OpenAI 密钥也能跑吗？

可以。把 `LLM_PROVIDER` 设为 `fallback`，可以先完成流程联调和界面验证。

### 3. 没有真实微信环境也能跑吗？

可以。把 `WECHAT_PROVIDER` 设为 `mock`，就能在本地完成大部分工作流调试。

### 4. 子包和根仓库是什么关系？

根仓库是完整的研究控制台；`package/` 是 `@tencent-weixin/openclaw-weixin` 插件子包，负责 OpenClaw 微信通道相关能力。

### 5. 根仓库现在有许可证吗？

有。根仓库现在使用 [MIT License](./LICENSE)。

## 测试与持续集成

仓库已经包含：

- 根项目集成测试
- `package/` 子包测试
- GitHub Actions 持续集成工作流

## 相关文档

- 运维说明：[OPERATIONS.md](./OPERATIONS.md)
- 产品规划：[agent.md](./agent.md)
- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 安全策略：[SECURITY.md](./SECURITY.md)
- OpenClaw 微信插件子包：[package/](./package)
- 子包许可证：[package/LICENSE](./package/LICENSE)

## 贡献

欢迎通过以下方式参与：

- 提交问题反馈
- 提交改进建议
- 补充测试
- 修复缺陷
- 优化文档

建议的本地提交流程：

```powershell
npm.cmd run check:all
npm.cmd run test
```

如果你准备提交较大改动，建议先阅读：

- [`agent.md`](./agent.md)
- [`OPERATIONS.md`](./OPERATIONS.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## 许可证

本仓库采用 [MIT License](./LICENSE)。
