# ReAgent TODO

## Product Direction

ReAgent should keep the standalone always-on runtime and CLI as the official
install and control surface while recovering stronger OpenClaw parity and
foundation visibility.

That means:

- `reagent = main product surface`
- `root runtime / gateway / service = product backbone`
- `web console = companion inspection surface`
- `OpenClaw = architectural baseline, parity target, and foundation package surface`

OpenClaw should not displace `reagent` as the main control plane, but it also
should not be reduced to a dead reference or compatibility afterthought.

## Core Product Principles

- [ ] CLI-first and runtime-first, not web-first
- [ ] always-on operation over one-shot execution
- [ ] brief-first research, not prompt-first research
- [ ] evidence-backed outputs, not generic summaries
- [ ] file-backed memory, not chat-only memory
- [ ] artifact-oriented workflow, not transient replies
- [ ] visible task state, retry, and handoff over hidden background autonomy

## Architecture Direction

### Primary Layer

- [ ] `reagent` root app / CLI / runtime
  - service lifecycle
  - runtime health and logs
  - channels
  - research control surface
  - memory control surface

### De-emphasize

- [ ] treating OpenClaw as the product host
- [ ] making plugin packaging the main architecture story
- [ ] spending roadmap energy on a second host abstraction

## Priority 0: Packaging And Stability

- [ ] fix repo-wide `build/check` blockers
- [ ] keep the standalone CLI publishable
- [ ] clean critical UI/runtime encoding issues
- [x] remove duplicated report payloads from task metadata storage

## Priority 1: Make Root `reagent` The Real Product Surface

- [x] add a root `reagent home` entry point
- [x] add a root `reagent onboard` entry point
- [ ] make `reagent home` the obvious first command users run
- [ ] add stronger runtime overview messaging:
  - gateway state
  - channel state
  - memory state
  - research state
  - next steps
- [x] add a real first-run story to the standalone CLI
- [ ] make `reagent runtime home` / `reagent home` feel consistent with `service`, `runtime`, and `research`

## Priority 2: Strengthen The Always-On Runtime

- [ ] improve `reagent service` install/start/status/restart ergonomics
- [ ] tighten runtime diagnostics and doctor output
- [ ] make logs more usable for long-running sessions
- [ ] keep degraded mode understandable when the gateway is unreachable
- [ ] make background runtime ownership obvious from CLI output

## Priority 3: Research As The Main Capability Stack

- [ ] preserve brief-first research flow
- [ ] preserve dossier / round / handoff model
- [ ] improve active task visibility from root CLI
- [ ] improve report / retry / review flows from root CLI
- [ ] improve delivery artifacts from root CLI

## Priority 4: Memory And Durable Context

- [ ] make memory status and recall feel first-class from the root CLI
- [ ] improve memory onboarding from `reagent home`
- [ ] continue compaction and policy work
- [ ] keep artifact recall aligned with memory recall

## Priority 5: Web Console Repositioning

The web console should support the main runtime, not define it.

- [ ] present the web UI as a companion surface
- [ ] keep root CLI as the control plane
- [ ] use the web console for:
  - inspection
  - debugging
  - artifact browsing
  - graph / memory exploration

## Priority 6: OpenClaw Parity And Foundation Surface

- [ ] keep the standalone runtime aligned with the in-repo OpenClaw foundation package
- [ ] expose OpenClaw-derived host, session, and plugin state clearly from the root CLI
- [ ] only port capabilities that strengthen the main ReAgent product without creating a second control plane

## Immediate Build Order

### Phase 1

- [x] add `reagent home`
- [x] add `reagent onboard`
- [x] add CLI coverage for `reagent home`
- [x] add CLI coverage for `reagent onboard`
- [ ] tighten standalone onboarding around `home`, `service`, `runtime`, and `research`
- [ ] improve root README and docs to reflect the standalone install path plus OpenClaw foundation story

### Phase 2

- [ ] make `service` and `runtime` flows more product-grade
- [ ] improve root CLI summaries for research and memory
- [ ] keep round / dossier and report flows visible in the standalone surface

### Phase 3

- [ ] clean remaining UI/runtime encoding debt
- [ ] improve packaging and installation docs for standalone users

## Do Not Prioritize Now

- [ ] building another host model around OpenClaw
- [ ] plugin marketplace work
- [ ] multi-app shell abstractions
- [ ] complex multi-agent orchestration
## Definition Of Done

ReAgent is on the right path when:

- [ ] users can understand the product from `reagent home`
- [ ] the standalone runtime is clearly the main control surface
- [ ] `service`, `runtime`, `research`, and `memory` feel like one product
- [ ] OpenClaw parity and foundation surfaces are visible without displacing `reagent` as the main control surface
