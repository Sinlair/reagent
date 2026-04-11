import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface WorkspaceSkillDefinition {
  id: string;
  label: string;
  instruction: string;
  prompt: string;
  source: string;
  status: "ready" | "needs-setup" | "disabled";
  notes: string[];
  relatedTools: string[];
  referencePaths: string[];
  filePath: string;
  baseDir: string;
  primaryEnv?: string | undefined;
  homepage?: string | undefined;
  emoji?: string | undefined;
  always?: boolean | undefined;
}

export interface SkillStatusConfigCheck {
  path: string;
  expected: string;
  actual?: string | undefined;
  ok: boolean;
}

export interface SkillInstallOption {
  id: string;
  kind: "manual";
  label: string;
  bins: string[];
}

export interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean | undefined;
  primaryEnv?: string | undefined;
  emoji?: string | undefined;
  homepage?: string | undefined;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillStatusConfigCheck[];
  install: SkillInstallOption[];
}

export interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

export interface WorkspaceSkillMaterializationInput {
  directoryName: string;
  label: string;
  description: string;
  prompt: string;
  relatedTools: string[];
  referenceFileName?: string | undefined;
  referenceContent?: string | undefined;
  homepage?: string | undefined;
  enabled?: boolean | undefined;
}

export interface WorkspaceSkillMaterializationTarget {
  skillKey: string;
  directoryName: string;
  skillDirPath: string;
  skillFilePath: string;
  referenceFilePath?: string | undefined;
  configPath: string;
}

interface ParsedFrontmatter {
  [key: string]: string;
}

interface SkillConfigEntry {
  enabled?: boolean | undefined;
  apiKey?: string | undefined;
  env?: Record<string, string> | undefined;
}

interface SkillConfigStore {
  entries: Record<string, SkillConfigEntry>;
}

function defaultConfigStore(): SkillConfigStore {
  return {
    entries: {},
  };
}

function parseBoolean(value?: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return undefined;
}

function parseList(value?: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/[,\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stripHeading(value: string): string {
  return value.replace(/^#+\s*/u, "").trim();
}

function slugifySkillDirectoryName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function validateRelativeFileName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/[\\]+/gu, "/");
  if (normalized.includes("/") || normalized === "." || normalized === "..") {
    throw new Error("Reference file name must stay within the generated skill directory.");
  }

  return normalized;
}

function deriveInstruction(prompt: string, fallback: string): string {
  const lines = prompt
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstParagraph = lines.find((line) => !line.startsWith("#")) ?? lines[0] ?? "";
  const normalized = stripHeading(firstParagraph);
  if (!normalized) {
    return fallback;
  }
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177).trimEnd()}...`;
}

function parseSkillFile(raw: string): { frontmatter: ParsedFrontmatter; body: string } {
  const trimmed = raw.replace(/^\uFEFF/u, "");
  if (!trimmed.startsWith("---\n") && !trimmed.startsWith("---\r\n")) {
    return {
      frontmatter: {},
      body: trimmed.trim(),
    };
  }

  const lines = trimmed.split(/\r?\n/u);
  let index = 1;
  const frontmatter: ParsedFrontmatter = {};
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "---") {
      index += 1;
      break;
    }
    const separator = line.indexOf(":");
    if (separator !== -1) {
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key) {
        frontmatter[key] = value;
      }
    }
    index += 1;
  }

  return {
    frontmatter,
    body: lines.slice(index).join("\n").trim(),
  };
}

function renderWorkspaceSkillMarkdown(input: {
  label: string;
  description: string;
  prompt: string;
  relatedTools: string[];
  referenceFileName?: string | undefined;
  homepage?: string | undefined;
  enabled: boolean;
}): string {
  const lines = [
    "---",
    `name: ${input.label.trim()}`,
    `description: ${input.description.trim()}`,
    `enabled: ${String(input.enabled)}`,
    ...(input.relatedTools.length > 0 ? [`tools: ${input.relatedTools.join(", ")}`] : []),
    ...(input.referenceFileName ? [`references: ${input.referenceFileName}`] : []),
    ...(input.homepage?.trim() ? [`homepage: ${input.homepage.trim()}`] : []),
    "---",
    `# ${input.label.trim()}`,
    "",
    input.prompt.trim(),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function sanitizeConfigStore(value: unknown): SkillConfigStore {
  if (!value || typeof value !== "object") {
    return defaultConfigStore();
  }

  const entries: Record<string, SkillConfigEntry> = {};
  if ("entries" in value && value.entries && typeof value.entries === "object") {
    for (const [rawKey, rawEntry] of Object.entries(value.entries as Record<string, unknown>)) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const entry = rawEntry && typeof rawEntry === "object" ? (rawEntry as Record<string, unknown>) : {};
      const next: SkillConfigEntry = {};

      if (typeof entry.enabled === "boolean") {
        next.enabled = entry.enabled;
      }
      if (typeof entry.apiKey === "string" && entry.apiKey.trim()) {
        next.apiKey = entry.apiKey.trim();
      }
      if (entry.env && typeof entry.env === "object") {
        const envEntries = Object.entries(entry.env as Record<string, unknown>)
          .filter((item): item is [string, string] => typeof item[0] === "string" && typeof item[1] === "string")
          .map(([envKey, envValue]) => [envKey.trim(), envValue.trim()] as const)
          .filter(([envKey, envValue]) => envKey.length > 0 && envValue.length > 0);
        if (envEntries.length > 0) {
          next.env = Object.fromEntries(envEntries);
        }
      }

      entries[key] = next;
    }
  }

  return { entries };
}

