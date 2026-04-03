# Chat-First Research Agent Todo

## Product Direction

Build **one main conversational research agent** with **Node-only runtime requirements**.

The target user experience is:

- talk naturally in one chat
- send article links / paper links / GitHub links
- let the agent automatically route the work
- receive structured research results and WeChat pushes

The system should feel like a real research assistant, not a dashboard full of separate buttons.

## Hard Constraints

- Node-only runtime for normal usage
- `npm install && npm start` should remain the main deployment path
- avoid requiring Python or extra system tools for the core workflow
- keep WeChat as the main delivery channel

## Current Status

### Already Implemented

- [x] Main chat-first runtime with tool calling
- [x] Structured research direction profiles
- [x] Direction CRUD API
- [x] Discovery plan generation from direction profiles
- [x] Discovery service with ranking, digest generation, and WeChat push callback
- [x] Daily discovery scheduler with per-direction anti-duplicate execution
- [x] Link ingestion service
- [x] `@mozilla/readability` + `jsdom` article extraction path
- [x] GitHub link extraction from article content
- [x] Single paper deep analysis service
- [x] GitHub repo analysis service
- [x] Repo archive download and module asset extraction
- [x] Baseline / innovation suggestion service
- [x] Weekly presentation draft service
- [x] Pure Node `.pptx` generation
- [x] Unified research memory graph backend
- [x] Research graph API
- [x] Graph filtering by type / search / date
- [x] Graph detail API and raw artifact click-through
- [x] Upgraded graph UI with search, filter chips, stats cards, and node detail panel
- [x] Native WeChat always-on recovery improvements
- [x] Windows always-on install scripts
- [x] Full automated test suite passing

## Main Architecture

### User-facing

- one main chat agent
- one WeChat delivery channel
- one web console for inspection and operations

### Behind the scenes

- direction memory
- discovery
- scheduler
- external link ingestion
- paper analysis
- repo analysis
- module asset archive
- baseline synthesis
- presentation generation
- memory graph registry

## Implemented Capability Map

### 1. Direction Memory

- [x] store structured direction profile
- [x] generate discovery queries from direction profile

### 2. Discovery

- [x] run discovery from directions
- [x] rank papers
- [x] push digest to WeChat
- [x] schedule discovery daily
- [x] avoid duplicate same-day runs per direction

### 3. Link Ingestion

- [x] ingest external article URLs
- [x] extract main article text
- [x] extract outbound links
- [x] detect arXiv links
- [x] detect DOI links
- [x] detect GitHub links
- [x] collect image URLs from article

### 4. Paper Deep Dive

- [x] resolve paper from article/source item/title/URL
- [x] attempt PDF/abstract extraction
- [x] generate structured analysis report
- [x] produce recommendation and likely baselines

### 5. Repo Analysis

- [x] inspect GitHub repo metadata
- [x] identify top-level code paths
- [x] estimate likely official status

### 6. Module Archive

- [x] download repo archive
- [x] store selected module paths
- [x] persist module asset metadata

### 7. Baseline and Innovation Support

- [x] aggregate recent discovery and paper signals
- [x] produce baseline suggestions
- [x] produce reusable module hints
- [x] produce innovation suggestions

### 8. Presentation

- [x] generate markdown meeting deck
- [x] include article-derived image assets when available
- [x] export `.pptx` in pure Node

### 9. Memory Graph

- [x] unify direction / source / report / repo / module / presentation into graph nodes and edges
- [x] expose graph through API
- [x] add graph filtering by type / topic / date
- [x] add graph detail retrieval by node id
- [x] render graph search / filter / stats / detail page in frontend

## What Is Still Missing

These are the most important remaining gaps when comparing the current codebase against `agent.md`.

### Priority A: Better Chat Orchestration

The system can already call tools, but the orchestration can still be smarter.

Tasks:

