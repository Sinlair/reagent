# Workspace Skill Example

Use the existing workspace skill at:

```text
workspace/skills/research-brief/SKILL.md
```

This is the public example skill for ReAgent's workspace skill contract.

## Why This Example

It is already a real workspace skill in the repo and demonstrates:

- a `SKILL.md` entrypoint
- repo-local reference material
- workspace-managed skill discovery

## Validation Steps

1. Inspect the skill from the workspace:

```powershell
reagent skills list
```

2. Confirm the skill key appears:

```text
workspace:research-brief
```

3. Inspect the underlying skill file:

```text
workspace/skills/research-brief/SKILL.md
```

## Contract Surface

Minimum expected structure:

```text
workspace/skills/<skill-name>/SKILL.md
```

Stable assumptions:

- workspace skills are file-backed
- skill enablement is managed through `workspace/channels/skills-config.json`
- the skill key format is `workspace:<skill-name>`
