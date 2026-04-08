# Operations

## Windows Always-On Install

Use the built-in Windows service scripts when you want ReAgent to come back after reboots and keep restarting after crashes.

If you are operating the published CLI instead of the repo scripts, prefer `reagent service ...` for lifecycle control and `reagent runtime ...` for inspection.

Published CLI equivalents:

- Start in the foreground: `reagent service run`
- Inspect runtime state: `reagent runtime status`
- Follow logs: `reagent runtime logs --follow`
- Install always-on supervision: `reagent service install`
- Restart the supervised runtime: `reagent service restart`

1. Copy `.env.example` to `.env`
2. Set production values in `.env`
3. Run `npm.cmd install`
4. Run `npm.cmd run db:push`
5. Run `npm.cmd run build`
6. Open an elevated PowerShell window
7. Run `npm.cmd run service:install`

Useful commands:

- Check prerequisites: `npm.cmd run service:preflight`
- Check task and runner status: `npm.cmd run service:status`
- Start now: `npm.cmd run service:start`
- Stop the background runner: `npm.cmd run service:stop`
- Remove the scheduled task: `npm.cmd run service:uninstall`
- Run the same wrapper in the foreground for debugging: `npm.cmd run service:runner`

Artifacts written by the runner:

- `workspace/service/windows-service.json`
- `workspace/service/runner-state.json`
- `workspace/service/reagent-service.out.log`
- `workspace/service/reagent-service.err.log`

Notes:

- The Windows task runs as `SYSTEM` so it can start at boot without an interactive login.
- The runner launches `dist/server.js` directly and restarts it after unexpected exits.
- ReAgent still reads `.env` from the repo root, so keep production secrets there.

## PM2 Alternative

Use PM2 when you want manual process management instead of the built-in Windows task scripts.

1. Copy `.env.example` to `.env`
2. Set production values in `.env`
3. Run `npm.cmd install`
4. Run `npm.cmd run build`
5. Run `npm.cmd run pm2:start`
6. Check status with `npx.cmd -y pm2@latest status reagent`
7. Check logs with `npm.cmd run pm2:logs`

## Notes

- The PM2 config binds to `127.0.0.1` by default.
- The native WeChat provider restores its polling loop on startup when saved login state still exists.
- Graceful shutdown now stops the native polling loop and any managed OpenClaw gateway child process.
- For true 24x7 operation, keep either the Windows task or PM2 enabled, not both at the same time.
