# ReAgent Docs

ReAgent is a local-first research workspace with Hermes-style runtime seams.

Use this page as the primary docs entrypoint instead of treating `README.md` as the only source of truth.

## User Docs

- [Public Install And Quickstart](./public-install.md)
- [Core Product Flows](./core-flows.md)
- [Public Walkthroughs](./walkthroughs.md)
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
- `workspace control`: LLM routes, MCP, skills, and inbound command policy

## Notes

- ReAgent is not a finished general-purpose agent runtime.
- ReAgent keeps a research-first workspace model and borrows Hermes-style runtime seams where they improve inspectability and long-running workflows.
