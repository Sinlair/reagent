# OpenClaw Migration Map

Date: 2026-04-09
Status: Working map for staged migration

## Purpose

This document maps the imported OpenClaw upstream snapshot to the current ReAgent codebase so the remaining migration work can be executed in bounded slices.

## Imported upstream baseline

- snapshot path: `upstream/openclaw/`
- imported commit: `21403a3898f6ad8b042e5812caf7848bdf72199c`
- entry launcher: `upstream/openclaw/openclaw.mjs`
- main extension tree: `upstream/openclaw/extensions/`
- plugin SDK tree: `upstream/openclaw/src/plugin-sdk/`

## ReAgent current anchors

- root CLI: `src/cli.ts`
- runtime/service inspection: `src/gatewayService.ts`, `src/routes/health.ts`
- channel runtime bridge: `src/services/channelService.ts`
- OpenClaw host bridge: `src/services/openClawBridgeService.ts`, `src/services/openClawGatewayClient.ts`
- plugin catalog: `src/services/bundledPluginCatalogService.ts`
- in-repo foundation plugin: `package/`

## Module mapping

### 1. CLI / bootstrap

Upstream:

- `upstream/openclaw/openclaw.mjs`
- `upstream/openclaw/src/cli/`
- `upstream/openclaw/src/bootstrap/`
- `upstream/openclaw/src/daemon/`

Current ReAgent counterpart:

- `src/cli.ts`
- `src/gatewayService.ts`
- `scripts/`

Migration status:

- partial

Notes:

- ReAgent already absorbed a large amount of standalone CLI/service logic.
- The next migration target here is not the whole upstream CLI, but missing OpenClaw-oriented operational surfaces and compatibility behavior.

### 2. Plugin SDK / extension contract

Upstream:

- `upstream/openclaw/src/plugin-sdk/`
- `upstream/openclaw/packages/plugin-package-contract/`

Current ReAgent counterpart:

- `package/` depends on the real OpenClaw plugin SDK
- `src/services/bundledPluginCatalogService.ts`

Migration status:

- low direct absorption so far

Notes:

- ReAgent still consumes the upstream SDK from the plugin package boundary rather than re-hosting SDK semantics itself.
- This is a likely later migration area if ReAgent wants true OpenClaw-native extension parity inside the root app.

### 3. Channels / session surfaces

Upstream:

- `upstream/openclaw/src/channels/`
- `upstream/openclaw/src/sessions/`
- `upstream/openclaw/src/pairing/`

Current ReAgent counterpart:

- `src/services/channelService.ts`
- `src/providers/channels/`
- `package/src/`

Migration status:

- mixed

Notes:

- ReAgent has its own channel flow plus an OpenClaw bridge path.
- The `package/` plugin preserves real OpenClaw channel behavior, but the root runtime still lacks full parity, including proactive push on the OpenClaw bridge path.
- This pass closed one of the concrete gaps: proactive push now works through the OpenClaw bridge path in ReAgent.
- The bridge path now also delivers inbound command replies through the host send path instead of local transcript-only output.
- Push semantics now accept explicit `accountId` and `threadId` overrides, which moves the bridge closer to upstream send semantics.
- The push/send surface now supports `mediaUrl` on the OpenClaw bridge path, which is the first media-delivery slice migrated from upstream send semantics.
- Remaining channel-parity work is still larger than push alone: account routing depth, richer bridge diagnostics, and closer session semantics still need migration.

### 4. Routing / command / reply pipeline

Upstream:

- `upstream/openclaw/src/routing/`
- `upstream/openclaw/src/commands/`
- `upstream/openclaw/src/plugin-sdk/channel-reply-pipeline.ts`
- `upstream/openclaw/src/plugin-sdk/command-auth.ts`

Current ReAgent counterpart:

- `src/services/chatService.ts`
- `src/services/channelService.ts`
- `src/agents/runtime.ts`

Migration status:

- partial, divergent

Notes:

- ReAgent has already built its own research-oriented reply and agent routing model.
- Migration here should be selective: restore OpenClaw-strength surfaces without deleting ReAgent’s research workflow strengths.

### 5. Extension marketplace / inventory

Upstream:

- `upstream/openclaw/extensions/*`

Current ReAgent counterpart:

- `src/services/bundledPluginCatalogService.ts`
- `src/cli.ts`
- `upstream/openclaw/` imported snapshot

Migration status:

- active

Notes:

- This is the area currently moving fastest.
- ReAgent can now import upstream extensions, list them, inspect them, and expose them from the root CLI.

## Recommended next migration slices

1. OpenClaw plugin lifecycle parity in the root CLI.
   - Goal: make imported upstream plugins feel first-class in the top-level `reagent` command surface and `reagent plugins`.
   - Candidate tasks: richer inspect output, source/category grouping, upstream-host diffing.
   - Current note: lifecycle alias coverage now exists for install/uninstall/enable/disable/update.

2. OpenClaw bridge behavior parity.
   - Goal: close the functional gap in `src/services/channelService.ts`.
   - Candidate tasks: richer bridge diagnostics, tighter login/reconnect parity, and deeper runtime session modeling beyond current send/account/thread support.

3. Plugin-SDK-backed extension surface inside ReAgent.
   - Goal: reduce the conceptual gap between "ReAgent app" and "OpenClaw plugin host".
   - Candidate tasks: identify which upstream plugin-sdk contracts should be mirrored or adapted in ReAgent core.

## Current principle

Do not migrate OpenClaw by flattening it blindly into `src/`.

Use the imported upstream snapshot as the baseline, move one bounded surface at a time, and keep each move documented and test-backed.
