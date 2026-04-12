# OpenClaw Full Compatibility Plan

Date: 2026-04-09
Status: Active staged execution plan

## Goal

Make ReAgent fully compatible with the imported OpenClaw upstream baseline at:

- snapshot path: `upstream/openclaw/`
- imported commit: `21403a3898f6ad8b042e5812caf7848bdf72199c`

The imported baseline is a trimmed migration snapshot, not a runnable upstream checkout. Compatibility work should use the retained source surfaces as reference and should not assume the snapshot's removed automation layers still exist.

For this plan, "fully compatible" means:

- root CLI parity for operator-facing OpenClaw command families
- host/session/runtime parity for the bridge path
- reply/command pipeline parity where OpenClaw behavior is expected
- plugin SDK and extension contract parity sufficient for first-class OpenClaw plugin hosting
- parity validation backed by tests instead of documentation-only claims

## Source Of Truth

The source of truth for compatibility is the imported upstream snapshot, not memory
and not selectively preserved product wording.

Primary upstream anchors:

- `upstream/openclaw/openclaw.mjs`
- `upstream/openclaw/src/cli/`
- `upstream/openclaw/src/channels/`
- `upstream/openclaw/src/sessions/`
- `upstream/openclaw/src/routing/`
- `upstream/openclaw/src/commands/`
- `upstream/openclaw/src/plugin-sdk/`
- `upstream/openclaw/extensions/`

## Current Gap Summary

## Current Progress Snapshot

The following slices are now in place:

- a machine-readable parity matrix exists in `docs/openclaw-parity-matrix.json`
- the root CLI now exposes first-class OpenClaw-shaped families for:
  - `system`
  - `models`
  - `mcp`
  - `skills`
  - `commands`
- the root CLI also exposes passthrough coverage for additional upstream families:
  - `qr`
  - `devices`
  - `pairing`
  - `acp`
  - `dns`
  - `exec-approvals`
  - `hooks`
  - `nodes`
  - `sandbox`
  - `secrets`
  - `security`
  - `tui`
  - `webhooks`
- managed workspace config now includes a dedicated `commands` namespace for inbound command policy
- sender-based OpenClaw delivery can reuse cached/live host session context for:
  - proactive push
  - inbound reply dispatch
- inbound slash commands now flow through:
  - a shared command registry
  - tier metadata
  - source-aware policy
  - remote sender allowlist checks for higher-risk tiers
  - a dedicated handler map instead of only one monolithic switch

These changes materially reduced the gap, but they do not yet amount to full
OpenClaw parity.

### 1. CLI surface parity is incomplete

ReAgent now covers many more upstream command families, but a large part of that
coverage is still either:

- delegated passthrough to the OpenClaw host CLI, or
- ReAgent-shaped equivalents rather than native-semantic parity

What still remains here:

- replace more passthrough families with native parity where that matters
- tighten help, flags, JSON payloads, and error behavior against upstream
- decide which command families should stay delegated and which must become
  first-class native runtime surfaces

### 2. Host/session parity is partial

ReAgent now exposes `watch`, `sessions`, `history`, `login`, `logout`, and `send`,
but the host session model is still not the canonical runtime model everywhere in
the app.

Remaining gap areas:

- deeper session-state ownership inside the root runtime
- reconnect/login parity
- richer account routing and diagnostics
- broader parity beyond the current push/send-oriented bridge slices
- removing remaining places where sender-based behavior still falls back to
  ReAgent-local assumptions before host-native semantics

### 3. Reply pipeline parity is partial and divergent

ReAgent has its own research-oriented routing and agent runtime. That is valuable,
but it means OpenClaw command/reply semantics are not yet guaranteed end to end.

The compatibility target here is behavioral parity, not a blind code transplant.

What remains here now:

- stronger alignment with upstream command authorization semantics
- more explicit auditability around inbound command allow/deny outcomes
- reducing the amount of command formatting and reply shaping still embedded in
  `ChannelService`
- continuing to separate handler execution from orchestration and transport

### 4. Plugin SDK parity is far from complete

The in-repo foundation package currently uses a small local facade under
`package/src/sdk/`, while upstream `src/plugin-sdk/` contains a much broader host
contract surface.

Full compatibility requires:

