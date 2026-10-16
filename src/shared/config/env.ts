import { z } from "zod";

// dotenv reads `KEY=` from `.env.example` as an empty string; treat it as unset
// so a copied example file does not fail validation.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  GITHUB_TOKEN: optional(z.string()),
  DATABASE_URL: optional(z.string()),
  // Its tables are emptied by the adapter tests: never point it at real data.
  TEST_DATABASE_URL: optional(z.string()),
  // Rotating it signs everybody out and makes stored GitHub tokens unreadable.
  BETTER_AUTH_SECRET: optional(
    z.string().min(32, "must be at least 32 characters"),
  ),
  GITHUB_CLIENT_ID: optional(z.string()),
  GITHUB_CLIENT_SECRET: optional(z.string()),
  GITHUB_APP_SLUG: optional(z.string()),
  PICTURES_S3_BUCKET: optional(z.string()),
  PICTURES_S3_REGION: z.string().default("eu-central-1"),
  // Unset on AWS: the app signs in with the App Runner instance role.
  PICTURES_S3_ENDPOINT: optional(z.string().url()),
  PICTURES_S3_ACCESS_KEY_ID: optional(z.string()),
  PICTURES_S3_SECRET_ACCESS_KEY: optional(z.string()),
  // Public: the browser sends to it too.
  SENTRY_DSN: optional(z.string().url()),
  SENTRY_ENVIRONMENT: optional(z.string()),
  SENTRY_RELEASE: optional(z.string()),
  SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).max(1).default(1),
  ),
  // Build time only: `next build` uploads source maps when all three are set.
  SENTRY_AUTH_TOKEN: optional(z.string()),
  SENTRY_ORG: optional(z.string()),
  SENTRY_PROJECT: optional(z.string()),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

type EnvSource = Record<string, string | undefined>;

export function getEnv(env: EnvSource = process.env): Env {
  if (cached && env === process.env) return cached;

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  if (env === process.env) cached = parsed.data;
  return parsed.data;
}

type Present<K extends keyof Env> = { [P in K]-?: NonNullable<Env[P]> };

// Settings are optional in the schema so the app builds and tests run without
// them; a missing one fails here with its name rather than inside a driver.
export function requireEnv<K extends keyof Env>(
  keys: readonly K[],
  env: Env = getEnv(),
): Present<K> {
  const missing = keys.filter((key) => env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}. ` +
        "See .env.example for what each one is.",
    );
  }
  return env as Env & Present<K>;
}
