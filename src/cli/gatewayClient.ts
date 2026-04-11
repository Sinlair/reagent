import process from "node:process";

import { DEFAULT_GATEWAY_PORT } from "../gatewayService.js";
import {
  applyRuntimeOverrides,
  getIntegerFlag,
  getStringFlag,
  type ParsedOptions,
} from "./args.js";

export type GatewayContext<TEnv> = {
  runtimeEnv: TEnv;
  baseUrl: string;
  timeoutMs: number;
};

export type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

export function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, "");
}

export function normalizeGatewayBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Gateway URL cannot be empty.");
  }

  const withProtocol = /^[a-z]+:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`;
  return stripTrailingSlashes(new URL(withProtocol).toString());
}

export function normalizeLoopbackHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed || trimmed === "0.0.0.0" || trimmed === "::" || trimmed === "[::]") {
    return "127.0.0.1";
  }
  return trimmed;
}

export function resolveGatewayBaseUrl<TEnv extends { HOST: string }>(
  runtimeEnv: TEnv,
  options: ParsedOptions,
): string {
  const explicitUrl = getStringFlag(options, "url", "gateway-url");
  if (explicitUrl) {
    return normalizeGatewayBaseUrl(explicitUrl);
  }

  const host = normalizeLoopbackHost(getStringFlag(options, "host") ?? process.env.HOST ?? runtimeEnv.HOST);
  const port = getIntegerFlag(options, "port") ?? DEFAULT_GATEWAY_PORT;
  return normalizeGatewayBaseUrl(`http://${host}:${port}`);
}

export function resolveGatewayTimeoutMs(options: ParsedOptions, fallback = 15_000): number {
  const timeout = getIntegerFlag(options, "timeout", "timeout-ms");
  if (timeout === undefined) {
    return fallback;
  }
  return Math.max(1_000, Math.min(timeout, 120_000));
}

export async function resolveGatewayContext<TEnv extends { HOST: string }>(
  options: ParsedOptions,
  loadRuntimeEnv: () => Promise<TEnv>,
): Promise<GatewayContext<TEnv>> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  return {
    runtimeEnv,
    baseUrl: resolveGatewayBaseUrl(runtimeEnv, options),
    timeoutMs: resolveGatewayTimeoutMs(options),
  };
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  return search.toString();
}

export async function requestGatewayJson<T>(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<T> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "application/json",
  });
  const rawText = await response.text();

  if (!rawText.trim()) {
    return {} as T;
  }

  return JSON.parse(rawText) as T;
}

export async function requestGatewayResponse(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(endpoint, `${baseUrl}/`).toString(), {
      method: options.method ?? "GET",
      headers:
        options.body === undefined
          ? { Accept: options.accept ?? "application/json" }
          : { Accept: options.accept ?? "application/json", "Content-Type": "application/json" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawText = await response.text();
      const body = rawText.trim();
      throw new Error(
        body
          ? `Gateway request failed for ${endpoint}: ${response.status} ${response.statusText} - ${body}`
          : `Gateway request failed for ${endpoint}: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gateway request timed out after ${timeoutMs}ms: ${endpoint}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function requestGatewayText(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<string> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "text/plain, text/markdown, application/json;q=0.9, */*;q=0.8",
  });
  return response.text();
}

export async function requestGatewayBytes(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "*/*",
  });
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}
