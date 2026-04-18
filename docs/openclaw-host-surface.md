# OpenClaw Host Surface

This page is the public operator entrypoint for ReAgent's OpenClaw-facing host surface.

## When To Use It

Use the OpenClaw host surface when you want to:

- inspect imported upstream availability
- verify bridge configuration
- inspect cached host sessions
- inspect host history without going through the runtime-facing `agent` surface first

## Primary Commands

```powershell
reagent openclaw
reagent openclaw status
reagent openclaw sessions
reagent openclaw history <sessionKey>
reagent openclaw watch [sessionKey]
reagent openclaw plugins list
```

## Related Compatibility Commands

These remain available:

```powershell
reagent sessions
reagent history <sessionKey>
reagent watch <sessionKey>
reagent status --all
```

## What `reagent openclaw status` Shows

- active WeChat provider
- OpenClaw CLI path
- OpenClaw gateway URL
- configured channel id
- imported upstream state
- foundation package count
- imported upstream extension count
- cached host session count
- session registry update time
- imported commit hash when present

## How It Relates To The Agent Runtime

Use:

- `reagent openclaw ...` when you want host-facing bridge or inventory state
- `reagent agent ...` when you want canonical runtime sessions, runtime hooks, runtime history, or runtime delegations