export class SkillRegistryService {
  private readonly skillsDir: string;
  private readonly configPath: string;

  constructor(private readonly workspaceDir: string) {
    this.skillsDir = path.join(this.workspaceDir, "skills");
    this.configPath = path.join(this.workspaceDir, "channels", "skills-config.json");
  }

  async ensureSkillsDir(): Promise<void> {
    await mkdir(this.skillsDir, { recursive: true });
    await mkdir(path.dirname(this.configPath), { recursive: true });
  }

  async applyStoredEnvOverrides(): Promise<void> {
    const store = await this.readConfigStore();
    for (const entry of Object.values(store.entries)) {
      if (entry.apiKey?.trim()) {
        const primaryEnv = entry.env && Object.keys(entry.env)[0];
        if (primaryEnv && !process.env[primaryEnv]?.trim()) {
          process.env[primaryEnv] = entry.apiKey.trim();
        }
      }
      for (const [envName, envValue] of Object.entries(entry.env ?? {})) {
        if (envValue.trim()) {
          process.env[envName] = envValue.trim();
        }
      }
    }
  }

  async listSkills(): Promise<WorkspaceSkillDefinition[]> {
    return this.listWorkspaceSkillDefinitions();
  }

  async getSkill(skillKey: string): Promise<WorkspaceSkillDefinition | null> {
    const normalized = skillKey.trim();
    if (!normalized) {
      return null;
    }

    const skills = await this.listWorkspaceSkillDefinitions();
    return skills.find((skill) => skill.id === normalized) ?? null;
  }

  resolveMaterializationTarget(
    directoryName: string,
    referenceFileName?: string | undefined,
  ): WorkspaceSkillMaterializationTarget {
    const safeDirectoryName = slugifySkillDirectoryName(directoryName);
    if (!safeDirectoryName) {
      throw new Error("Skill directory name could not be resolved safely.");
    }

    const skillDirPath = path.join(this.skillsDir, safeDirectoryName);
    const relativeSkillPath = path.relative(this.skillsDir, skillDirPath);
    if (!relativeSkillPath || relativeSkillPath.startsWith("..") || path.isAbsolute(relativeSkillPath)) {
      throw new Error("Resolved skill directory escaped the workspace skills directory.");
    }

    const safeReferenceFileName = validateRelativeFileName(referenceFileName);
    return {
      skillKey: `workspace:${safeDirectoryName}`,
      directoryName: safeDirectoryName,
      skillDirPath,
      skillFilePath: path.join(skillDirPath, "SKILL.md"),
      ...(safeReferenceFileName ? { referenceFilePath: path.join(skillDirPath, safeReferenceFileName) } : {}),
      configPath: this.configPath,
    };
  }

