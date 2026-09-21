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
  readonly login: string;
};

export interface ViewerProvider {
  current(): Promise<Viewer | null>;
}