- [ ] Improve intent routing prompts further
- [x] Add clearer action-oriented reply structure
- [x] Add "what I understood / what I did / what you should do next" response shape
- [x] Add stronger automatic chaining:
  - link_ingest -> paper_analyze
  - paper_analyze -> repo_analyze
  - repo_analyze -> module_extract
- [ ] Add route-specific reply patterns for discovery / paper dive / repo analysis / synthesis requests

### Priority B: Canonical Research Object Model And Deduplication

The current graph is useful, but `agent.md` expects a stronger canonical object layer.

Tasks:

- [x] Introduce canonical `paper` entities, not only `paper_report`
- [x] Introduce canonical `repo` entities, not only `repo_report`
- [ ] Introduce canonical `presentation_asset` entities, not only generated deck records
- [x] Link article-derived candidates to normalized paper / repo entities
- [x] Merge repeated references from discovery, article ingestion, repo analysis, and reports into one research record
- [x] Add stable canonical ids across related entities
- [x] Add explicit provenance edges between source article, paper, repo, report, and presentation assets
- [ ] Add a formal `Research Memory Registry` index file, not only derived aggregation
- [ ] Persist graph-ready nodes and edges incrementally
- [x] Add graph query helpers
- [x] Add memory graph filtering by type / topic / date
- [x] Add graph detail retrieval by node id

### Priority C: Evidence-Backed Reading And Paper Understanding

Current paper parsing and analysis work, but they do not yet satisfy the full evidence standard in `agent.md`.

Tasks:

- [x] Preserve links between report sections and original evidence more explicitly
- [x] Separate conclusions into paper-supported / code-supported / agent inference / speculation
- [x] Add confidence + missing-evidence fields to important conclusions
- [ ] Detect title / abstract / method / experiments more explicitly from parsed paper content
- [ ] Add training / inference pipeline extraction to deep paper reports
- [ ] Add figure / table extraction on the Node-only main path
- [ ] Remove Python-only PDF figure extraction from the normal product path

### Priority D: Better Repo Analysis And Reproducibility Signals

Repo inspection exists, but `agent.md` expects richer reproducibility-oriented judgment.

Tasks:

- [ ] Improve official/unofficial repo confidence logic
- [ ] Add repo activity assessment
- [ ] Add repo completeness assessment
- [ ] Add reproducibility risk scoring
- [ ] Add setup complexity summary
- [ ] Add paper-title -> likely repo search fallback when article text does not provide a direct GitHub URL

### Priority E: Richer Research Quality And Structured Outputs

Current paper and baseline analysis are useful but still partly heuristic.

Tasks:

- [ ] Improve innovation point extraction quality
- [ ] Improve baseline inference quality
- [ ] Add a reusable `Paper Brief` artifact shape
- [ ] Add richer `Deep Paper Report` fields for reproducibility analysis and confidence notes
- [ ] Add a reusable `Repo Report` artifact shape with implementation notes
- [ ] Add `Direction Report` generation
- [ ] Add baseline map / saturated pattern / improvement-route views

### Priority F: Feedback Loop And Personalization

`agent.md` expects the user to steer the agent over time, but that loop is not implemented yet.

Tasks:

- [ ] Add feedback capture from chat / WeChat
- [ ] Support: useful / not useful / more like this / less like this / too theoretical / too engineering-heavy
- [ ] Use feedback to refine ranking
- [ ] Use feedback to refine push frequency
- [ ] Use feedback to refine direction profile weights
- [ ] Track per-direction preference adjustments

### Priority G: Task State Machine And Operational Visibility

The workflows run, but they do not yet expose the explicit state machine described in `agent.md`.

Tasks:

- [ ] Add explicit workflow states:
  - queued
  - fetching
  - parsing
  - normalizing
  - searching-paper
  - downloading-paper
  - analyzing-paper
  - checking-repo
  - extracting-module
  - generating-summary
  - generating-ppt
  - completed
  - failed
