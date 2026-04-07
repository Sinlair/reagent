# ReAgent

<p align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="96" />
</p>

<p align="center">
  Turn ongoing research into a reusable workflow, not a one-off conversation.
</p>

<p align="center">
  A local research workspace for paper discovery, evidence synthesis, research memory, and direction delivery.
</p>

<p align="center">
  <a href="./README.md">中文</a>
</p>

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/Sinlair/reagent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sinlair/reagent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

![ReAgent Console](./docs/reagent-console.png)

## What It Is

ReAgent is not a generic chatbot with a few research tools attached.

It is closer to a local `Research Workspace / Research OS`:

- define structured `Research Brief`s with goals, baselines, constraints, and evaluation criteria
- keep running discovery instead of restarting the search every week
- store papers, repos, evidence, feedback, and memory in one workspace
- turn outputs into reports, briefings, decks, and reusable module notes
- continue the loop through the web UI, WeChat, and OpenClaw plugin surfaces

## Who It Is For

- individual researchers tracking one or more directions over time
- lab members who need paper reading, repo inspection, and meeting prep in one workflow
- teams exploring a `research agent + workspace memory + delivery` product shape
- developers who want a controllable, hackable, local research workspace

## Current Capabilities

- structured `Research Brief`s
- brief-driven discovery
- paper analysis, repo analysis, and module extraction
- baseline suggestion and direction reports
- feedback loop
- memory graph and file-backed memory
- meeting deck generation
- WeChat / OpenClaw runtime integration
- scheduler, lifecycle audit, and always-on runtime visibility

## Workspace Surfaces

- `Home`
  Product landing surface with workspace pulse, latest outputs, and fast entry points.
- `Command Center`
  Health, recent activity, delivery posture, and latest outputs.
- `Agent Desk`
  Natural language and slash commands for research, memory, and delivery actions.
- `Evidence Workspace`
  Research briefs, tasks, scheduler control, reports, and artifacts.
- `Research Map`
  Relationships across directions, papers, repos, modules, reports, and presentations.
- `Knowledge Vault`
  File-backed research memory search, write, and preview.
- `Channels`
  WeChat / OpenClaw status, pairing, lifecycle audit, and recovery visibility.

## Quick Start

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:push
npm.cmd run dev
```

Open:

- `http://127.0.0.1:3000/`

Minimal local setup:

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

If you are using Windows PowerShell, prefer `npm.cmd`.

## Always-On Runtime

The root app already supports always-on operation. You do not need to keep a foreground terminal open.

Options:

- PM2
  - `npm.cmd run pm2:start`
  - `npm.cmd run pm2:restart`
  - `npm.cmd run pm2:logs`
- Windows service
  - `npm.cmd run service:install`
  - `npm.cmd run service:status`
  - `npm.cmd run service:start`
  - `npm.cmd run service:stop`

See [OPERATIONS.md](./OPERATIONS.md) for details.

## Repository Layout

- root
  The main ReAgent app, web workspace, and full runtime
- [`packages/reagent-core/`](./packages/reagent-core)
  Reusable core research logic package
- [`packages/reagent-openclaw/`](./packages/reagent-openclaw)
  ReAgent OpenClaw plugin package
- [`package/`](./package)
  OpenClaw WeChat channel reference package kept in-repo for compatibility and integration work

Notes:

- The repository itself is open source, but the root `package.json` stays `private: true` because the root app is not intended to be published directly to npm.
- The publish-oriented packages live under `packages/reagent-core` and `packages/reagent-openclaw`.

## Development And Validation

```powershell
npm.cmd run check:all
npm.cmd run test
```

If you only want to validate the publishable packages:

```powershell
npm.cmd run build:packages
npm.cmd run check:packages
```

## OpenClaw Plugin

Install the ReAgent OpenClaw plugin with:

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

Plugin source lives in [packages/reagent-openclaw/](./packages/reagent-openclaw).

## Reference Projects

These projects influenced ReAgent most directly:

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)

For a more detailed comparison, see [docs/research-agent-landscape.md](./docs/research-agent-landscape.md).

## Related Documents

- Chinese README: [README.md](./README.md)
- Product plan: [agent.md](./agent.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Operations: [OPERATIONS.md](./OPERATIONS.md)
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## License

This repository is licensed under the [MIT License](./LICENSE).
