# Core Product Flows

This page documents the intended public product flows for ReAgent.

## 1. First Run

```powershell
reagent onboard
reagent onboard --apply
reagent home
reagent service run
```

Goal:

- get the runtime reachable
- confirm the starter profile
- open the Web console

## 2. Research Flow

```powershell
reagent research directions
reagent research enqueue "topic" --question "..."
reagent research tasks
reagent research report <taskId>
reagent research handoff <taskId>
reagent research workstream <taskId> search
```

Goal:

- create or inspect a brief
- launch a task
- review the report
- reopen saved workstreams and artifacts

## 3. Memory Flow

```powershell
reagent memory recall "recent research choices"
reagent memory remember "..." --title "..."
reagent memory status
```

Goal:

- keep research judgments durable
- reopen file-backed memory instead of relying only on chat context

## 4. Agent Runtime Flow

```powershell
reagent agent runtime
reagent agent sessions
reagent agent session <sessionId>
reagent agent hooks <sessionId>
reagent agent delegates
```

Goal:

- inspect canonical sessions
- review runtime history and hooks
- understand host linkage and delegation state

## 5. OpenClaw Bridge Flow

```powershell
reagent openclaw status
reagent openclaw sessions
reagent openclaw history <sessionKey>
reagent openclaw watch <sessionKey>
reagent channels status
reagent sessions
reagent history <sessionKey>
reagent watch <sessionKey>
reagent status --all
```

Goal:

- inspect the OpenClaw-backed host surface
- correlate host sessions with runtime sessions

Docs:

- [OpenClaw Host Surface](./openclaw-host-surface.md)

## 6. Upgrade And Repair Flow

```powershell
reagent runtime status
reagent runtime logs --follow
reagent doctor
reagent doctor --fix --skip-db
```

Goal:

- confirm runtime health after upgrade
- inspect logs and diagnostics before deeper manual repair

## 7. Recovery Flow

Current recovery surfaces:

- `reagent onboard`
- `reagent home`
- `reagent runtime status`
- `reagent runtime logs --follow`
- `reagent doctor`
- `reagent workspace snapshot`
- `reagent workspace restore preview <snapshotPath>`
- `reagent workspace restore apply <snapshotPath> --yes`
- `reagent workspace support-bundle`

Typical path:

```powershell
reagent workspace snapshot
reagent workspace restore preview <snapshotPath>
reagent workspace support-bundle
```

Use `restore apply` only when you want to replace the active workspace explicitly.