- [ ] Persist task execution state and transitions
- [ ] Expose task states in API
- [ ] Expose task states in the web UI
- [ ] Add retry / resume hooks for scheduled and on-demand jobs

### Priority G.1: Unattended Operation And Always-On Reliability

OpenClaw is a useful reference here: daemonization alone is not enough. We also need health monitoring, reconnect gating, and persisted lifecycle state.

Tasks:

- [x] Add a unified provider lifecycle store for `running / disconnected / reconnecting / waiting-human-action / failed`
- [x] Persist provider lifecycle snapshots across restarts
- [x] Add a WeChat / channel health monitor
- [ ] Detect `not-running / disconnected / stale-socket / stuck` states explicitly
- [x] Add automatic provider restart with cooldown windows
- [x] Add restart budget limits to avoid restart storms
- [x] Add auth-aware reconnect gating
  - pause automatic reconnect on `pairing required`
  - pause automatic reconnect on missing / invalid token
  - pause automatic reconnect on password mismatch / hard auth failures
- [x] Distinguish auto-recoverable errors from manual-intervention-required errors
- [x] Surface `waiting for pairing / waiting for re-auth / cooldown active` in API and UI
- [x] Add a background health check loop for always-on providers
- [ ] Add provider restart / resume audit logs in workspace state

### Priority H: Better Frontend Graph Experience

The graph page is now useful, but it can still evolve toward a fuller research operations view.

Tasks:

- [x] Add node detail side panel
- [x] Add type filter chips
- [x] Add search box
- [x] Add graph stats cards
- [x] Add click-through from graph node to raw artifact/report
- [x] Improve SVG layout quality
- [ ] Add graph timeline mode
- [ ] Add provenance-focused edge highlighting
- [ ] Add saved graph views for a topic or direction

### Priority I: Better Presentation Quality

Current PPT works, but it is still first-pass quality.

Tasks:

- [ ] Improve slide layout
- [ ] Better title/subtitle style
- [ ] Better figure placement rules
- [ ] Add source citation footer per slide
- [ ] Add theme and design controls
- [ ] Add selected figure / model diagram / table extraction from PDFs on the main path

## Knowledge Graph Direction

The next memory step should explicitly move toward a real knowledge graph.

### Current implemented graph node set

- `direction`
- `discovery_run`
- `source_item`
- `workflow_report`
- `paper_report`
- `repo_report`
- `module_asset`
- `presentation`

### Target canonical entity set

- `direction`
- `source_item`
- `paper`
- `repo`
- `module_asset`
- `report`
- `presentation_asset`

### Next graph work

- [x] Add canonical paper / repo nodes separate from report nodes
- [x] Add stable canonical ids across related entities
- [x] Add explicit provenance edges
- [x] Add multi-source aggregation for the same paper
- [ ] Add graph export/import
- [ ] Add graph snapshots
- [ ] Add graph search endpoint

## Node-Only Technology Policy

Keep these as the main path:

- `@mozilla/readability`
- `jsdom`
- pure Node `.pptx` export
- pure Node repo archive handling

Do not make these required for the main product path:

- Python
- Poppler
- ImageMagick
- LibreOffice
- system-installed PDF conversion tools

Current gap to close:

- [ ] replace Python-based PDF image extraction fallback with a Node-only main-path solution

## Next Recommended Work

### Immediate next milestone

- Improve chat orchestration
- Upgrade memory registry from derived graph to first-class canonical registry
- Add evidence / confidence separation in deep paper reports
- Add workflow task state machine
- Add unattended provider lifecycle monitoring and reconnect gating
- Add feedback capture and ranking refinement

### Why this next

Because the core workflow is already there.

The biggest value jump now comes from:

1. making the chat feel more intelligent
2. making the research memory layer canonical and trustworthy
3. making paper conclusions more evidence-backed
4. making the always-on channel layer recover safely without human babysitting
5. making long-term ranking quality improve through user feedback
