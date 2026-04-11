export function sanitizeCliPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCliPayload(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      if (/(api[_-]?key|token|password|authorization)$/iu.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, sanitizeCliPayload(entryValue)];
    });
    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(sanitizeCliPayload(value), null, 2));
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function settleCliRequest<T>(
  promise: Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: formatErrorMessage(error) };
  }
}
