import { err, ok, ValueObject, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

type Props = { readonly owner: string; readonly name: string };

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * The GitHub repository a task is about, as a plain `owner/name` pair. It is
 * the join key the dashboard uses to put task counts beside pull requests, and
 * deliberately not an id from github-insights: the two contexts stay unaware
 * of each other (ticket 09). A task keeps its repository when the repository
 * is unwatched.
 */
export class RepositoryReference extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  /** Parse the `owner/name` form. */
  static parse(value: string): Result<RepositoryReference, TaskError> {
    const [owner = "", name = "", ...rest] = value
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/");
    if (
      rest.length > 0 ||
      !OWNER.test(owner) ||
      !NAME.test(name) ||
      name === "." ||
      name === ".."
    ) {
      return err(
        invalidTask(
          `"${value.trim()}" is not a GitHub repository. Write it as owner/name.`,
        ),
      );
    }
    return ok(new RepositoryReference({ owner, name }));
  }

  get owner(): string {
    return this.props.owner;
  }

  get name(): string {
    return this.props.name;
  }

  get fullName(): string {
    return `${this.props.owner}/${this.props.name}`;
  }

  /** GitHub names are case-insensitive. */
  matches(other: RepositoryReference): boolean {
    return this.fullName.toLowerCase() === other.fullName.toLowerCase();
  }
}
