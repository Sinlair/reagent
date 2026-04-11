# Changelog

[简体中文](./CHANGELOG.zh-CN.md)

This project follows the [Keep a Changelog](https://keepachangelog.com/) format.

## [0.1.10] - 2026-04-08

### Changed

- adopted a more OpenClaw-like command-first message flow for channel chat
- added intent routing so plain greetings and lightweight chat avoid the tool loop
- kept research and workspace-heavy requests on the agent runtime path

### Fixed

- stopped normal greetings like `你好` from falling into the tool-runtime fallback reply
- surfaced agent runtime failures to logs before falling back, making gateway/model issues diagnosable

## [0.1.9] - 2026-04-08

### Changed

- removed the internal multi-package layout from the repo and kept `@sinlair/reagent` as the only official package
- simplified release scripts so verification, packing, and publishing now target the standalone root package only
- updated README, release notes, and contributor guidance to match the single-package product story

### Fixed

- removed leftover runtime and UI references that still pointed users at `@sinlair/reagent-openclaw`
- cleaned generated workspace noise from the repo and ignored it going forward

## [0.1.8] - 2026-04-08

### Added

- standalone CLI entry points for `reagent home`, `reagent onboard`, and `reagent doctor --fix`
- a root-level release flow centered on the standalone `@sinlair/reagent` package

### Changed

- refocused the product narrative around the standalone always-on `reagent` runtime and CLI
- upgraded `reagent home` into a dashboard-style entry point with runtime, research, memory, and next-step sections
- collapsed the public install story down to a single official npm package: `@sinlair/reagent`

### Fixed

- removed duplicate report payload persistence from the research task store
- tightened release metadata so public packages now declare explicit public publish access

## [0.1.0] - 2026-04-03

### Added

- initial public release of ReAgent as a local research workspace and runtime CLI
