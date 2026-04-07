# ReAgent Todo

## Direction

Learn first from the open-source research-agent landscape, not mainly from autonomous experiment-runner systems.

Primary references:

- `assafelovic/gpt-researcher`
  - learn: end-to-end report flow, citation/evidence UX, research-product framing
- `bytedance/deer-flow`
  - learn: harness design, tool/memory/skill boundaries, long-running task orchestration, product expression
- `bytedance/pasa`
  - learn: scholarly retrieval quality, paper selection strategy, search-agent decision logic
- `SalesforceAIResearch/enterprise-deep-research`
  - learn: workspace-style research UI, knowledge-source integration, team-facing deliverables
- `jmiao24/Paper2Agent`
  - learn: turning paper outputs into reusable tools/agents/artifacts
- `InternScience/InternAgent`
  - learn: long-horizon scientific-workflow framing and system boundaries
- `AstroPilot-AI/Denario`
  - learn: modular role splitting for scientific research assistance

Secondary reference:

- `SakanaAI/AI-Scientist-v2`
  - learn later: ideation artifacts, novelty gates, branch search, experiment safety constraints

What ReAgent should borrow now:

- structured research briefs and direction memory
- stronger discovery quality and paper/repo linking
- evidence-backed reports with citation/provenance visibility
- durable artifacts, retrieval, and delivery surfaces
- long-running task visibility and entry-aware tool orchestration
- plugin/package parity for generated artifacts

What ReAgent should defer until later:

- large ideation systems
- strict novelty gating
- branch search across many hypotheses
- autonomous experiment execution

What ReAgent should keep:

- chat-first UX
- Node-first default path
- WeChat as the main delivery channel
- reusable research artifacts over one-shot answers
- safe, inspectable workflows over hidden autonomy

## Study Checklist For Open-Source Research Agents

When reviewing a reference project, capture these points:

- product surface
  - what the user sees first: chat, report, workspace, dashboard, or task board
- input model
  - prompt, query, structured brief, or project workspace
- retrieval loop
  - how it finds, filters, and ranks papers or evidence
- evidence model
  - citation, provenance, confidence, and claim labeling
- orchestration model
  - single agent, harness, multi-agent, long task, background job
- artifact model
  - what outputs remain durable and reusable after one run
- delivery model
  - report, summary, deck, notification, knowledge base, or plugin tool
- local control
  - how inspectable, extensible, and self-hostable it is

## Current ReAgent Baseline

Already implemented:

- [x] chat-first runtime
- [x] structured research direction profiles
- [x] discovery and scheduled discovery
- [x] link ingestion
- [x] paper analysis
- [x] repo analysis
- [x] module extraction
- [x] baseline suggestion
- [x] direction report generation
- [x] meeting deck generation
- [x] feedback recording
- [x] memory graph API and UI
- [x] package/plugin migration for the main research synthesis workflow

Current branch has already started the landscape-first shift:

- [x] richer research-brief fields in the root direction service
- [x] markdown export/import round-trip coverage for research briefs
- [x] entry-aware runtime toolset boundaries for UI / WeChat / OpenClaw style entry points
- [ ] finish validating the web brief editor end to end
- [ ] make package-level brief shapes and APIs match the root app more closely
- [ ] make discovery/report flows consume the richer brief fields more consistently

This means ReAgent already has a usable research-assistant core.
What it still needs is a stronger research-workspace layer shaped by the open-source research-agent landscape.

## Priority 0: Research Brief And Direction Memory

Goal:

- upgrade direction profiles into a real research brief that captures intent, constraints, baselines, and evaluation priorities

Tasks:

- [ ] keep `ResearchBrief` as a first-class artifact shape across root app and package code
- [ ] support fields:
  - label
  - summary
  - `tl;dr`
  - abstract
  - background
  - target problem
  - success criteria
  - blocked directions
  - known baselines
  - evaluation priorities
  - short-term validation targets
- [ ] support markdown import/export
- [ ] support JSON persistence
- [ ] let the web UI edit briefs directly
- [ ] let discovery, baseline suggestion, and direction reports consume richer brief fields

Why:

