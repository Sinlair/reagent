# @sinlair/reagent-openclaw

OpenClaw plugin package for ReAgent research workflows.

Current first-phase capabilities:

- conversation-scoped and workspace-scoped memory
- manage research directions
- run paper discovery
- record feedback
- suggest baselines
- ingest article links
- analyze papers
- analyze repositories
- extract reusable modules
- run novelty checks
- generate direction reports
- generate meeting decks
- inspect recent discovery runs
- query plugin status

## Install

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

## Commands

- `/reagent-status`
- `/reagent-memory <query>`
- `/reagent-memory-workspace <query>`
- `/reagent-remember <note>`
- `/reagent-remember-workspace <note>`
- `/reagent-directions`
- `/reagent-direction-add <label>`
- `/reagent-direction-remove <directionId>`
- `/reagent-discover [directionId]`
- `/reagent-runs`
- `/reagent-feedback <signal> [notes]`
- `/reagent-baseline-suggest <directionId-or-topic>`
- `/reagent-link-ingest <url-or-text>`
- `/reagent-paper-analyze <title|url|sourceItemId>`
- `/reagent-repo-analyze <github-url> [context-title]`
- `/reagent-module-extract <github-url> [context-title]`
- `/reagent-novelty-check <idea-or-topic>`
- `/reagent-direction-report <directionId-or-topic>`
- `/reagent-direction-reports [limit]`
- `/reagent-direction-report-get <reportId>`
- `/reagent-presentation-generate [topic]`
- `/reagent-presentations [limit]`
- `/reagent-presentation-get <presentationId>`
- `/reagent-module-assets [limit]`
- `/reagent-module-asset-get <assetId>`

## Tools

The plugin also registers these host-side tools:

- `reagent_direction_list`
- `reagent_memory_status`
- `reagent_memory_files`
- `reagent_memory_get`
- `reagent_memory_search`
- `reagent_memory_remember`
- `reagent_discovery_run`
- `reagent_baseline_suggest`
- `reagent_feedback_record`
- `reagent_link_ingest`
- `reagent_paper_analyze`
- `reagent_repo_analyze`
- `reagent_module_extract`
- `reagent_module_asset_recent`
- `reagent_module_asset_get`
- `reagent_novelty_check`
- `reagent_direction_report_generate`
- `reagent_direction_report_recent`
- `reagent_direction_report_get`
- `reagent_presentation_generate`
- `reagent_presentation_recent`
- `reagent_presentation_get`

## Memory Scopes

The plugin exposes two durable memory scopes:

- `workspace`: shared research memory for the whole plugin workspace
- `conversation`: isolated memory keyed by one OpenClaw sender / peer

The slash commands default to conversation-scoped memory, which lines up with
OpenClaw's per-peer context isolation. Tool calls can choose either scope by
passing `scope: "workspace"` or `scope: "conversation"`. When using
conversation-scoped tools, pass a stable `scopeKey` such as a sender id.
