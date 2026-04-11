# Release Process

This repo publishes one official npm package: `@sinlair/reagent`.

## Preflight

Run the targeted release checks first:

```powershell
npm.cmd run release:verify
npm.cmd run release:pack
```

## Publish

Publish the standalone package:

1. `npm.cmd run publish:root-package`

## Current Release Line

- `@sinlair/reagent`: `0.1.10`
