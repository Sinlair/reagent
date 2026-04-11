<div align="center">
  <img src="./docs/reagent-mark.svg" alt="ReAgent logo" width="108" />
  <h1>ReAgent</h1>
  <p><strong>Standalone local-first runtime and CLI for long-running research workflows.</strong></p>
  <p>Use one always-on runtime for research, memory, channels, jobs, and durable delivery artifacts.</p>
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
  <img src="./docs/reagent-console.png" alt="ReAgent console" width="100%" />
</p>

## At A Glance

- `reagent` is the primary product surface.
- The only official npm install target is `@sinlair/reagent`.
- One always-on runtime acts as the control plane for research, memory, channels, jobs, and delivery.
- The CLI is the main control surface. The web console is a companion inspection surface.
- Research work is durable: briefs, tasks, reports, reviews, presentations, workstreams, and module assets stay visible after one run.
- Runtime configuration is managed locally: LLM routes, MCP servers, workspace skills, and inbound command policy all stay inspectable.
- Hermes Agent is an explicit runtime-design reference, especially for seams such as hooks, tool orchestration, skills, jobs, and delegation.

## What ReAgent Is

ReAgent is not a chat wrapper with a few extra research commands.

It is a standalone runtime and CLI for people who want:

- structured research briefs instead of ad-hoc prompts
- durable memory instead of chat-only context
- visible long-running task state instead of hidden background work
- reusable outputs instead of one-off answers
- inspectable runtime seams instead of opaque orchestration

ReAgent is currently strongest for:

- research task orchestration
- file-backed workspace memory
- evidence-backed reports
- reusable delivery artifacts
- local runtime and service control

## Core Runtime Capabilities

The current runtime includes:

- entry-aware toolsets for direct, UI, WeChat, and OpenClaw surfaces
- a tool registry and tool execution pipeline
- runtime hooks, tool policies, and built-in audit trails
- structured session digests instead of relying only on recent chat turns
- progressive workspace skill disclosure with optional reference files
- unified job runtime observability for scheduled discovery and memory compaction
- research handoff workstreams for `search`, `reading`, and `synthesis`

Operator-facing examples:

```bash
reagent runtime jobs
reagent research discovery scheduler runtime
reagent memory scheduler runtime
reagent research handoff <taskId>
reagent research workstream <taskId> search
```

## Current Product Areas

ReAgent currently spans five practical surfaces:

- `research`: queue or run research tasks, manage direction profiles, inspect discovery plans and scheduler runs, record feedback, traverse the research memory graph, and reopen paper, repo, module, presentation, and direction-report artifacts.
- `memory`: keep file-backed notes searchable and recallable, write durable entries, and run manual or scheduled compaction with visible policy and run history.
- `channels`: receive UI or WeChat messages through `mock`, `native`, or `openclaw` providers, push outbound replies, and inspect lifecycle state, OpenClaw events, and cached sessions.
- `agent runtime`: tune per-sender role, skills, model route, fallback routes, and reasoning effort instead of treating every conversation as one shared opaque agent.
- `workspace control`: manage LLM providers, MCP servers, workspace skills, and inbound command authorization from the CLI or JSON-backed config files.

Examples:

```bash
reagent research directions
reagent research graph report --view asset
reagent memory recall "recent research choices"
reagent channels agent session wx-user-1
reagent models routes
reagent mcp list
reagent skills list
reagent commands policy
```

## Product Shape

The main product loop is:

1. `reagent onboard`
2. `reagent home`
3. `reagent service ...`
4. `reagent runtime ...`
5. `reagent research ...`
6. `reagent memory ...`
7. optional web console inspection

The design principle is simple:

- one standalone runtime
- one CLI
- many durable artifacts

## Architecture

At the code level, ReAgent is a Fastify runtime that serves the web console, exposes HTTP APIs, and starts background schedulers for long-running work.

Structured research data is persisted through Prisma, with SQLite as the default local database. Workspace memory, channel traces, digests, and research artifacts remain file-backed so operators can inspect them directly.

