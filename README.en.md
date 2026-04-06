# ReAgent

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/Sinlair/reagent/actions/workflows/ci.yml/badge.svg)](https://github.com/Sinlair/reagent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A research-oriented agent console.

ReAgent is not designed as a generic chatbot with some research features bolted on. It is a research workspace centered on continuous paper discovery, article ingestion, repository analysis, memory, direction reports, and meeting material generation, delivered through a web console and WeChat channels.

Chinese README: [README.md](./README.md)

## Table of Contents

- [Why This Project Exists](#why-this-project-exists)
- [Use Cases](#use-cases)
- [Core Capabilities](#core-capabilities)
- [Typical Workflow](#typical-workflow)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration Examples](#configuration-examples)
- [Common Commands](#common-commands)
- [Project Structure](#project-structure)
- [Workspace Conventions](#workspace-conventions)
- [Key Endpoints](#key-endpoints)
- [Project Status](#project-status)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Related Documents](#related-documents)
- [Contributing](#contributing)
- [License](#license)

## Why This Project Exists

The common problem in research work is not a lack of information. It is the lack of a stable way to turn too much information into reusable judgment and reusable artifacts.

ReAgent focuses on:

- Daily discovery: collect and rank recent papers for target directions
- Deep analysis: generate structured results from paper links, article links, or titles
- Code mining: identify GitHub repositories, assess reproducibility, and extract reusable modules
- Research synthesis: produce direction reports, baseline suggestions, innovation routes, and meeting decks
- Long-term memory: keep direction preferences, goals, findings, and artifacts in one workspace

## Use Cases

- Individual researchers tracking one or more research directions
- Lab members who want paper reading, code mining, and meeting preparation in one workflow
- Teams exploring a “research agent + workspace memory + WeChat delivery” product shape
- Developers building a controllable and extensible local research console

## Core Capabilities

| Capability | Description |
| --- | --- |
| Web console | Default address: `http://127.0.0.1:3000/` |
| Agent runtime | Roles, skills, model routing, fallbacks, reasoning effort |
| Research task queue | Track task state and persist outputs |
| Paper discovery | Direction-aware search plans and scheduled discovery |
| Multi-source discovery | Currently backed by Crossref and arXiv |
| Link ingestion | Extract paper and GitHub candidates from articles |
| Deep paper analysis | Distinguish paper evidence, code evidence, inference, and speculation |
| Repo analysis and module extraction | Inspect repository structure and download reusable modules |
| Feedback loop | Record positive and negative feedback and feed it back into ranking and scheduling |
| Direction reports | Generate direction overview, representative papers, common baselines, modules, and suggested routes |
| Meeting material generation | Produce presentation drafts and related artifacts |
| WeChat channels | Support `mock`, `native`, and `openclaw` |

## Typical Workflow

1. Define research directions and preferences.
2. Let the system discover recent papers on a schedule.
3. Ingest a paper link, article link, or title for deep analysis.
4. Continue into repository analysis and module extraction if code exists.
5. Generate direction reports, baseline suggestions, and meeting materials.

## Architecture

```text
User / WeChat / Web UI
        |
        v
+-------------------------+
|      Fastify Server     |
|   routes + services     |
+-------------------------+
        |
        +--> Agent Runtime
        +--> Research Workflow
        +--> Workspace State
```

## Quick Start

### Requirements

- Node.js 22+
- npm 10+
- On Windows PowerShell, prefer `npm.cmd`

### Start Development

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd --prefix package install
npm.cmd run db:push
npm.cmd run dev
```

Open:

- `http://127.0.0.1:3000/`

### Build and Run

```powershell
npm.cmd run build
npm.cmd start
```

## Configuration Examples

Minimal local setup:

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

OpenAI `responses` API:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WIRE_API=responses
OPENAI_MODEL=gpt-5.4
```

Compatible `chat/completions` API:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://example.com/v1
OPENAI_WIRE_API=chat-completions
OPENAI_MODEL=gpt-4o
```

WeChat channel setup:

```env
WECHAT_PROVIDER=native
OPENCLAW_CLI_PATH=D:/nodejs/openclaw.cmd
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_GATEWAY_PASSWORD=
OPENCLAW_WECHAT_CHANNEL_ID=openclaw-weixin
```

See [`.env.example`](./.env.example) for the full sample.

## Common Commands

```powershell
npm.cmd run check
npm.cmd run check:all
npm.cmd run test:root
npm.cmd run test
npm.cmd run db:push
npm.cmd run db:studio
```

## Project Structure

```text
.
├─ src/
├─ web/
├─ prisma/
├─ tests/
├─ workspace/
├─ package/
├─ agent.md
└─ OPERATIONS.md
```

## Workspace Conventions

- `workspace/skills/*/SKILL.md`: custom workspace skills
- `workspace/channels/llm-providers.json`: model and provider routing
- `workspace/channels/mcp-servers.json`: MCP server registry
- `workspace/memory/` and `workspace/MEMORY.md`: file-backed memory
- `workspace/research/`: research artifacts

## Key Endpoints

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

## Project Status

The repository already has a usable research loop, but it is still evolving.

Implemented:

- direction management
- scheduled discovery
- multi-source discovery
- article ingestion
- paper and repo analysis
- feedback loop
- direction reports
- meeting deck draft generation

Still improving:

- richer frontend research views
- more discovery sources
- stronger feedback-driven scheduling policies

## Roadmap

- [x] direction management
- [x] scheduled discovery
- [x] article ingestion
- [x] deep paper analysis
- [x] repo analysis and module extraction
- [x] feedback loop
- [x] direction reports
- [x] meeting deck drafts
- [ ] richer frontend research views
- [ ] more discovery sources
- [ ] stronger scheduling and push control

## FAQ

### Can I run this without OpenAI keys?

Yes. Use `LLM_PROVIDER=fallback` for local workflow and UI validation.

### Can I run this without a real WeChat environment?

Yes. Use `WECHAT_PROVIDER=mock`.

### Is this production-ready?

It is better described as a working research console under active iteration than a fully productized hosted service.

## Related Documents

- Operations: [OPERATIONS.md](./OPERATIONS.md)
- Product plan: [agent.md](./agent.md)
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- OpenClaw WeChat plugin package: [package/](./package)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This repository is licensed under the [MIT License](./LICENSE).
