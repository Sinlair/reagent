# OpenClaw Upstream Import

Date: 2026-04-09
Status: Initial upstream import delivered

## Goal

Bring the sibling `openclaw` workspace into the ReAgent repository as a reviewable upstream snapshot so migration work can happen against a concrete baseline instead of memory or partial copies.

## Import strategy

The import is intentionally done as an in-repo upstream snapshot:

- source repo: `E:\Internship\program\openclaw`
- destination snapshot: `upstream/openclaw/`
- source control metadata such as `.git/` is excluded
- local/editor folders such as `.agents/`, `.vscode/`, `.pi/`, and `node_modules/` are excluded
- Apple-platform Swift subtrees are excluded from the imported snapshot:
  - `apps/ios/`
  - `apps/macos/`
  - `apps/shared/OpenClawKit/`
  - `Swabble/`
- imported snapshot metadata is written to `upstream/openclaw/.reagent-import.json`

The snapshot has since been further trimmed for migration use. In this repository it should be treated as reference material, not a runnable upstream checkout.

- removed later for trim-down: top-level `scripts/`
- removed later for trim-down: top-level CI/workflow metadata under `.github/`
- removed later for trim-down: top-level Docker/Vitest automation entrypoints
- removed later for trim-down: Android Kotlin sources under `apps/android/`

## Why this approach

1. It preserves a concrete upstream baseline inside the same repository you are reviewing.
2. It keeps the TypeScript/runtime migration surface reviewable without carrying the upstream Apple-platform Swift app trees in this repository.
3. It avoids mixing imported upstream code directly into `src/` before we finish mapping responsibilities.
4. It allows repeatable refreshes by rerunning one scripted sync step.

## Expected next uses of the snapshot

- compare OpenClaw entrypoints against ReAgent entrypoints
- inspect upstream plugin and extension layouts from the root CLI
- migrate channel/runtime/plugin functionality into ReAgent in bounded slices
- keep a visible audit trail of what was copied and from which commit

## Imported snapshot for this pass

- imported commit: `21403a3898f6ad8b042e5812caf7848bdf72199c`
- imported tracked-file count: `11197`
- imported extension count: `88`
- snapshot metadata file: `upstream/openclaw/.reagent-import.json`

## Operator-facing outcome

After this pass:

- `reagent status` includes OpenClaw snapshot summary directly
- `reagent status --all` prints a dedicated OpenClaw section
- top-level commands such as `reagent sessions`, `reagent history`, `reagent watch`, `reagent inspect`, and `reagent install` are the preferred OpenClaw-derived operator surface
- `reagent plugins marketplace list upstream` and `reagent plugins marketplace list openclaw` expose imported upstream extensions
