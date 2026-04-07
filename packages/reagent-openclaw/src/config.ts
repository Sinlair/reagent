import { z } from "zod";

const schema = z.object({
  crossrefMailto: z.string().trim().email().optional(),
});

export const ReAgentPluginConfigSchema = {
  safeParse: (value: unknown) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      return {
        success: true,
        data: parsed.data,
      };
    }

    return {
      success: false,
      error: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"),
          message: issue.message,
        })),
      },
    };
  },
};

export type ReAgentPluginConfig = {
  crossrefMailto?: string | undefined;
};
