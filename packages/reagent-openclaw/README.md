# @sinlair/reagent-openclaw

OpenClaw plugin package for ReAgent research workflows.

Current first-phase capabilities:

- manage research directions
- run paper discovery
- record feedback
- ingest article links
- analyze papers
- analyze repositories
- run novelty checks
- inspect recent discovery runs
- query plugin status

## Install

```bash
openclaw plugins install @sinlair/reagent-openclaw --yes
```

## Commands

- `/reagent-status`
- `/reagent-directions`
- `/reagent-direction-add <label>`
- `/reagent-direction-remove <directionId>`
- `/reagent-discover [directionId]`
- `/reagent-runs`
- `/reagent-feedback <signal> [notes]`
- `/reagent-link-ingest <url-or-text>`
- `/reagent-paper-analyze <title|url|sourceItemId>`
- `/reagent-repo-analyze <github-url> [context-title]`
- `/reagent-novelty-check <idea-or-topic>`