The current provider stack combines fallback or OpenAI LLM routes, Crossref and arXiv discovery, PDF parsing for paper reading, and WeChat delivery through mock, native, or OpenClaw bridge modes.

## Hermes Agent Context

Hermes Agent is not just an inspiration link in this repo. It is a concrete reference point for how ReAgent thinks about long-running agent runtime design.

The working position in this repository is:

- `Hermes Agent` is closer to a general-purpose agent runtime.
- `ReAgent` is closer to a research workspace / research operating system.
- ReAgent should borrow Hermes-style runtime seams such as tool registry, runtime hooks, progressive skill disclosure, context compression, job runtime, and constrained delegation.
- ReAgent should not flatten itself into "another Hermes" and lose its research-first artifact and memory model.

See [docs/hermes-agent-for-reagent.md](./docs/hermes-agent-for-reagent.md) for the internal design memo that compares the two projects and explains what ReAgent wants to learn from Hermes Agent.

## Quick Start

1. Install dependencies.
2. Push the Prisma schema.
3. Start the runtime or onboard first.

```bash
npm install
npm run db:push
npm run dev
```

Then open `http://127.0.0.1:3000/`.

Minimal local setup:

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

If PowerShell blocks `npm`, use `npm.cmd`.

## Global CLI Install

```bash
npm install -g @sinlair/reagent
reagent onboard
reagent home
reagent service run
```

The published package name is `@sinlair/reagent`.
The installed command is `reagent`.

## Recommended CLI Flow

First-run flow:

```bash
reagent onboard
reagent home
reagent service run
```

Repair flow:

```bash
reagent doctor
reagent doctor --fix --skip-db
```

Daily control flow:

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

Example research flow:

```bash
reagent research enqueue "multimodal web agents" --question "Which open-source baselines are strongest?"
reagent research tasks
reagent research handoff <taskId>
reagent research workstream <taskId> search
reagent research report <taskId>
```

## Runtime And Service Model

ReAgent is built around an always-on runtime.

Use:

- `reagent home` for the product overview
- `reagent onboard` for first-run setup
- `reagent doctor` for diagnostics and safe local repair
- `reagent service ...` to manage the supervised runtime
- `reagent runtime ...` to inspect health, status, jobs, dashboard, logs, and doctor output

Always-on service lifecycle:

```bash
reagent service install
reagent service status
reagent service start
reagent service restart
reagent service stop
```

## Web Console

The web console is a companion surface, not the main control plane.

Use it for:

- artifact inspection
- graph and memory exploration
- task and report browsing
- operational visibility

Use the CLI for:

- first-run setup
- runtime control
- day-to-day automation
- scripting and repeatable operations

## Managed Runtime Config

The runtime keeps editable JSON-backed config under `workspace/channels/`:

- `llm-providers.json` for provider routes and defaults
- `mcp-servers.json` for remote MCP server registry
- `skills-config.json` for workspace skill enablement and env overrides
- `inbound-command-policy.json` for remote slash-command policy and allowlists

Common control commands:

```bash
reagent config validate
reagent models routes
reagent mcp list
reagent skills list
reagent commands authorize openclaw wx-user-1 /memory-recall
```

## Knowledge And Artifact Model

ReAgent keeps research state durable.

Key layers:

- `MEMORY.md` for long-term memory
- `memory/YYYY-MM-DD.md` for daily notes
- indexed metadata in `memory-index.json`
- runtime session digests and audit logs under `channels/`
- research task runs in `research/task-runs.json`
- research rounds in `research/rounds/<taskId>/`
- handoff dossiers and workstream memos under each research round
- reports, reviews, presentations, and module assets as reusable artifacts

This is intentional:

- memory is not just chat history
- research is not just one synchronous run
- outputs are meant to be reopened and reused
- runtime state is meant to be inspectable

## Repository Layout

