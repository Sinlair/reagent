# Plugin And Bridge Example

This example documents the current public-facing bridge and plugin inspection entrypoints.

## OpenClaw Host And Bridge Entry Surface

Relevant commands:

```powershell
reagent agent host sessions
reagent sessions
reagent history <sessionKey>
reagent plugins list
reagent status --all
```

## What This Example Demonstrates

- canonical runtime host inspection
- compatibility host inspection aliases
- plugin inventory inspection through the ReAgent CLI
- bridge-facing OpenClaw status surfaced as product-facing output

## Validation Steps

1. List plugins:

```powershell
reagent plugins list
```

2. Inspect host sessions:

```powershell
reagent agent host sessions
```

3. Inspect the current OpenClaw-facing status summary:

```powershell
reagent status --all
```

## Stability Notes

Treat these as stable public entrypoints:

- `reagent plugins list`
- `reagent agent host sessions`
- `reagent sessions`
- `reagent history <sessionKey>`

Do not treat internal cache file names or private runtime storage as stable extension contracts unless they are explicitly documented elsewhere.
