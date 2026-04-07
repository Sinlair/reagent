import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ quiet: true });

const OptionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const OptionalEmailString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().optional()
);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  RESEARCH_AGENT_NAME: z.string().trim().min(1).default("ReAgent"),
  UI_TITLE: z.string().trim().min(1).default("ReAgent Control Console"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().trim().min(1).default("file:./prisma/dev.db"),
  PLATFORM_WORKSPACE_DIR: z.string().trim().min(1).default("./workspace"),
  LLM_PROVIDER: z.enum(["fallback", "openai"]).default("fallback"),
  OPENAI_API_KEY: OptionalNonEmptyString,
  OPENAI_BASE_URL: OptionalNonEmptyString,
  OPENAI_WIRE_API: z.enum(["responses", "chat-completions"]).default("responses"),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  CROSSREF_MAILTO: OptionalEmailString,
  WECHAT_PROVIDER: z.enum(["mock", "native", "openclaw"]).default("mock"),
  OPENCLAW_CLI_PATH: z.string().trim().min(1).default("openclaw"),
  OPENCLAW_GATEWAY_URL: z.string().trim().min(1).default("ws://127.0.0.1:18789"),
  OPENCLAW_GATEWAY_TOKEN: OptionalNonEmptyString,
  OPENCLAW_GATEWAY_PASSWORD: OptionalNonEmptyString,
  OPENCLAW_WECHAT_CHANNEL_ID: z.string().trim().min(1).default("openclaw-weixin")
});

export const env = EnvSchema.parse(process.env);