| Path | Purpose |
| --- | --- |
| `./` | Root ReAgent runtime, CLI, web console, and API server |
| [`src/`](./src) | Runtime entry points, CLI surfaces, routes, and core services |
| [`docs/`](./docs) | Product visuals and supporting docs |
| [`workspace/skills/`](./workspace/skills) | Local workspace skills and references |
| [`package/`](./package) | In-repo foundation package: plugin host surface and SDK alignment for bridge and tooling |
| [`upstream/openclaw/`](./upstream/openclaw) | Imported upstream reference used for compatibility tracking and bridge realignment |

**How you install and drive ReAgent.** The supported path is still the standalone package (`npm install -g @sinlair/reagent`) and the `reagent` command as the single control plane. The runtime is built so host-style behavior, the WeChat bridge path, and extension surfaces stay inspectable rather than forked in secret: the foundation code under `package/` is the concrete place that tracks those contracts, and the same root CLI exposes host-oriented operations (`reagent status`, `reagent sessions`, `reagent history`, `reagent watch`, `reagent inspect`, `reagent install`) when you need them beside everyday research and memory commands. For background on parity work and migration notes, see [docs/openclaw-realignment.md](./docs/openclaw-realignment.md) and [docs/openclaw-realignment-worklog.md](./docs/openclaw-realignment-worklog.md).

## Run Modes

| Mode | Commands | Notes |
| --- | --- | --- |
| Development | `npm run dev` | Local development with live reload |
| PM2 | `npm run pm2:start` / `npm run pm2:restart` / `npm run pm2:logs` | Background runtime with PM2 |
| Windows Service | `npm run service:install` / `npm run service:status` / `npm run service:start` / `npm run service:stop` | Machine-level runtime on Windows |

See [OPERATIONS.md](./OPERATIONS.md) for deployment and maintenance details.

## Development

Validation:

```bash
npm run check:all
npm run test
```

If you only want to validate the standalone publishable package:

```bash
npm run release:verify
npm run release:pack
```

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Operations: [OPERATIONS.md](./OPERATIONS.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security: [SECURITY.md](./SECURITY.md)
- Release process: [docs/release-process.md](./docs/release-process.md)
- Self-evolution capability map: [docs/reagent-self-evolution-map.md](./docs/reagent-self-evolution-map.md)
- Self-evolution task list: [docs/reagent-self-evolution-task-list.md](./docs/reagent-self-evolution-task-list.md)
- OpenClaw compatibility plan: [docs/openclaw-full-compatibility-plan.md](./docs/openclaw-full-compatibility-plan.md)
- OpenClaw realignment: [docs/openclaw-realignment.md](./docs/openclaw-realignment.md)
- OpenClaw worklog: [docs/openclaw-realignment-worklog.md](./docs/openclaw-realignment-worklog.md)
- OpenClaw upstream worklog: [docs/openclaw-upstream-worklog.md](./docs/openclaw-upstream-worklog.md)
- OpenClaw upstream import: [docs/openclaw-upstream-import.md](./docs/openclaw-upstream-import.md)
- OpenClaw migration map: [docs/openclaw-migration-map.md](./docs/openclaw-migration-map.md)
- Research agent landscape notes: [docs/research-agent-landscape.md](./docs/research-agent-landscape.md)
- Hermes-agent design memo: [docs/hermes-agent-for-reagent.md](./docs/hermes-agent-for-reagent.md)

## Inspiration

ReAgent is informed by projects such as:

- [GPT Researcher](https://github.com/assafelovic/gpt-researcher)
- [deer-flow](https://github.com/bytedance/deer-flow)
- [PASA](https://github.com/bytedance/pasa)
- [Paper2Agent](https://github.com/jmiao24/Paper2Agent)
- [enterprise-deep-research](https://github.com/SalesforceAIResearch/enterprise-deep-research)
- [InternAgent](https://github.com/InternScience/InternAgent)
- [OpenClaw](https://github.com/openclaw/openclaw)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)

## License

Released under the [MIT License](./LICENSE).