- better research agents start from structured intent, not only topic strings

## Priority 1: Discovery Quality And Ingestion

Goal:

- make ReAgent better at finding, normalizing, deduplicating, and ranking research candidates

Tasks:

- [ ] improve query generation from research briefs
- [ ] improve article -> paper -> repo normalization
- [ ] store clearer ranking reasons for discovered papers
- [ ] suppress repeated results more aggressively
- [ ] improve title-only fallback matching for paper and repo discovery
- [ ] persist richer source metadata for later reports
- [ ] expose more discovery rationale in API/UI responses

Why:

- `pasa`-style quality comes from retrieval discipline, not just having more tools

## Priority 2: Evidence-Backed Reports And Delivery

Goal:

- make outputs feel like research deliverables instead of generic assistant replies

Tasks:

- [ ] add clearer citation / provenance sections to paper and direction outputs
- [ ] show paper-supported vs code-supported vs inference labels
- [ ] add confidence notes to important conclusions
- [ ] improve report structure for paper, repo, and direction artifacts
- [ ] improve daily push / weekly summary formatting
- [ ] add stronger slide/source linking in meeting material

Why:

- `gpt-researcher` and enterprise research products are valuable because outputs are readable, reviewable, and reusable

## Priority 3: Artifact Workspace And Retrieval

Goal:

- make stored work easy to reopen, inspect, compare, and reuse

Tasks:

- [ ] add better brief list/detail surfaces
- [ ] add artifact lookup APIs for reports, decks, and module assets
- [ ] make memory search results easier to open directly in the UI
- [ ] improve graph entry points into briefs, reports, and reusable modules
- [ ] support export-friendly views for important artifacts
- [ ] keep artifact metadata aligned across root app and package/plugin layers

Why:

- a research workspace is only useful if prior work stays visible after the chat turn ends

## Priority 4: Research Round And Task State Visibility

Goal:

- store a durable research round with its brief, evidence, outputs, and task history

Tasks:

- [ ] add a `ResearchRound` artifact
- [ ] attach discovery runs, reports, and decisions to a round id
- [ ] persist richer task states and transitions
- [ ] expose transition history in API/UI
- [ ] show current task stage in the workspace and reports
- [ ] support retry/resume hooks with visible attempt history

Suggested states:

- `queued`
- `briefing`
- `planning`
- `searching-paper`
- `downloading-paper`
- `analyzing-paper`
- `checking-repo`
- `extracting-module`
- `generating-summary`
- `generating-ppt`
- `completed`
- `failed`

Why:

- research-agent products need durable work state, not only transient run outputs

## Priority 5: Package / Plugin Parity

Goal:

- keep the OpenClaw/plugin path close to the root workspace path for artifact inspection and reuse

Tasks:

- [ ] add package-level brief APIs or helpers where still missing
- [ ] add artifact list/get/download tools in `packages/reagent-openclaw`
- [ ] expose recent direction reports via plugin tools
- [ ] expose recent presentations via plugin tools
- [ ] expose module asset lookup via plugin tools
- [ ] add package-level tests for migrated workflows
- [ ] keep root and package artifact shapes aligned

Why:

- a real research workspace platform should not trap artifacts inside only one execution path

## Priority 6: Selective Multi-Agent And Entry-Aware Runtime

Goal:

- expand orchestration carefully, with explicit capability boundaries per entry surface

Tasks:

- [ ] keep toolsets explicit for direct UI, WeChat, and OpenClaw style entries
- [ ] expose active entry and enabled toolsets clearly in runtime/API/UI
- [ ] add focused sub-workflows only where they improve search, reading, or synthesis quality
- [ ] keep role boundaries inspectable instead of opaque
- [ ] avoid adding multi-agent complexity without durable handoff artifacts

Why:

- `deer-flow` is worth learning mainly for harness discipline, not for complexity by itself

## Priority 7: Paper-To-Agent / Reusable Output Layer

Goal:

- turn strong research outputs into reusable tools, presets, modules, or agent affordances

Tasks:

