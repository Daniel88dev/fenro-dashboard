import type {
  Viewer,
  ViewerProvider,
} from "@/modules/github-insights/application/ports/viewer";

/**
 * Stands in for GitHub sign-in until it is built. It returns the login the
 * sample data was written around, so the screen already distinguishes "you"
 * from everyone else through the port the OAuth adapter will implement.
 */
export class SampleViewerProvider implements ViewerProvider {
  constructor(private readonly login = "Daniel88dev") {}

  current(): Promise<Viewer | null> {
    return Promise.resolve({ login: this.login });
  }
}