  async materializeSkill(input: WorkspaceSkillMaterializationInput): Promise<WorkspaceSkillMaterializationTarget> {
    const enabled = input.enabled ?? false;
    const target = this.resolveMaterializationTarget(input.directoryName, input.referenceFileName);
    const existing = await this.getSkill(target.skillKey);
    if (existing) {
      throw new Error(`Workspace skill ${target.skillKey} already exists.`);
    }

    await this.ensureSkillsDir();
    await mkdir(target.skillDirPath, { recursive: true });
    await writeFile(
      target.skillFilePath,
      renderWorkspaceSkillMarkdown({
        label: input.label,
        description: input.description,
        prompt: input.prompt,
        relatedTools: input.relatedTools,
        ...(input.referenceFileName ? { referenceFileName: validateRelativeFileName(input.referenceFileName) } : {}),
        ...(input.homepage?.trim() ? { homepage: input.homepage.trim() } : {}),
        enabled,
      }),
      "utf8",
    );

    if (target.referenceFilePath && input.referenceContent?.trim()) {
      await writeFile(target.referenceFilePath, `${input.referenceContent.trim()}\n`, "utf8");
    }

    await this.updateSkill({
      skillKey: target.skillKey,
      enabled,
    });

    return target;
  }

  async deleteSkill(skillKey: string): Promise<boolean> {
    const normalized = skillKey.trim();
    if (!normalized.startsWith("workspace:")) {
      return false;
    }

    const directoryName = normalized.slice("workspace:".length).trim();
    if (!directoryName) {
      return false;
    }

    const target = this.resolveMaterializationTarget(directoryName);
    await rm(target.skillDirPath, { recursive: true, force: true });

    const store = await this.readConfigStore();
    if (normalized in store.entries) {
      delete store.entries[normalized];
      await this.writeConfigStore(store);
    }

    return true;
  }

  async listWorkspaceSkillDefinitions(): Promise<WorkspaceSkillDefinition[]> {
    await this.applyStoredEnvOverrides();
    const store = await this.readConfigStore();
    const rawSkills = await this.loadRawSkills();

    return rawSkills.map((skill) => {
      const config = store.entries[skill.id] ?? {};
      const envRequirements = parseList(
        skill.frontmatter.env ??
          skill.frontmatter.requires_env ??
          skill.frontmatter.required_env ??
          skill.frontmatter.primaryEnv,
      );
      const primaryEnv =
        skill.frontmatter.primaryEnv?.trim() || envRequirements[0] || undefined;

      if (primaryEnv && config.apiKey?.trim()) {
        process.env[primaryEnv] = config.apiKey.trim();
      }
      for (const [envName, envValue] of Object.entries(config.env ?? {})) {
        if (envValue.trim()) {
          process.env[envName] = envValue.trim();
        }
      }

      const missingEnv = envRequirements.filter((name) => !process.env[name]?.trim());
      const globallyEnabled = config.enabled ?? (parseBoolean(skill.frontmatter.enabled) ?? true);
      const always = parseBoolean(skill.frontmatter.always) ?? false;
      const notes = [
        `Skill file: ${skill.filePath}`,
        ...(missingEnv.length > 0
          ? missingEnv.map((name) => `Environment variable ${name} is required.`)
          : []),
      ];

      return {
        id: skill.id,
        label: skill.label,
        instruction: skill.instruction,
        prompt: skill.prompt,
        source: "workspace-skill",
        status: !globallyEnabled ? "disabled" : missingEnv.length > 0 ? "needs-setup" : "ready",
        notes,
        relatedTools: skill.relatedTools,
        referencePaths: skill.referencePaths,
        filePath: skill.filePath,
        baseDir: skill.baseDir,
        ...(primaryEnv ? { primaryEnv } : {}),
        ...(skill.homepage ? { homepage: skill.homepage } : {}),
        ...(skill.emoji ? { emoji: skill.emoji } : {}),
        ...(always ? { always } : {}),
      } satisfies WorkspaceSkillDefinition;
    });
  }

