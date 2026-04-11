# OpenClaw Realignment Worklog

Date: 2026-04-09
Status: Active

This log exists so the entire pass can be audited from the repo itself.

## Execution log

1. Audited the current repository layout, README, roadmap, OpenClaw bridge code, package metadata, and recent git history.
2. Confirmed the main drift signals:
   - the README demoted OpenClaw to a non-directional compatibility target
   - the bridge code still depends on a real OpenClaw host
   - the in-repo `package/` directory still contains a real OpenClaw plugin package
   - the worktree contains large uncommitted package deletions, so full rollback is unsafe in this pass
3. Chose a low-risk first phase:
   - add a first-class OpenClaw inspection surface to the root CLI
   - upgrade human-facing wording from "reference" toward "foundation" where appropriate
   - document the plan and the change record in-repo
4. Implemented root CLI changes in `src/cli.ts`:
   - added OpenClaw-derived host control to the root CLI
   - added OpenClaw sections to the home output
   - added foundation aliases in plugin marketplace/help output
5. Updated product docs:
   - revised the OpenClaw section in `README.md`
   - added realignment doc links to `README.md`
   - strengthened OpenClaw parity language in `ROADMAP.md`
6. Imported the sibling OpenClaw workspace into `upstream/openclaw/` using a repeatable sync script.
7. Adjusted the CLI surface after review:
   - `reagent status` now carries OpenClaw summary directly
   - `reagent status --all` now prints a dedicated OpenClaw section
8. Added OpenClaw-derived operational commands to the root CLI.
9. Added a migration map document to turn the imported OpenClaw tree into a staged migration plan instead of a loose snapshot.
10. Implemented proactive push for the OpenClaw bridge path instead of leaving it as an explicit runtime error.
11. Extended OpenClaw bridge send parity:
   - inbound replies in OpenClaw mode now use the bridge send path
   - explicit `accountId` and `threadId` push overrides are available from the ReAgent API/CLI surface
12. Extended OpenClaw bridge payload parity:
   - media push via `--media-url` is now supported on the OpenClaw bridge path
13. Extended the delegated host lifecycle path:
   - top-level install/uninstall/enable/disable/update now route through the delegated host lifecycle path
14. Extended multi-account/status visibility:
   - OpenClaw status now exposes account lists through the ReAgent status model
15. Extended the top-level operator flow:
   - `reagent login/wait/logout/send` now work from the root command surface
16. Completed the top-level lifecycle alias surface:
   - install / uninstall / enable / disable / update are all available from the root command surface
17. Began migrating the OpenClaw host session layer:
   - host-side `sessions.list` and `chat.history` are now callable through `OpenClawBridgeService`
18. Began migrating the OpenClaw realtime event layer:
   - the gateway client now supports persistent subscriptions
   - the bridge service now supports filtered session-event watching
19. Promoted the host session/event layer into the ReAgent command surface:
   - `reagent sessions/history` now expose live host session data from the main npm package
20. Promoted live host watch into the root CLI:
   - top-level `reagent watch` is now the public watch entrypoint for the OpenClaw host watch surface
21. Removed the `openclaw` prefix from the preferred public command surface:
   - top-level `reagent sessions/history/watch/login/logout/send/inspect/install/...` are now the intended operator path
22. Migrated OpenClaw host events into ReAgent-owned state:
   - host `session.message` events now sync into the ReAgent transcript
   - host session events now persist into a local event audit log
23. Extended host-session-derived delivery:
   - top-level `send --session-key` and the push surface can now deliver through resolved host sessions
24. Continued internalizing host session state:
   - ReAgent now persists a local OpenClaw session registry
   - top-level `sessions --cached` reads that registry
   - session-key delivery can fall back to the cached registry when the host shortcut is unavailable
25. Folded cached host sessions into the ordinary runtime surface:
   - `status` and `channels status` now surface cached host session registry metadata
26. Continued internal layer cleanup:
   - OpenClaw runtime state now lives behind a dedicated internal service
   - OpenClaw host/plugin catalog matching now lives behind a dedicated internal service
27. Continued propagating the host session model into ordinary product surfaces:
   - `channels sessions --host` now exposes the cached host session registry through the standard channel command surface
28. Continued propagating cached host state into ordinary history flows:
   - cached host session transcripts now participate in `history --cached`
29. Promoted cached host transcripts to the default history path when available:
   - `history --live` is now the explicit escape hatch for host fetches
30. Reduced the spread of direct upstream SDK imports in the in-repo foundation package:
   - `package/src/sdk/*` now provides local facades over the upstream OpenClaw plugin SDK modules
31. Formalized the in-repo SDK boundary:
   - `package/src/sdk/index.ts` now acts as the local barrel for the package SDK facade
32. Added a machine-readable compatibility contract:
   - `docs/openclaw-parity-matrix.json` now tracks parity status by surface area
33. Expanded first-class root CLI compatibility families:
   - `reagent system`
   - `reagent models`
   - `reagent mcp`
   - `reagent skills`
34. Added delegated root CLI coverage for additional upstream command families:
   - `reagent qr`
   - `reagent devices`
   - `reagent pairing`
   - `reagent acp`
   - `reagent dns`
   - `reagent exec-approvals`
   - `reagent hooks`
   - `reagent nodes`
   - `reagent sandbox`
   - `reagent secrets`
   - `reagent security`
   - `reagent tui`
   - `reagent webhooks`
