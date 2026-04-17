# Public Install And Quickstart

This is the official public install path for ReAgent.

## Prerequisites

- Node.js `>= 22`
- A writable local working directory

## Install

```powershell
npm install -g @sinlair/reagent
```

The published package name is `@sinlair/reagent`.
The installed command is `reagent`.

## First-Run Path

1. Inspect local readiness.

```powershell
reagent onboard
```

2. Apply the safe starter profile when provider configuration is still missing.

```powershell
reagent onboard --apply
```

3. Review the main runtime and workspace overview.

```powershell
reagent home
```

4. Start the runtime in the foreground.

```powershell
reagent service run
```

5. Open the Web console.

Default URL:

```text
http://127.0.0.1:3000/
```

## Starter Profile

The starter profile uses:

```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

Use it for evaluation and walkthroughs.
Do not treat it as the final research-quality configuration.

## If Install Or Startup Fails

Use these in order:

```powershell
reagent onboard
reagent home
reagent runtime status
reagent doctor
```

If PowerShell blocks `npm`, use `npm.cmd`.
