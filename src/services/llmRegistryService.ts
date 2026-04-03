import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "../config/env.js";
import type { OpenAiWireApi } from "../providers/llm/openAiCompatClient.js";

export type LlmProviderType = "fallback" | "openai";
export type LlmRoutePurpose = "agent" | "research";
export type LlmRouteStatus = "ready" | "needs-setup" | "disabled";

export interface LlmRouteSelection {
  providerId: string;
  modelId: string;
}

export interface LlmModelConfig {
  id: string;
  label?: string | undefined;
  enabled?: boolean | undefined;
  wireApi?: OpenAiWireApi | undefined;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
}

export interface LlmProviderConfig {
  id: string;
  label?: string | undefined;
  type?: LlmProviderType | undefined;
  enabled?: boolean | undefined;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
  wireApi?: OpenAiWireApi | undefined;
  models?: LlmModelConfig[] | undefined;
}

interface LlmRegistryStore {
  defaults?: Partial<Record<LlmRoutePurpose, LlmRouteSelection>> | undefined;
  providers?: LlmProviderConfig[] | undefined;
}

export interface LlmModelStatus {
  id: string;
  label: string;
  enabled: boolean;
  wireApi?: OpenAiWireApi | undefined;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
  status: LlmRouteStatus;
  notes: string[];
}

export interface LlmProviderStatus {
  id: string;
  label: string;
  type: LlmProviderType;
  enabled: boolean;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
  wireApi?: OpenAiWireApi | undefined;
  status: LlmRouteStatus;
  notes: string[];
  models: LlmModelStatus[];
}

export interface ResolvedLlmRoute {
  source: "registry" | "env";
  purpose: LlmRoutePurpose;
  providerId: string;
  providerLabel: string;
  providerType: LlmProviderType;
  modelId: string;
  modelLabel: string;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
  apiKey?: string | undefined;
  wireApi?: OpenAiWireApi | undefined;
  status: LlmRouteStatus;
  notes: string[];
}

function normalizeWireApi(value: unknown): OpenAiWireApi | undefined {
  return value === "responses" || value === "chat-completions" ? value : undefined;
}

function normalizeProviderType(value: unknown): LlmProviderType {
  return value === "fallback" ? "fallback" : "openai";
}

function normalizeSelection(value: unknown): LlmRouteSelection | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<LlmRouteSelection>;
  if (typeof candidate.providerId !== "string" || typeof candidate.modelId !== "string") {
    return undefined;
  }

  const providerId = candidate.providerId.trim();
  const modelId = candidate.modelId.trim();
  if (!providerId || !modelId) {
    return undefined;
  }

  return { providerId, modelId };
}

function sanitizeModelConfig(value: unknown): LlmModelConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LlmModelConfig>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    return null;
  }

  return {
    id: candidate.id.trim(),
    ...(typeof candidate.label === "string" && candidate.label.trim() ? { label: candidate.label.trim() } : {}),
    ...(typeof candidate.enabled === "boolean" ? { enabled: candidate.enabled } : {}),
    ...(normalizeWireApi(candidate.wireApi) ? { wireApi: normalizeWireApi(candidate.wireApi) } : {}),
    ...(typeof candidate.baseUrl === "string" && candidate.baseUrl.trim() ? { baseUrl: candidate.baseUrl.trim() } : {}),
    ...(typeof candidate.apiKeyEnv === "string" && candidate.apiKeyEnv.trim()
      ? { apiKeyEnv: candidate.apiKeyEnv.trim() }
      : {}),
  };
}

function sanitizeProviderConfig(value: unknown): LlmProviderConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LlmProviderConfig>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    return null;
  }

  const models = Array.isArray(candidate.models)
    ? candidate.models
        .map((model) => sanitizeModelConfig(model))
        .filter((model): model is LlmModelConfig => Boolean(model))
    : [];

  return {
    id: candidate.id.trim(),
    ...(typeof candidate.label === "string" && candidate.label.trim() ? { label: candidate.label.trim() } : {}),
    type: normalizeProviderType(candidate.type),
    ...(typeof candidate.enabled === "boolean" ? { enabled: candidate.enabled } : {}),
    ...(typeof candidate.baseUrl === "string" && candidate.baseUrl.trim() ? { baseUrl: candidate.baseUrl.trim() } : {}),
    ...(typeof candidate.apiKeyEnv === "string" && candidate.apiKeyEnv.trim()
      ? { apiKeyEnv: candidate.apiKeyEnv.trim() }
      : {}),
    ...(normalizeWireApi(candidate.wireApi) ? { wireApi: normalizeWireApi(candidate.wireApi) } : {}),
    models,
  };
}

