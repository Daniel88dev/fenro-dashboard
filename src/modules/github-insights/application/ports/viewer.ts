/**
 * Who "you" is. The dashboard signs in with GitHub (ticket 03), so the viewer
 * and the credentials that read GitHub on their behalf both arrive per request.
 *
 * That is why this is a port rather than a value read from the environment: the
 * OAuth adapter plugs in here, and — per
 * docs/research/nextjs-16-rendering-strategy.md — the viewer must be resolved
 * above any cached scope and passed in, never reached for from inside one.
 */
export type Viewer = {
  /** The signed-in user's id, which is who a watched repository belongs to. */
  readonly id: string;
  readonly login: string;
  /**
   * The viewer's GitHub OAuth token. Only an adapter that calls GitHub reads
   * it; keep it out of commands, queries, read models, props and anything
   * cached.
   */
  readonly accessToken: string;
};

/**
 * The person whose dashboard a query reads: which watch list, and whose login
 * reads as "you". The viewer without the token.
 */
export type Watcher = Pick<Viewer, "id" | "login">;

export interface ViewerProvider {
  current(): Promise<Viewer | null>;
}
