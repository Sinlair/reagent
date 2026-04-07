<div align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="108" />
  <h1>ReAgent</h1>
  <p><strong>Turn ongoing research into a reusable workflow, not a one-off conversation.</strong></p>
  <p>Local-first research workspace for paper discovery, evidence review, research notes, and delivery.</p>
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
  <img src="./docs/reagent-console.png" alt="Screenshot of the ReAgent workbench home view" width="100%" />
</p>

## Table of Contents

- [Why ReAgent](#why-reagent)
- [Product Surfaces](#product-surfaces)
- [Quick Start](#quick-start)
- [Run Modes](#run-modes)
- [Repository Layout](#repository-layout)
- [Development](#development)
- [OpenClaw Plugin](#openclaw-plugin)
- [Documentation](#documentation)
- [Inspiration](#inspiration)
- [License](#license)

## Why ReAgent

ReAgent is not a chatbot with a few research buttons attached. It is a local research workspace designed for people who need to revisit topics, review evidence, save context, and ship useful outputs.

It is built for workflows such as:

- Defining reusable research templates with goals, background, and success criteria.
- Running repeated discovery instead of restarting the same search every week.
- Reviewing papers, repo findings, and feedback in one place.
- Saving notes so context survives across tasks and sessions.
- Turning research into reports, briefings, slides, and reusable artifacts.

It fits best when you need a controllable, inspectable workspace rather than a black-box assistant.

## Product Surfaces

The current web UI is organized around a small set of working surfaces:

- `Workbench` for current progress, latest results, and common next actions.
- `Main Workspace` for chat, quick research actions, recent tasks, and current workspace context.
- `Status` for activity, latest outputs, and system health.
- `Research Workspace` for templates, task lists, reports, schedules, topic reports, slides, and module files.
- `Research Map` for seeing how topics, evidence, reports, and files connect.
- `Research Notes` for searching, saving, and reopening file-backed notes.
- `Channels` for WeChat login, connection status, lifecycle changes, and channel events.
- `Agent Settings` and `Skills` for choosing the role, model, and tools used by chat.

## Quick Start

1. Create a local env file from `.env.example`.
2. Install dependencies.
3. Push the Prisma schema to the default SQLite database.
4. Start the dev server.

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

## Run Modes

The root app can run as a foreground dev process or as an always-on background service.

| Mode | Commands | Notes |
| --- | --- | --- |
| Development | `npm run dev` | Local development with live reload |
| PM2 | `npm run pm2:start` / `npm run pm2:restart` / `npm run pm2:logs` | Keep the app running in the background |
| Windows Service | `npm run service:install` / `npm run service:status` / `npm run service:start` / `npm run service:stop` | Machine-level runtime on Windows |

See [OPERATIONS.md](./OPERATIONS.md) for deployment and maintenance details.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `./` | Root ReAgent app, web UI, API server, and runtime |
| [`packages/reagent-core/`](./packages/reagent-core) | Reusable core research logic |
| [`packages/reagent-openclaw/`](./packages/reagent-openclaw) | Installable OpenClaw plugin package |
| [`package/`](./package) | In-repo OpenClaw WeChat reference package kept for compatibility work |
| [`docs/`](./docs) | Product visuals and supporting docs |

## Development

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

## OpenClaw Plugin

Install the ReAgent OpenClaw plugin with:

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

Plugin source lives in [packages/reagent-openclaw/](./packages/reagent-openclaw).

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- Product blueprint: [agent.md](./agent.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Operations: [OPERATIONS.md](./OPERATIONS.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security: [SECURITY.md](./SECURITY.md)

## Inspiration

ReAgent is shaped by research-agent and research-workspace projects such as:

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)

For a closer comparison, see [docs/research-agent-landscape.md](./docs/research-agent-landscape.md).

## License

Released under the [MIT License](./LICENSE).
