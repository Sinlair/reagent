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
    <a href="./docs/index.md">Docs</a>
    <span>&nbsp;|&nbsp;</span>
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
- The public docs hub starts at [`docs/index.md`](./docs/index.md).
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
- a canonical agent runtime surface across root CLI (`reagent agent ...`) and HTTP (`/api/agent/*`)
- a tool registry and tool execution pipeline
- runtime hooks, tool policies, and built-in audit trails
- structured session digests instead of relying only on recent chat turns
- progressive workspace skill disclosure with optional reference files
- explicit host-session linkage for OpenClaw-backed conversations
- unified job runtime observability for scheduled discovery and memory compaction
- research handoff workstreams for `search`, `reading`, and `synthesis`
- bounded research-only delegation with durable delegation records and workstream artifacts

Operator-facing examples:

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

## Current Product Areas

ReAgent currently spans five practical surfaces:

- `research`: queue or run research tasks, manage direction profiles, inspect discovery plans and scheduler runs, record feedback, traverse the research memory graph, and reopen paper, repo, module, presentation, and direction-report artifacts.
- `memory`: keep file-backed notes searchable and recallable, write durable entries, and run manual or scheduled compaction with visible policy and run history.
- `channels`: receive UI or WeChat messages through `mock`, `native`, or `openclaw` providers, push outbound replies, and inspect lifecycle state, OpenClaw events, and cached sessions.
- `agent runtime`: inspect canonical sessions, tune per-session role, skills, model route, fallback routes, reasoning effort, hook history, host linkage, and bounded delegations instead of treating every conversation as one shared opaque agent.
- `workspace control`: manage LLM providers, MCP servers, workspace skills, and inbound command authorization from the CLI or JSON-backed config files.

Examples:

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

ReAgent now exposes one canonical agent runtime surface:

- root CLI: `reagent agent ...`
- HTTP API: `/api/agent/*`
- web console: `Agents` and `Sessions` panels

That surface covers:

- runtime overview
- canonical session list and detail
- profile read/write (`role`, `skills`, `model`, `fallbacks`, `reasoning`)
- runtime history and hook/audit inspection
- OpenClaw host session list/history under `agent host`
- bounded research-only delegation under `agent delegate` / `agent delegates`

Compatibility paths remain available:

- `reagent channels agent ...`
- top-level `reagent sessions`, `reagent history`, `reagent watch`
- `/api/channels/wechat/agent*`

The intent is to keep existing operator flows working while moving new documentation and new tooling toward the canonical `agent` surface.

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

Those choices are reflected directly in the runtime, CLI, and repository structure rather than a separate design memo.

## Get Started

ReAgent is designed to be installed and driven as a product, not as a repo-first demo.

Official install path:

```bash
npm install -g @sinlair/reagent
```

First-run path:

```bash
reagent onboard
reagent onboard --apply
reagent home
reagent service run
```

Default Web URL:

```text
http://127.0.0.1:3000/
```

The starter profile uses `fallback + mock`.
It is intended for first-run evaluation and walkthroughs, not as the final research-quality route.

## Product Surfaces

ReAgent is meant to be used through a few stable product surfaces:

- `reagent home`
  the product overview and next-step entrypoint
- `reagent research ...`
  briefs, tasks, reports, workstreams, and reusable artifacts
- `reagent memory ...`
  durable notes and recall
- `reagent agent ...`
  canonical runtime sessions, hooks, host linkage, and delegation
- `reagent openclaw ...`
  host-facing OpenClaw inspection
- `reagent workspace ...`
  backup snapshots, restore preview or apply, and support bundles

## Daily Use

Typical product commands:

```bash
reagent home
reagent runtime status
reagent agent runtime
reagent openclaw status
reagent research recent
reagent research tasks
reagent memory recall "recent research choices"
reagent workspace snapshot
```

Typical research flow:

```bash
reagent research directions
reagent research enqueue "multimodal web agents" --question "Which open-source baselines are strongest?"
reagent research tasks
reagent research report <taskId>
reagent research handoff <taskId>
```

## Web Console

The Web console is the companion inspection surface.

Use it for:

- first-run orientation
- discovery review
- report and artifact reading
- recent artifact reopen
- scheduler and digest configuration
- runtime and session inspection

The CLI remains the primary control plane.

## Recovery And Safety

ReAgent now treats recovery as a product surface, not just an internal maintenance concern.

Use:

```bash
reagent workspace snapshot
reagent workspace restore preview <snapshotPath>
reagent workspace restore apply <snapshotPath> --yes
reagent workspace support-bundle
```

These flows are designed to keep workspace state inspectable and recoverable without exposing raw secrets by default.

## OpenClaw Host Surface

Use the dedicated OpenClaw entrypoint when you want bridge-facing host state:

```bash
reagent openclaw
reagent openclaw status
reagent openclaw sessions
reagent openclaw history <sessionKey>
```

Use `reagent agent ...` when you want canonical runtime state.
Use `reagent openclaw ...` when you want host-facing bridge state.

## Docs

Start here:

- [Docs Hub](./docs/index.md)
- [Public Install And Quickstart](./docs/public-install.md)
- [Core Product Flows](./docs/core-flows.md)
- [Public Walkthroughs](./docs/walkthroughs.md)
- [OpenClaw Host Surface](./docs/openclaw-host-surface.md)
- [Positioning: ReAgent vs Hermes-Agent](./docs/positioning.md)
- [Developer Extensions: Skills, MCP, And Bridge Contracts](./docs/developer-extensions.md)
- [Release And Compatibility Rules](./docs/release-and-compatibility.md)
- [Operations](./OPERATIONS.md)
- [Contributing](./CONTRIBUTING.md)

## Product Positioning

ReAgent is a research-first workspace.

It borrows Hermes-style runtime seams such as:

- hooks
- audit trails
- progressive skill disclosure
- bounded delegation
- explicit host/runtime inspection

It does not present itself as a finished general-purpose agent runtime.
Its core product value is still durable research work, durable memory, and reusable artifacts.

## Documentation

- Chinese README: [README.zh-CN.md](./README.zh-CN.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Security: [SECURITY.md](./SECURITY.md)

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
