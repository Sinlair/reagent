<div align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="108" />
  <h1>🧭 ReAgent</h1>
  <p><strong>Turn ongoing research into a reusable workflow, not a one-off conversation.</strong></p>
  <p>🧠 Local-first research workspace for paper discovery, evidence review, research notes, and delivery.</p>
  <p>
    <a href="./README.md"><strong>English</strong></a>
    <span>&nbsp;|&nbsp;</span>
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
  <p>
    <a href="./ROADMAP.md">Roadmap</a>
    <span>&nbsp;•&nbsp;</span>
    <a href="./CONTRIBUTING.md">Contributing</a>
    <span>&nbsp;•&nbsp;</span>
    <a href="./OPERATIONS.md">Operations</a>
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
  <img src="./docs/reagent-console.png" alt="English screenshot of the ReAgent workbench home page" width="100%" />
</p>

## 📌 What ReAgent Is

ReAgent is not a chatbot with a few research buttons attached. It is a local research workspace for people who need to revisit topics, inspect evidence, preserve context, and ship useful outputs.

It is designed for workflows such as:

- 🧭 Defining reusable research templates with goals, background, and success criteria.
- 🔎 Running repeated discovery instead of restarting the same search every week.
- 📚 Reviewing papers, repo findings, feedback, and notes in one place.
- 🧠 Preserving working context across tasks instead of losing it inside chat history.
- 🧾 Turning research into reports, briefings, slides, and reusable artifacts.

## ✨ Highlights

| Icon | Highlight | Why it matters |
| --- | --- | --- |
| 🧭 | Research templates | Save a reusable setup for a topic before spending time or compute. |
| 🔬 | Research workspace | Run tasks, inspect progress, read reports, and manage outputs in one page. |
| 🧠 | Research notes | Keep durable notes outside chat so context survives across sessions. |
| 🗺️ | Research map | Trace how topics, evidence, reports, and files connect. |
| 📦 | Reusable outputs | Produce topic reports, slides, module files, and other shareable artifacts. |
| 🔌 | Multi-surface access | Use the web UI, WeChat, and OpenClaw plugin without splitting the workflow. |
| ⚙️ | Local runtime control | Inspect channels, sessions, models, skills, logs, and deployment posture locally. |

## 🧠 How The Knowledge Base Is Built

ReAgent's knowledge base is file-backed first, then indexed for recall.

- 📝 Long-term notes are stored in `MEMORY.md`.
- 🗓️ Daily notes are stored in `memory/YYYY-MM-DD.md`.
- 🗂️ Every saved note is indexed into `memory-index.json` with title, snippet, source, confidence, tags, entity IDs, and timestamps.
- 🔎 Search works on real workspace files, while recall can merge indexed workspace memory with durable artifacts such as research templates, topic reports, and presentations.
- ♻️ Direction reports can flush high-signal summaries back into memory, so later tasks can recall them as context.
- 🧹 Memory policy lives in `memory-policy.json`, and older daily notes can be compacted into long-term summaries.
- 🧾 Every compaction is recorded in `memory-compactions.json`, so the history of what was folded and why remains visible.

The practical result is a local knowledge base with four layers working together:

- 📄 Raw Markdown notes for direct inspection.
- 🗃️ Indexed metadata for fast recall.
- 📚 Durable research artifacts that can also be recalled.
- 🧹 Compaction history and policy so memory does not become unmanageable over time.

## 🖥️ Product Surfaces

The current web UI is organized around a small set of working surfaces:

- 🏠 `Workbench`: current progress, latest results, and common next actions.
- 💬 `Main Workspace`: chat, quick research actions, recent tasks, and current workspace context.
- 📈 `Status`: activity, latest outputs, and system health.
- 🔬 `Research Workspace`: templates, task lists, reports, schedules, topic reports, slides, and module files.
- 🗺️ `Research Map`: how topics, evidence, reports, and files connect.
- 🧠 `Research Notes`: search, save, and reopen file-backed notes.
- 🔌 `Channels`: WeChat login, connection status, lifecycle changes, and channel events.
- 🤖 `Agent Settings` and `Skills`: choose the role, model, and tool access used by chat.

## 🚀 Quick Start

1. 📄 Create a local env file from `.env.example`.
2. 📦 Install dependencies.
3. 🗃️ Push the Prisma schema to the default SQLite database.
4. ▶️ Start the dev server.

```bash
npm install
npm run db:push
npm run dev
```

Open `http://127.0.0.1:3000/`.

Minimal local setup:

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

If PowerShell blocks `npm`, use `npm.cmd` instead.

Global CLI install:

```bash
npm install -g @sinlair/reagent
reagent init
reagent gateway
```

The published package name is `@sinlair/reagent`, while the installed command is `reagent`.

Always-on gateway lifecycle:

```bash
reagent gateway install
reagent gateway status
reagent gateway restart
reagent gateway stop
```

## 🔄 Run Modes

The root app can run as a foreground dev process or as an always-on background service.

| Icon | Mode | Commands | Notes |
| --- | --- | --- | --- |
| 🧪 | Development | `npm run dev` | Local development with live reload |
| ♾️ | PM2 | `npm run pm2:start` / `npm run pm2:restart` / `npm run pm2:logs` | Keep the app running in the background |
| 🪟 | Windows Service | `npm run service:install` / `npm run service:status` / `npm run service:start` / `npm run service:stop` | Machine-level runtime on Windows |

See [OPERATIONS.md](./OPERATIONS.md) for deployment and maintenance details.

## 🗂️ Repository Layout

| Icon | Path | Purpose |
| --- | --- | --- |
| 🧩 | `./` | Root ReAgent app, web UI, API server, and runtime |
| 🧠 | [`packages/reagent-core/`](./packages/reagent-core) | Reusable core research logic |
| 🔌 | [`packages/reagent-openclaw/`](./packages/reagent-openclaw) | Installable OpenClaw plugin package |
| 🧪 | [`package/`](./package) | In-repo OpenClaw WeChat reference package kept for compatibility work |
| 🖼️ | [`docs/`](./docs) | Product visuals and supporting docs |

## ✅ Development

Validation:

```bash
npm run check:all
npm run test
```

If you only want to validate the publishable packages:

```bash
npm run build:packages
npm run check:packages
```

## 🔌 OpenClaw Plugin

Install the ReAgent OpenClaw plugin with:

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

Plugin source lives in [packages/reagent-openclaw/](./packages/reagent-openclaw).

## 📚 Documentation

- 📘 Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- 🧭 Product blueprint: [agent.md](./agent.md)
- 🛣️ Roadmap: [ROADMAP.md](./ROADMAP.md)
- 🛠️ Operations: [OPERATIONS.md](./OPERATIONS.md)
- 🤝 Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- 🔒 Security: [SECURITY.md](./SECURITY.md)

## 🙌 Inspiration

ReAgent is shaped by research-agent and research-workspace projects such as:

- 🧪 [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- 🌊 [deer-flow](https://github.com/bytedance/deer-flow)
- 🧭 [PASA](https://github.com/bytedance/pasa)
- 📄 [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- 🏢 [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- 🤖 [InternAgent](https://github.com/InternScience/InternAgent)
- 🔓 [OpenClaw](https://github.com/openclaw/openclaw)

For a closer comparison, see [docs/research-agent-landscape.md](./docs/research-agent-landscape.md).

## 📄 License

Released under the [MIT License](./LICENSE).
