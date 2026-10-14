import { z } from "zod";

/**
 * `.env.example` lists every key with an empty value, and dotenv reads `KEY=`
 * as an empty string. Treat that as "not set", or copying the example file
 * would fail validation before anyone filled it in.
 */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
}

/**
 * Every setting the app reads comes from a plain environment variable, so the
 * same build runs on a container or on a laptop.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Public origin of the app, used for absolute URLs and OAuth callbacks. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Optional fallback token. Sign-in is the normal path: GitHub is read with
   * the signed-in viewer's own token.
   */
  GITHUB_TOKEN: optional(z.string()),
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/fenro. */
  DATABASE_URL: optional(z.string()),
  /**
   * A throwaway Postgres for the adapter tests, which migrate it and empty
   * its tables. Never point it at a database whose data you want. Unset, those
   * tests are skipped.
   */
  TEST_DATABASE_URL: optional(z.string()),
  /**
   * Signs session cookies and encrypts the stored GitHub tokens. Rotating it
   * signs everybody out and makes stored tokens unreadable until they sign in
   * again.
   */
  BETTER_AUTH_SECRET: optional(
    z.string().min(32, "must be at least 32 characters"),
  ),
  /** The GitHub App that "Sign in with GitHub" goes through. */
  GITHUB_CLIENT_ID: optional(z.string()),
  GITHUB_CLIENT_SECRET: optional(z.string()),
  /**
   * The GitHub App's URL name (github.com/apps/<slug>), for the link that
   * installs it on more repositories. Unset, the link is not shown.
   */
  GITHUB_APP_SLUG: optional(z.string()),
  /**
   * The private S3 bucket pictures on tasks are kept in. Unset (and no
   * UPLOADTHING_TOKEN), tasks show no pictures and nothing can be added.
   */
  PICTURES_S3_BUCKET: optional(z.string()),
  PICTURES_S3_REGION: z.string().default("eu-central-1"),
  /**
   * A local S3 stand-in (S3Mock in compose.yaml) and keys for it. On AWS all
   * three stay unset: the app signs in with the App Runner instance role.
   */
  PICTURES_S3_ENDPOINT: optional(z.string().url()),
  PICTURES_S3_ACCESS_KEY_ID: optional(z.string()),
  PICTURES_S3_SECRET_ACCESS_KEY: optional(z.string()),
  /**
   * The UploadThing app pictures were kept in before S3. Read only while
   * PICTURES_S3_BUCKET is unset; removed once the pictures are copied.
   */
  UPLOADTHING_TOKEN: optional(z.string()),
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

/**
 * Settings are optional in the schema so the app builds and its tests run
 * without a database or a GitHub App. Code that needs them asks here, so a
 * missing one fails with its name rather than somewhere inside a driver.
 */
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