35. Improved sender-based OpenClaw delivery semantics:
   - sender-based push can now reuse cached/live host session context
   - inbound OpenClaw replies can now reuse sender session context before falling back to direct send
36. Reworked inbound slash-command execution:
   - slash commands now use a shared command registry
   - command execution now flows through a dedicated handler map instead of one monolithic switch
37. Added tier-aware inbound command policy:
   - commands now carry risk tiers such as `safe`, `workspace-mutation`, `session-control`, and `maintenance`
   - source-aware policy now blocks local-only maintenance commands from remote channel entries
38. Added remote allowlist authorization for higher-risk inbound command tiers:
   - `workspace-mutation` and `session-control` can now be gated by sender allowlists
39. Exposed inbound command policy through managed config:
   - `workspace/channels/inbound-command-policy.json` is now a managed config surface
   - `reagent config ... commands ...` now works
40. Added a first-class operator-facing command inspection surface:
   - `reagent commands list`
   - `reagent commands policy`
   - `reagent commands authorize`
   - `reagent commands explain`
41. Continued modularizing inbound command execution:
   - `src/services/inboundCommandRegistry.ts` now hosts the shared slash-command registry
   - `src/services/inboundCommandHandlers.ts` now hosts extracted workspace/session/safe/maintenance handlers
42. Continued host-session canonicalization in ordinary app surfaces:
   - `ChannelService.listWeChatMessages()` in OpenClaw mode now merges cached host session transcripts into the standard message list
   - message-list consumers no longer depend only on the local transcript file when cached host session transcripts exist
43. Extended that canonicalization to the UI/chat message surface:
   - `ChannelService.listUiChatMessages()` in OpenClaw mode now also merges cached host session transcripts
   - the ordinary UI chat message endpoint no longer lags behind the transport message view in OpenClaw mode

## Files changed in this pass

- `src/cli.ts`
- `src/services/bundledPluginCatalogService.ts`
- `src/services/openClawBridgeService.ts`
- `src/services/openClawGatewayClient.ts`
- `src/cli.ts`
- `src/services/channelService.ts`
- `src/services/inboundCommandRegistry.ts`
- `src/services/inboundCommandHandlers.ts`
- `src/services/inboundCommandPolicyService.ts`
- `src/services/openClawRuntimeStateService.ts`
- `src/routes/channels.ts`
- `src/types/channels.ts`
- `README.md`
- `ROADMAP.md`
- `docs/openclaw-realignment.md`
- `docs/openclaw-realignment-worklog.md`
- `docs/openclaw-full-compatibility-plan.md`
- `docs/openclaw-parity-matrix.json`
- `docs/openclaw-upstream-import.md`
- `docs/openclaw-upstream-worklog.md`
- `docs/openclaw-migration-map.md`
- `scripts/import-openclaw-upstream.ps1`
- `tests/cli.test.mjs`
- `tests/openClawPush.test.mjs`
- `tests/openClawInboundReply.test.mjs`
- `tests/openClawAccounts.test.mjs`
- `tests/openClawSessions.test.mjs`
- `tests/openClawEvents.test.mjs`
- `tests/openClawCliSessionCommands.test.mjs`
- `upstream/openclaw/`

## Verification

Completed.

Commands run:

1. `npm.cmd run build`
2. `node --import tsx/esm tests/cli.test.mjs`
3. `node tests/openClawPush.test.mjs`
4. `node tests/openClawInboundReply.test.mjs`
5. `node tests/channelNaturalIntent.test.mjs`

Results:

- TypeScript build completed successfully.
- Prisma client generation completed successfully as part of the build.
- CLI regression suite passed, including the new OpenClaw-facing checks:
  - built help now advertises the top-level host-control commands
  - text-mode home output now includes an OpenClaw section
  - `reagent status --json` returns runtime + host + foundation package state
  - `plugins marketplace list foundation --json` resolves to the in-repo OpenClaw foundation package
- Additional targeted runtime suites passed:
  - sender-based OpenClaw push now reuses cached/live session context
  - inbound OpenClaw replies now reuse sender session context when available
  - inbound command routing, tier labels, source-aware policy, and allowlist authorization behave as expected
  - cached OpenClaw session transcripts now surface through the ordinary channel and UI chat message lists

Execution note:

- I initially launched build and CLI tests in parallel, which was incorrect because the CLI tests read `dist/cli.js`.
- After identifying the ordering issue, I re-ran the CLI tests after the fresh build completed.
- The final recorded verification result is the successful sequential run above.

## Known limits after this phase

- Several upstream CLI families are still passthrough delegation rather than native ReAgent-owned parity.
- OpenClaw bridge media support is currently strongest on push/send and sender-session reply paths, but the broader reply pipeline is still not a full upstream-semantic clone.
- ReAgent now has realtime host event subscription plus transcript/audit/session-registry sync, and more app surfaces consume it, but it is still not yet the canonical internal runtime session model everywhere in the app.
- Inbound command execution is now modular and policy-aware, but it still does not mirror the full upstream command registry/auth stack.
- ReAgent still depends on the upstream OpenClaw plugin SDK boundary and imported snapshot, but that dependency is now less scattered and more clearly mediated by internal facade layers.
- The standalone `@sinlair/reagent` package remains the current install surface even though OpenClaw is being elevated again in the product story.
