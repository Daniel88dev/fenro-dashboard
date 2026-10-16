import { err, ok, ValueObject, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

export const EXTERNAL_SYSTEMS = [
  "github-issue",
  "github-pull-request",
  "jira",
  "linear",
  "url",
] as const;

export type ExternalSystem = (typeof EXTERNAL_SYSTEMS)[number];

type Props = {
  readonly system: ExternalSystem;
  readonly key: string;
  readonly url: string;
  readonly title: string | null;
  readonly isSource: boolean;
};

const GITHUB = /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)(?:\/|$)/;
const JIRA = /\/browse\/([A-Z][A-Z0-9_]*-\d+)(?:\/|$)/;
const LINEAR = /^\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)(?:\/|$)/;

export class ExternalReference extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static fromUrl(
    raw: string,
    options: { title?: string | null; isSource?: boolean } = {},
  ): Result<ExternalReference, TaskError> {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return err(invalidTask(`"${raw.trim()}" is not a URL.`));
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return err(invalidTask(`Only http and https links can be attached.`));
    }

    const title = options.title?.trim() || null;
    const isSource = options.isSource ?? false;
    const { system, key } = recognise(url);
    return ok(
      new ExternalReference({ system, key, url: url.href, title, isSource }),
    );
  }

  static restore(props: Props): ExternalReference {
    return new ExternalReference(props);
  }

  get system(): ExternalSystem {
    return this.props.system;
  }

  get key(): string {
    return this.props.key;
  }

  get url(): string {
    return this.props.url;
  }

  get title(): string | null {
    return this.props.title;
  }

  get isSource(): boolean {
    return this.props.isSource;
  }

  sameTarget(other: ExternalReference): boolean {
    return this.system === other.system && this.key === other.key;
  }

  asSource(isSource: boolean): ExternalReference {
    return new ExternalReference({ ...this.props, isSource });
  }
}

function recognise(url: URL): { system: ExternalSystem; key: string } {
  const host = url.hostname.toLowerCase();

  if (host === "github.com" || host === "www.github.com") {
    const match = GITHUB.exec(url.pathname);
    if (match) {
      const [, owner, repository, kind, number] = match;
      return {
        system: kind === "pull" ? "github-pull-request" : "github-issue",
        key: `${owner}/${repository}#${number}`,
      };
    }
  }

  if (host === "linear.app") {
    const match = LINEAR.exec(url.pathname);
    if (match) return { system: "linear", key: match[1]! };
  }

  // Jira Cloud lives on *.atlassian.net; a self-hosted Jira keeps the same
  // /browse/KEY-1 path on its own host.
  const jira = JIRA.exec(url.pathname);
  if (jira) return { system: "jira", key: jira[1]! };

  return { system: "url", key: url.href };
}
