# ReAgent Docs

ReAgent is a local-first research workspace with Hermes-style runtime seams.

This page is the primary documentation entrypoint.

## Start Here

If this is your first time:

1. [Public Install And Quickstart](./public-install.md)
2. [Core Product Flows](./core-flows.md)
3. [Public Walkthroughs](./walkthroughs.md)

## Choose A Path

| I want to... | Go here |
| --- | --- |
| Install ReAgent and open the Web console | [Public Install And Quickstart](./public-install.md) |
| Understand the main user flows | [Core Product Flows](./core-flows.md) |
| Evaluate the product with concrete examples | [Public Walkthroughs](./walkthroughs.md) |
| Inspect the OpenClaw host-facing surface | [OpenClaw Host Surface](./openclaw-host-surface.md) |
| Understand how ReAgent differs from Hermes-Agent | [Positioning](./positioning.md) |
| Extend ReAgent with skills, MCP, or bridge/plugin contracts | [Developer Extensions](./developer-extensions.md) |
| Contribute to the repo | [Contributing Guide](../CONTRIBUTING.md) |
| Operate always-on runtime installs | [Operations](../OPERATIONS.md) |
| Understand release and compatibility rules | [Release And Compatibility Rules](./release-and-compatibility.md) |

## User Docs

- [Public Install And Quickstart](./public-install.md)
- [Core Product Flows](./core-flows.md)
- [Public Walkthroughs](./walkthroughs.md)
- [OpenClaw Host Surface](./openclaw-host-surface.md)
- [Positioning: ReAgent vs Hermes-Agent](./positioning.md)

## Developer Docs

- [Developer Extensions: Skills, MCP, And Bridge Contracts](./developer-extensions.md)
- [Contributing Guide](../CONTRIBUTING.md)

## Operations Docs

- [Operations](../OPERATIONS.md)
- [Release And Compatibility Rules](./release-and-compatibility.md)

## Current Product Surfaces

- `research`: briefs, discovery, reports, workstreams, presentations, and reusable artifacts
- `memory`: file-backed notes, recall, search, and compaction
- `channels`: UI, WeChat, and OpenClaw-backed messaging surfaces
- `agent runtime`: canonical session, profile, history, hooks, host linkage, and delegation surfaces
- `workspace control`: LLM routes, MCP, skills, inbound command policy, snapshots, restore, and support bundles

## Product Notes

- ReAgent is not a finished general-purpose agent runtime.
- ReAgent keeps a research-first workspace model and borrows Hermes-style runtime seams where they improve inspectability and long-running workflows.
- OpenClaw is a first-class host-facing inspection surface, but ReAgent still remains a research workspace first.