  async buildStatusReport(): Promise<SkillStatusReport> {
    await this.applyStoredEnvOverrides();
    const store = await this.readConfigStore();
    const skills = await this.loadRawSkills();

    return {
      workspaceDir: this.workspaceDir,
      managedSkillsDir: this.skillsDir,
      skills: skills.map((skill) => {
        const config = store.entries[skill.id] ?? {};
        const envRequirements = parseList(
          skill.frontmatter.env ??
            skill.frontmatter.requires_env ??
            skill.frontmatter.required_env ??
            skill.frontmatter.primaryEnv,
        );
        const primaryEnv =
          skill.frontmatter.primaryEnv?.trim() || envRequirements[0] || undefined;

        if (primaryEnv && config.apiKey?.trim()) {
          process.env[primaryEnv] = config.apiKey.trim();
        }
        for (const [envName, envValue] of Object.entries(config.env ?? {})) {
          if (envValue.trim()) {
            process.env[envName] = envValue.trim();
          }
        }

        const disabled = config.enabled === false || parseBoolean(skill.frontmatter.enabled) === false;
        const always = parseBoolean(skill.frontmatter.always) ?? false;
        const missingEnv = envRequirements.filter((name) => !process.env[name]?.trim());
        const eligible = !disabled && missingEnv.length === 0;

        return {
          name: skill.label,
          description: skill.instruction,
          source: "workspace-skill",
          filePath: skill.filePath,
          baseDir: skill.baseDir,
          skillKey: skill.id,
          ...(primaryEnv ? { primaryEnv } : {}),
          ...(skill.emoji ? { emoji: skill.emoji } : {}),
          ...(skill.homepage ? { homepage: skill.homepage } : {}),
          always,
          disabled,
          blockedByAllowlist: false,
          eligible,
          requirements: {
            bins: [],
            env: envRequirements,
            config: [],
            os: [],
          },
          missing: {
            bins: [],
            env: missingEnv,
            config: [],
            os: [],
          },
          configChecks: [],
          install: [],
        } satisfies SkillStatusEntry;
      }),
    };
  }

  async updateSkill(params: {
    skillKey: string;
    enabled?: boolean | undefined;
    apiKey?: string | undefined;
    env?: Record<string, string> | undefined;
  }): Promise<{ ok: true; skillKey: string; config: SkillConfigEntry }> {
    const store = await this.readConfigStore();
    const existing = store.entries[params.skillKey] ?? {};
    const next: SkillConfigEntry = {
      ...existing,
      ...(typeof params.enabled === "boolean" ? { enabled: params.enabled } : {}),
    };

    const skills = await this.loadRawSkills();
    const skill = skills.find((entry) => entry.id === params.skillKey);
    const envRequirements = skill
      ? parseList(
          skill.frontmatter.env ??
            skill.frontmatter.requires_env ??
            skill.frontmatter.required_env ??
            skill.frontmatter.primaryEnv,
        )
      : [];
    const primaryEnv = skill?.frontmatter.primaryEnv?.trim() || envRequirements[0] || undefined;

    if (typeof params.apiKey === "string") {
      const trimmed = params.apiKey.trim();
      if (trimmed) {
        next.apiKey = trimmed;
        if (primaryEnv) {
          const nextEnv = { ...(next.env ?? {}), [primaryEnv]: trimmed };
          next.env = nextEnv;
          process.env[primaryEnv] = trimmed;
        }
      } else {
        delete next.apiKey;
        if (primaryEnv && next.env && primaryEnv in next.env) {
          delete next.env[primaryEnv];
        }
      }
    }

    if (params.env && typeof params.env === "object") {
      const nextEnv = { ...(next.env ?? {}) };
      for (const [envName, rawValue] of Object.entries(params.env)) {
        const key = envName.trim();
        const value = rawValue.trim();
        if (!key) {
          continue;
        }
        if (!value) {
          delete nextEnv[key];
          delete process.env[key];
        } else {
          nextEnv[key] = value;
          process.env[key] = value;
        }
      }
      next.env = nextEnv;
    }

    store.entries[params.skillKey] = next;
    await this.writeConfigStore(store);
    return {
      ok: true,
      skillKey: params.skillKey,
      config: next,
    };
  }

