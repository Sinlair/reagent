# Contributing

Thanks for contributing to ReAgent.

## Before You Start

- Read [README.md](./README.md)
- Read [agent.md](./agent.md)
- Read [OPERATIONS.md](./OPERATIONS.md) if your change affects deployment or background execution

## Development Setup

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:push
```

Optional:

- Run `npm.cmd --prefix package install` if you also need the in-repo OpenClaw WeChat reference package.

## Recommended Workflow

1. Create a branch for your change.
2. Keep the scope focused.
3. Add or update tests when behavior changes.
4. Run checks before opening a pull request.

## Required Checks

```powershell
npm.cmd run check:all
npm.cmd run test
```

If your change only touches the standalone publishable package:

```powershell
npm.cmd run release:verify
npm.cmd run release:pack
```

## Pull Request Guidelines

- Explain what changed and why.
- Call out behavior changes and migration impact.
- Mention any gaps, tradeoffs, or follow-up work.
- Avoid mixing unrelated refactors into one pull request.

## Code Style

- Follow existing project structure and naming.
- Prefer small, explicit changes over broad rewrites.
- Keep workspace behavior and research workflow changes test-covered.
- Do not remove user data, workspace state, or unrelated local changes.

## Documentation

If your change affects user-visible behavior, update at least one of:

- [README.md](./README.md)
- [README.zh-CN.md](./README.zh-CN.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [agent.md](./agent.md)