- [ ] add stronger metadata around extracted modules and reusable implementation ideas
- [ ] explore `direction report -> reusable preset` flows
- [ ] explore `paper report -> specialized tool / workflow template` flows
- [ ] persist the provenance between original evidence and the reusable output

Why:

- this is where `Paper2Agent` becomes strategically useful for ReAgent

## Priority 8: Idea Generation And Novelty Gate

Goal:

- add ideation only after briefs, discovery, evidence, and artifacts are strong enough

Tasks:

- [ ] add a `ResearchIdea` artifact
- [ ] store hypothesis, expected gain, assumptions, risks, dependencies, and recommendation
- [ ] link novelty checks to idea ids
- [ ] store novelty verdict and overlap evidence
- [ ] show novelty status in reports, graph nodes, and chat replies

Why:

- these are useful, but they should sit on top of a stronger research-workspace core

## Priority 9: Branch-Based Research Search

Goal:

- move from one linear route to multiple candidate branches with ranking and pruning

Tasks:

- [ ] add branch nodes for candidate routes
- [ ] support multiple drafts or candidate branches per brief
- [ ] score each branch on novelty, feasibility, evidence quality, and implementation readiness
- [ ] add merge / prune / retry decisions
- [ ] add branch comparison summaries

Why:

- this should happen after rounds, retrieval quality, and stored artifacts are already dependable

## Priority 10: Controlled Experiment Execution

Goal:

- support optional experiment execution only with strong sandboxing and operator control

Hard requirements:

- [ ] isolated workspace per run
- [ ] timeout
- [ ] CPU / memory / disk limits
- [ ] command allowlist
- [ ] network policy
- [ ] artifact capture
- [ ] structured stdout / stderr logs
- [ ] cleanup on failure
- [ ] resume / retry metadata

Important constraint:

- [ ] keep the default ReAgent path Node-first and non-executing
- [ ] make Python / CUDA / heavy experiment paths optional and isolated

Why:

- this is the riskiest lesson to borrow and should be the last major layer, not the first

## Suggested Build Order

### Milestone 1

- [ ] research brief and direction memory
- [ ] discovery quality and ingestion
- [ ] evidence-backed reports and delivery

### Milestone 2

- [ ] artifact workspace and retrieval
- [ ] package/plugin parity
- [ ] research round and task visibility

### Milestone 3

- [ ] selective multi-agent / entry-aware runtime expansion
- [ ] paper-to-agent / reusable output layer

### Milestone 4

- [ ] idea generation
- [ ] novelty gate
- [ ] branch-based search

### Milestone 5

- [ ] controlled experiment execution under sandbox

## Definition Of Done For The Landscape-First Plan

- [ ] ReAgent can create, edit, import, export, and reuse research briefs
- [ ] discovery quality visibly improves through better brief-driven retrieval and normalization
- [ ] major outputs show evidence, provenance, and confidence more clearly
- [ ] stored artifacts are easy to browse and reopen from UI, API, and plugin surfaces
- [ ] one research round can be inspected end to end with task history
- [ ] runtime capability boundaries are explicit per entry surface
- [ ] package/plugin users can inspect existing artifacts without regenerating them

## Anti-Goals

Do not do these by default:

- [ ] do not turn ReAgent into a generic chatbot product first
- [ ] do not optimize for autonomous experiment execution before the workspace loop is solid
- [ ] do not hide evidence and workflow state behind polished summaries only
- [ ] do not replace durable artifacts with transient chat-only outputs
- [ ] do not add multi-agent complexity without clear ownership and reusable outputs

## References Reviewed

- `https://github.com/assafelovic/gpt-researcher`
- `https://github.com/bytedance/deer-flow`
- `https://github.com/bytedance/pasa`
- `https://github.com/langchain-ai/local-deep-researcher`
- `https://github.com/jina-ai/node-DeepResearch`
- `https://github.com/SalesforceAIResearch/enterprise-deep-research`
- `https://github.com/jmiao24/Paper2Agent`
- `https://github.com/GAIR-NLP/OpenResearcher`
- `https://github.com/InternScience/InternAgent`
- `https://github.com/AstroPilot-AI/Denario`
- `https://github.com/SakanaAI/AI-Scientist-v2`
