# OpenClaw Realignment

Date: 2026-04-09
Status: Phase 1 delivered in first pass
Owner: Codex working pass for review

## Why this document exists

This repository drifted away from its original OpenClaw starting point in three visible ways:

1. Product language started describing ReAgent as a standalone-only runtime and treated OpenClaw mostly as a compatibility afterthought.
2. The root CLI had OpenClaw-inspired compatibility aliases, but no coherent top-level host control surface for inspecting the host, the bridge, and the in-repo foundation package together.
3. The in-repo package under `package/` still contains a real OpenClaw Weixin plugin, while the surrounding docs and CLI copy downgraded it to "reference" language.

## Evidence captured before changes

- `README.md` explicitly said "OpenClaw is not the main product direction."
- `src/services/channelService.ts` still reports `Proactive push is not implemented for the OpenClaw bridge yet.`
- `src/services/openClawBridgeService.ts` already depends on the external OpenClaw host CLI and gateway.
- `package/` still contains the real `@tencent-weixin/openclaw-weixin` plugin package and OpenClaw extension entrypoint.
- The current worktree also contains large uncommitted deletions under `packages/reagent-core` and `packages/reagent-openclaw`, so a full structural rollback would be risky inside this pass.

## Phase 1 goals

- Re-establish OpenClaw as a first-class operator-facing surface in the root CLI.
- Replace weak "reference-only" language with "foundation" language where it improves clarity for human operators.
- Keep the current standalone runtime intact while making the OpenClaw lineage visible and inspectable again.
- Record every review-relevant step in repo docs instead of relying on chat history.

## Phase 1 non-goals

- Fully restoring the deleted `packages/reagent-core` or `packages/reagent-openclaw` trees.
- Reverting unrelated user changes in the working tree.
- Claiming full OpenClaw parity where the runtime still lacks it.

## Decisions for this pass

1. Keep `@sinlair/reagent` as the current installable root package.
2. Consolidate OpenClaw-derived host control into top-level `reagent` commands instead of forcing operators through `plugins` and compatibility aliases alone.
3. Treat the in-repo `package/` plugin as an OpenClaw foundation package in human-facing docs and help output.
4. Document the realignment as a staged recovery instead of pretending the architecture is already back at full parity.

## Planned deliverables in this phase

- Review docs:
  - `docs/openclaw-realignment.md`
  - `docs/openclaw-realignment-worklog.md`
- Root CLI changes:
  - top-level `reagent` host-control commands
  - top-level watch/session/history/send/install flows
- Human-facing wording changes:
  - README OpenClaw section
  - plugin marketplace/help copy
  - roadmap wording around parity

## Review checkpoints

- Does the root CLI now make OpenClaw status visible without forcing the user to mentally join several commands?
- Are we describing the in-repo package honestly as a foundation package rather than a dead reference?
- Did we avoid destructive structural rollback while the worktree still contains major in-flight deletions?
- Are verification results written down in `docs/openclaw-realignment-worklog.md`?

## Verification status

Targeted CLI verification for this phase passed. See `docs/openclaw-realignment-worklog.md` for the exact commands and recorded results.