- identifying which upstream SDK contracts must be mirrored locally
- minimizing drift between foundation package behavior and root-app behavior
- proving plugin behavior against compatibility tests

### 5. Extension-host parity is not complete

ReAgent can already inspect imported upstream extensions and expose some lifecycle
operations, but full compatibility requires first-class host behavior for the wider
OpenClaw extension ecosystem.

## Execution Order

### Phase 0. Lock The Compatibility Contract

Deliverables:

- keep `21403a3898f6ad8b042e5812caf7848bdf72199c` as the current compatibility baseline
- build and maintain a parity matrix by surface area
- mark each parity claim as `none`, `partial`, or `complete`

Exit criteria:

- every major upstream surface is mapped to a ReAgent counterpart or explicitly
  marked missing

### Phase 1. CLI Family Parity

Goal:

- make the root `reagent` CLI fully cover the operator-visible OpenClaw command
  families that matter for host parity

Work:

- inventory upstream command families from `upstream/openclaw/src/cli/`
- decide which should be top-level vs nested under existing ReAgent commands
- implement missing command families or exact aliases where appropriate
- match important flags, help text, JSON output shape, and error behavior

Validation:

- add compatibility tests for each migrated command family
- add snapshot-style help coverage for the root CLI

### Phase 2. Host / Session / Bridge Parity

Goal:

- make OpenClaw host state first-class and canonical inside ReAgent runtime flows

Work:

- unify cached and live host session handling
- tighten login/reconnect/account routing semantics
- expand bridge diagnostics and failure reporting
- extend media/reply behavior beyond the current push/send slice

Validation:

- session list/history/watch/send/login/logout tests
- degraded-mode tests
- multi-account tests

### Phase 3. Reply Pipeline And Command Parity

Goal:

- make OpenClaw-style command authorization, inbound handling, and reply dispatch
  consistent where the root runtime claims compatibility

Work:

- compare `src/services/chatService.ts`, `src/services/channelService.ts`, and
  `src/agents/runtime.ts` against upstream routing/command/reply modules
- restore missing semantics selectively
- keep research-specific workflow strength without breaking OpenClaw expectations

Validation:

- parity tests for command auth, inbound dispatch, reply dispatch, and session-key
  delivery behavior

### Phase 4. Plugin SDK And Foundation Package Parity

Goal:

- make the root app and the in-repo foundation package align with the upstream
  OpenClaw plugin contract closely enough for true extension-host compatibility

Work:

- expand `package/src/sdk/` beyond the current small facade set
- identify contracts that must move into shared ReAgent-owned layers
- reduce implicit dependence on upstream-only semantics hidden behind package code

Validation:

- foundation-package tests
- plugin lifecycle tests
- contract-level tests for SDK-backed behaviors

### Phase 5. Extension Ecosystem Parity

Goal:

- make imported upstream extensions feel first-class inside ReAgent instead of
  merely inspectable

Work:

- richer inventory and diffing
- extension capability/category grouping
- host/runtime visibility for imported extensions
- installation/update/enable/disable parity checks against upstream behavior

Validation:

- marketplace/inventory/lifecycle tests
- upstream-extension smoke tests

## Acceptance Bar

ReAgent should not claim full OpenClaw compatibility until all of the following are
true:

- every targeted upstream CLI family has a parity status of `complete`
- host session and bridge behavior are canonical across root runtime surfaces
- reply and command semantics match documented OpenClaw expectations
- the in-repo foundation package and root runtime share a verified compatibility
  contract
- compatibility tests pass against the imported upstream baseline

## Immediate Remaining Work

The highest-value remaining slices are now:

1. Make more host/runtime state canonical inside the root app instead of relying
   on partial bridge translation layers.
2. Continue aligning command authorization and reply semantics with upstream
   behavior, especially around remote access policy and command execution shape.
3. Expand plugin SDK and foundation-package parity so the root runtime and the
   in-repo package stop diverging conceptually.
4. Decide which passthrough CLI families should stay delegated and which need
   true native parity inside ReAgent.

## First Slice To Start Now

The best first implementation slice is:

1. create a machine-readable parity matrix
2. close CLI family gaps in the root `reagent` surface
3. add contract tests before deeper runtime refactors

Reason:

- it gives immediate visibility into what "full compatibility" means
- it avoids making runtime changes without a contract
- it creates a stable harness for later host/session/plugin work
