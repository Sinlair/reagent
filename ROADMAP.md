# Roadmap

## Direction

ReAgent should learn first from the open-source research-agent landscape and evolve into a research workspace / research operating system.

That means the project should prioritize:

- structured research briefs over vague prompts
- stronger discovery quality over shallow search volume
- evidence, citation, provenance, and confidence over generic summaries
- durable artifacts and delivery surfaces over chat-only answers
- long-running task visibility, memory, and tool orchestration over hidden autonomy
- plugin/package parity and local inspectability over one-off demos
- OpenClaw parity recovery over drifting into a standalone-only narrative

It should explicitly defer these until the core workspace loop is stronger:

- heavy ideation systems
- strict novelty gates
- branch search across many hypotheses
- autonomous experiment execution

## Reference Lens

Primary reference projects:

- `assafelovic/gpt-researcher`
  - borrow: report structure, citation/evidence presentation, end-to-end research framing
- `bytedance/deer-flow`
  - borrow: harness design, tool/memory/skill boundaries, long-task orchestration, product expression
- `bytedance/pasa`
  - borrow: paper retrieval quality, scholarly search strategy, paper selection logic
- `SalesforceAIResearch/enterprise-deep-research`
  - borrow: workspace-style UI, knowledge-source integration, team-facing research surfaces
- `jmiao24/Paper2Agent`
  - borrow: turning paper understanding into reusable agents/tools/artifacts
- `InternScience/InternAgent`
  - borrow: long-horizon research workflow framing and scientific-system boundaries

Secondary reference:

- `SakanaAI/AI-Scientist-v2`
  - borrow later: ideation, novelty validation, branch search, experiment safety constraints

## Near Term

### 1. Research Brief And Direction Memory

Goal:

- upgrade direction profiles into a real research brief that captures user intent, constraints, and evaluation preferences

What to add:

- `tl;dr`
- abstract
- background
- target problem
- success criteria
- blocked directions
- known baselines
- evaluation priorities
- short-term validation targets
- markdown import/export

Why:

- this is the strongest common lesson across research-agent products: retrieval quality depends on structured intent, not only topic labels

### 2. Discovery Quality And Source Normalization

Goal:

- improve how ReAgent finds, merges, and ranks papers from multiple research sources

What to add:

- better query generation from briefs
- stronger source normalization for article -> paper -> repo linking
- clearer ranking reasons
- repeated-result suppression
- richer source metadata for later reports

Why:

- `pasa` and research-report products are only useful because retrieval and candidate selection are treated as first-class work

### 3. Evidence-Backed Reports And Delivery

Goal:

- make paper, repo, and direction outputs feel like reliable research deliverables instead of generic assistant text

What to add:

- clearer evidence/source attribution
- confidence notes
- paper-supported vs code-supported vs inference labels
- better report layouts for paper and direction outputs
- stronger daily/weekly delivery formatting

Why:

- `gpt-researcher` and enterprise-style research tools win on readable deliverables, not only on internal orchestration

### 4. Artifact Workspace And Retrieval

Goal:

- make durable artifacts easy to browse, reopen, reuse, and export from the workspace

What to add:

- brief list/detail surfaces
- recent artifact lookup
- report/presentation retrieval
- better memory file linking
- clearer graph entry points into stored outputs

Why:

- research-workspace products create value when prior work remains visible and reusable

### 5. Plugin And Package Parity

Goal:

- keep the OpenClaw/plugin path close to the root workspace path for inspection and reuse

What to add:

- artifact list/get tools
- recent report lookup
- module asset lookup
- package-level tests for migrated workflows
- a first-class OpenClaw status surface in the root CLI
- foundation-package visibility instead of reference-only language in the operator-facing UX

Why:

- if ReAgent is a real workspace platform, generated artifacts must be accessible from both the root app and plugin surfaces

## Mid Term

### 6. Research Round And Task Visibility

Goal:

- store one durable research round with its brief, discovery evidence, reports, and decisions

What to add:

- `ResearchRound`
- richer task states
- transition history
- summary views across one round

Why:

- open-source research agents still need stronger state visibility than a single "running/completed" toggle

### 7. Toolset Boundaries And Entry-Aware Runtime

Goal:

- make different entry surfaces use different toolsets and capabilities safely

What to add:

- entry-aware tool policies
- UI/direct/WeChat/OpenClaw capability boundaries
- better runtime visibility for enabled toolsets

Why:

- this follows the deer-flow style lesson that agent capability should be explicit, inspectable, and context-aware

### 8. Selective Multi-Agent Expansion

Goal:

- add subagent or multi-role coordination only where it improves research throughput

What to add:

- scoped sub-workflows for search, reading, and synthesis
- explicit role boundaries
- result handoff artifacts

Why:

- multi-agent is useful when it supports long-running research work, not when it becomes architecture theater

### 9. Paper-To-Agent / Reusable Output Layer

Goal:

- turn strong paper or direction outputs into reusable tools, modules, or specialized agent presets

What to add:

- reusable module packaging
- report -> tool or preset candidates
- artifact metadata for downstream reuse

Why:

- this is where `Paper2Agent` becomes strategically useful for ReAgent differentiation

## Long Term

### 10. Idea Generation And Novelty Gate

Goal:

- add structured ideation and novelty judgment after the workspace loop is already strong

Why:

- these matter, but they should sit on top of better briefs, discovery, evidence, and stored artifacts

### 11. Branch-Based Research Search

Goal:

- compare multiple candidate routes instead of assuming one linear path

Why:

- this is valuable after rounds, artifacts, and retrieval quality are stable

### 12. Controlled Experiment Execution

Goal:

- support optional experiment execution only with strong sandboxing and explicit operator control

Hard requirements:

- sandbox
- timeout
- resource limits
- isolated logs
- safe cleanup

Why:

- experiment execution is not the first thing to copy from autonomous science systems; it is the riskiest thing to add

## Package Split

### Root App

The root app should continue to host:

- full web console
- workspace-centric control flows
- graph and memory views
- delivery surfaces
- operational deployment modes

### Single-Package Direction

The standalone `@sinlair/reagent` package should remain the only official
installation target.

Reusable logic should live inside the root runtime codebase unless there is a
very strong reason to split it later.

## Suggested Execution Order

1. Research brief and direction memory
2. Discovery quality and source normalization
3. Evidence-backed reports and delivery
4. Artifact workspace and retrieval
5. Plugin/package artifact parity
6. Research round and task visibility
7. Selective multi-agent expansion
8. Idea generation and novelty gate
9. Branch-based search
10. Controlled experiment execution under sandbox