  private async loadRawSkills(): Promise<
    Array<{
      id: string;
      label: string;
      instruction: string;
      prompt: string;
      frontmatter: ParsedFrontmatter;
      relatedTools: string[];
      referencePaths: string[];
      filePath: string;
      baseDir: string;
      homepage?: string | undefined;
      emoji?: string | undefined;
    }>
  > {
    await this.ensureSkillsDir();

    let entries: Array<{ name: string; fullPath: string }> = [];
    try {
      const children = await readdir(this.skillsDir, { withFileTypes: true });
      entries = children
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          name: entry.name,
          fullPath: path.join(this.skillsDir, entry.name),
        }));
    } catch {
      return [];
    }

    const skills = await Promise.all(
      entries.map(async (entry) => {
        const skillPath = path.join(entry.fullPath, "SKILL.md");
        try {
          const raw = await readFile(skillPath, "utf8");
          const parsed = parseSkillFile(raw);
          const prompt = parsed.body;
          const label =
            parsed.frontmatter.name?.trim() ||
            parsed.frontmatter.label?.trim() ||
            stripHeading(prompt.split(/\r?\n/u).find((line) => line.trim().startsWith("#")) ?? "") ||
            entry.name;
          const instruction = deriveInstruction(
            prompt,
            parsed.frontmatter.description?.trim() || `Workspace skill loaded from ${entry.name}.`,
          );

          return {
            id: `workspace:${entry.name}`,
            label,
            instruction,
            prompt,
            frontmatter: parsed.frontmatter,
            relatedTools: parseList(
              parsed.frontmatter.tools ??
                parsed.frontmatter.related_tools ??
                parsed.frontmatter.relatedTools,
            ),
            referencePaths: parseList(
              parsed.frontmatter.references ??
                parsed.frontmatter.reference_files ??
                parsed.frontmatter.referenceFiles ??
                parsed.frontmatter.refs,
            )
              .map((value) => path.resolve(entry.fullPath, value))
              .filter((resolvedPath) => {
                const relative = path.relative(entry.fullPath, resolvedPath);
                return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
              }),
            filePath: skillPath,
            baseDir: entry.fullPath,
            ...(parsed.frontmatter.homepage?.trim() ? { homepage: parsed.frontmatter.homepage.trim() } : {}),
            ...(parsed.frontmatter.emoji?.trim() ? { emoji: parsed.frontmatter.emoji.trim() } : {}),
          } as {
            id: string;
            label: string;
            instruction: string;
            prompt: string;
            frontmatter: ParsedFrontmatter;
            relatedTools: string[];
            referencePaths: string[];
            filePath: string;
            baseDir: string;
            homepage?: string | undefined;
            emoji?: string | undefined;
          };
        } catch {
          return null;
        }
      }),
    );

    return skills.filter((skill) => skill !== null);
  }

  private async readConfigStore(): Promise<SkillConfigStore> {
    await this.ensureSkillsDir();
    try {
      const raw = await readFile(this.configPath, "utf8");
      return sanitizeConfigStore(JSON.parse(raw));
    } catch {
      return defaultConfigStore();
    }
  }

  private async writeConfigStore(store: SkillConfigStore): Promise<void> {
    await this.ensureSkillsDir();
    await writeFile(this.configPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}