function defaultStore(): LlmRegistryStore {
  return {
    defaults: {},
    providers: [
      {
        id: "example-openai",
        label: "Example OpenAI Compat",
        type: "openai",
        enabled: false,
        baseUrl: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
        wireApi: "responses",
        models: [
          {
            id: "gpt-5.4",
            label: "GPT-5.4",
            wireApi: "responses",
          },
          {
            id: "gpt-4o",
            label: "GPT-4o",
            wireApi: "chat-completions",
          },
        ],
      },
    ],
  };
}

export class LlmRegistryService {
  private readonly configPath: string;

  constructor(private readonly workspaceDir: string) {
    this.configPath = path.join(this.workspaceDir, "channels", "llm-providers.json");
  }

  async ensureConfigFile(): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      await readFile(this.configPath, "utf8");
    } catch {
      await writeFile(this.configPath, `${JSON.stringify(defaultStore(), null, 2)}\n`, "utf8");
    }
  }

  async listProviders(): Promise<LlmProviderStatus[]> {
    const store = await this.readStore();
    return store.providers.map((provider) => this.buildProviderStatus(provider));
  }

  async resolvePurpose(
    purpose: LlmRoutePurpose,
    selection?: LlmRouteSelection | undefined,
  ): Promise<ResolvedLlmRoute> {
    const store = await this.readStore();
    const normalizedSelection = normalizeSelection(selection) ?? normalizeSelection(store.defaults?.[purpose]);

    if (normalizedSelection) {
      const provider = store.providers.find((entry) => entry.id === normalizedSelection.providerId);
      if (!provider) {
        return {
          source: "registry",
          purpose,
          providerId: normalizedSelection.providerId,
          providerLabel: normalizedSelection.providerId,
          providerType: "openai",
          modelId: normalizedSelection.modelId,
          modelLabel: normalizedSelection.modelId,
          status: "needs-setup",
          notes: [`Configured provider "${normalizedSelection.providerId}" was not found in workspace/channels/llm-providers.json.`],
        };
      }

      const model = provider.models?.find((entry) => entry.id === normalizedSelection.modelId);
      if (!model) {
        return {
          source: "registry",
          purpose,
          providerId: provider.id,
          providerLabel: provider.label ?? provider.id,
          providerType: provider.type ?? "openai",
          modelId: normalizedSelection.modelId,
          modelLabel: normalizedSelection.modelId,
          baseUrl: provider.baseUrl,
          apiKeyEnv: provider.apiKeyEnv,
          wireApi: provider.wireApi,
          status: "needs-setup",
          notes: [`Configured model "${normalizedSelection.modelId}" was not found under provider "${provider.id}".`],
        };
      }

      const providerStatus = this.buildProviderStatus(provider);
      const modelStatus = providerStatus.models.find((entry) => entry.id === model.id)!;
      return {
        source: "registry",
        purpose,
        providerId: providerStatus.id,
        providerLabel: providerStatus.label,
        providerType: providerStatus.type,
        modelId: modelStatus.id,
        modelLabel: modelStatus.label,
        ...(modelStatus.baseUrl ?? providerStatus.baseUrl ? { baseUrl: modelStatus.baseUrl ?? providerStatus.baseUrl } : {}),
        ...(modelStatus.apiKeyEnv ?? providerStatus.apiKeyEnv
          ? { apiKeyEnv: modelStatus.apiKeyEnv ?? providerStatus.apiKeyEnv }
          : {}),
        ...(this.readEnvValue(modelStatus.apiKeyEnv ?? providerStatus.apiKeyEnv)
          ? { apiKey: this.readEnvValue(modelStatus.apiKeyEnv ?? providerStatus.apiKeyEnv)! }
          : {}),
        ...(modelStatus.wireApi ?? providerStatus.wireApi ? { wireApi: modelStatus.wireApi ?? providerStatus.wireApi } : {}),
        status: modelStatus.status,
        notes: [...modelStatus.notes],
      };
    }

    return this.buildEnvRoute(purpose);
  }

  async getSummary(): Promise<{
    defaults: Partial<Record<LlmRoutePurpose, LlmRouteSelection>>;
    providers: LlmProviderStatus[];
    routes: Record<LlmRoutePurpose, ResolvedLlmRoute>;
  }> {
    const store = await this.readStore();
    const providers = store.providers.map((provider) => this.buildProviderStatus(provider));
    return {
      defaults: store.defaults ?? {},
      providers,
      routes: {
        agent: await this.resolvePurpose("agent"),
        research: await this.resolvePurpose("research"),
      },
    };
  }

  private buildProviderStatus(provider: LlmProviderConfig): LlmProviderStatus {
    const type = provider.type ?? "openai";
    const enabled = provider.enabled !== false;
    const baseNotes: string[] = [];
    const apiKeyEnv = provider.apiKeyEnv?.trim() || undefined;
    const wireApi = provider.wireApi;

    if (!enabled) {
      baseNotes.push("This provider is disabled in the local registry.");
    }

    if (type === "openai") {
      if (apiKeyEnv && !this.readEnvValue(apiKeyEnv)) {
        baseNotes.push(`Environment variable ${apiKeyEnv} is not set.`);
      }
      if (!apiKeyEnv) {
        baseNotes.push("Missing apiKeyEnv for this OpenAI-compatible provider.");
      }
    }

    const providerStatus: LlmRouteStatus = !enabled
      ? "disabled"
      : baseNotes.some((note) => note.includes("Missing") || note.includes("not set"))
        ? "needs-setup"
        : "ready";

    const models = (provider.models ?? []).map((model) => {
      const modelEnabled = model.enabled !== false;
      const notes = [...baseNotes];
      if (!modelEnabled) {
        notes.push("This model is disabled under its provider.");
      }

      return {
        id: model.id,
        label: model.label ?? model.id,
        enabled: modelEnabled,
        ...(model.wireApi ?? wireApi ? { wireApi: model.wireApi ?? wireApi } : {}),
        ...(model.baseUrl ?? provider.baseUrl ? { baseUrl: model.baseUrl ?? provider.baseUrl } : {}),
        ...(model.apiKeyEnv ?? apiKeyEnv ? { apiKeyEnv: model.apiKeyEnv ?? apiKeyEnv } : {}),
        status: !modelEnabled ? "disabled" : providerStatus,
        notes: notes.length ? notes : ["Ready to use in the ReAgent runtime."],
      } satisfies LlmModelStatus;
    });

    return {
      id: provider.id,
      label: provider.label ?? provider.id,
      type,
      enabled,
      ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
      ...(apiKeyEnv ? { apiKeyEnv } : {}),
      ...(wireApi ? { wireApi } : {}),
      status: providerStatus,
      notes: baseNotes.length ? baseNotes : ["Ready to expose models to ReAgent."],
      models,
    };
  }

  private buildEnvRoute(purpose: LlmRoutePurpose): ResolvedLlmRoute {
    if (env.LLM_PROVIDER === "openai") {
      const notes = env.OPENAI_API_KEY ? [] : ["Environment variable OPENAI_API_KEY is not set."];
      return {
        source: "env",
        purpose,
        providerId: "env-openai",
        providerLabel: "Environment OpenAI",
        providerType: "openai",
        modelId: env.OPENAI_MODEL,
        modelLabel: env.OPENAI_MODEL,
        ...(env.OPENAI_BASE_URL ? { baseUrl: env.OPENAI_BASE_URL } : {}),
        ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
        apiKeyEnv: "OPENAI_API_KEY",
        wireApi: env.OPENAI_WIRE_API,
        status: env.OPENAI_API_KEY ? "ready" : "needs-setup",
        notes: notes.length ? notes : ["Using legacy environment-based OpenAI configuration."],
      };
    }

    return {
      source: "env",
      purpose,
      providerId: "env-fallback",
      providerLabel: "Environment Fallback",
      providerType: "fallback",
      modelId: "fallback",
      modelLabel: "Fallback",
      status: "ready",
      notes: ["Using deterministic fallback LLM output."],
    };
  }

  private readEnvValue(name?: string | undefined): string | undefined {
    if (!name?.trim()) {
      return undefined;
    }
    const value = process.env[name.trim()]?.trim();
    return value ? value : undefined;
  }

  private async readStore(): Promise<{
    defaults: Partial<Record<LlmRoutePurpose, LlmRouteSelection>>;
    providers: LlmProviderConfig[];
  }> {
    await this.ensureConfigFile();

    try {
      const raw = await readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as LlmRegistryStore;
      const providers = Array.isArray(parsed.providers)
        ? parsed.providers
            .map((provider) => sanitizeProviderConfig(provider))
            .filter((provider): provider is LlmProviderConfig => Boolean(provider))
        : [];

      return {
        defaults: {
          ...(normalizeSelection(parsed.defaults?.agent) ? { agent: normalizeSelection(parsed.defaults?.agent)! } : {}),
          ...(normalizeSelection(parsed.defaults?.research)
            ? { research: normalizeSelection(parsed.defaults?.research)! }
            : {}),
        },
        providers,
      };
    } catch {
      const store = defaultStore();
      return {
        defaults: {},
        providers: store.providers ?? [],
      };
    }
  }
}
