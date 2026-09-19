import { z } from "zod";

/**
 * Every setting the app reads comes from a plain environment variable, so the
 * same build runs on Vercel, on a container, or on a laptop.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Public origin of the app, used for absolute URLs and OAuth callbacks. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Personal access token used to read the dashboards' repositories. */
  GITHUB_TOKEN: z.string().min(1).optional(),
  /** Connection string for the task store, once one is wired up. */
  DATABASE_URL: z.string().min(1).optional(),
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
