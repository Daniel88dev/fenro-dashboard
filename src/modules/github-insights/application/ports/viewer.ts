// Resolve the viewer above any cached scope and pass it in; never reach for
// it from inside one.
export type Viewer = {
  readonly id: string;
  readonly login: string;
  // Only an adapter that calls GitHub reads this; keep it out of commands,
  // queries, read models, props and anything cached.
  readonly accessToken: string;
};

export type Watcher = Pick<Viewer, "id" | "login">;

export interface ViewerProvider {
  current(): Promise<Viewer | null>;
}
