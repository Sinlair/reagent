# Developer Extensions: Skills, MCP, And Bridge Contracts

ReAgent exposes several extension seams.

This page is the public developer entrypoint for them.

## 1. Workspace Skills

Workspace skills live under:

```text
workspace/skills/<skill-name>/
```

Minimum example:

```text
workspace/skills/example-skill/SKILL.md
```

Public example:

- [Workspace Skill Example](./examples/workspace-skill-example.md)
- Real repo skill: `workspace/skills/research-brief/SKILL.md`

Expected usage:

- skill text explains when the skill should be used
- optional reference files stay near the skill
- skill enablement is managed through `workspace/channels/skills-config.json`

Related commands:

```powershell
reagent skills list
reagent skills set entries.workspace:example-skill.enabled true
```

## 2. MCP Servers

Managed MCP config lives under:

```text
workspace/channels/mcp-servers.json
```

Public example:

- [MCP Config Example](./examples/mcp-servers.example.json)

Related commands:

```powershell
reagent mcp list
reagent config file mcp
reagent config validate
```

## 3. Plugin And Bridge Contracts

ReAgent currently exposes OpenClaw-related host and bridge integration through:

- canonical runtime inspection surfaces
- OpenClaw compatibility command families
- file-backed host session caches under `workspace/channels/openclaw-*`

Relevant commands:

```powershell
reagent agent host sessions
reagent sessions
reagent history <sessionKey>
reagent plugins list
```

Public example:

- [Plugin And Bridge Example](./examples/plugin-bridge-example.md)

## 4. Stability Notes

Treat these as stable:

- root `reagent` install path
- canonical `reagent agent ...` surface
- managed config surfaces for `llm`, `mcp`, `skills`, and `commands`

Treat these as evolving:

- internal workspace file layout beyond documented managed config and artifact paths
- bridge-specific storage details
- experimental delegation semantics

## 5. Validation Expectations

When adding or modifying an extension:

- update at least one public doc page
- keep command examples current
- add or update regression tests when behavior changes
