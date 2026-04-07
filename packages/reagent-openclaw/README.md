# @sinlair/reagent-openclaw

OpenClaw plugin package for ReAgent research workflows.

Current first-phase capabilities:

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
- `/reagent-presentation-generate [topic]`

## Tools

The plugin also registers these host-side tools:

- `reagent_direction_list`
- `reagent_discovery_run`
- `reagent_baseline_suggest`
- `reagent_feedback_record`
- `reagent_link_ingest`
- `reagent_paper_analyze`
- `reagent_repo_analyze`
- `reagent_module_extract`
- `reagent_novelty_check`
- `reagent_direction_report_generate`
- `reagent_presentation_generate`
