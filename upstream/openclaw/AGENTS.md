# OpenClaw Note

This directory keeps imported OpenClaw sources inside ReAgent.

Do not treat `upstream/openclaw/` as a runnable OpenClaw checkout. ReAgent intentionally removed:

- top-level `scripts/`
- top-level CI/workflow metadata under `.github/`
- top-level Docker and Vitest automation entrypoints
- Android Kotlin sources under `apps/android/`

Use this tree as migration/reference material only.
