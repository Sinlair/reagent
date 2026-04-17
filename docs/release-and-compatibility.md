# Release And Compatibility Rules

## Release Entry Point

Current release preflight:

```powershell
npm.cmd run release:verify
npm.cmd run release:pack
```

Current publish entrypoint:

```powershell
npm.cmd run publish:root-package
```

## Stable Public Surfaces

These should be treated as public and stable unless explicitly called out otherwise:

- `@sinlair/reagent`
- root `reagent` command
- canonical `reagent agent ...` surface
- root `reagent research ...`, `reagent memory ...`, and `reagent runtime ...` families

## Compatibility Aliases

These are compatibility paths and may remain for migration support:

- `reagent channels agent ...`
- `reagent sessions`
- `reagent history`
- `reagent watch`
- `/api/channels/wechat/agent*`

## Breaking Change Rule

If a change affects:

- public install steps
- canonical CLI commands
- public HTTP routes
- documented workspace config contracts

then the change must also update:

- `README.md`
- at least one docs page
- `CHANGELOG.md`

## Documentation Rule

README should point users into docs entrypoints.
README should not be the only documentation surface for all audiences.
