import { err, ok, ValueObject, type Result } from "@/shared/domain";

import { invalidCoordinates, type InvalidCoordinates } from "./errors";

type Props = {
  readonly owner: string;
  readonly name: string;
};

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Owner and repository name, validated. The only place an `owner/name` string
 * is parsed, so no other layer has to guess what a repository is called.
 */
export class RepositoryCoordinates extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static create(
    owner: string,
    name: string,
  ): Result<RepositoryCoordinates, InvalidCoordinates> {
    const trimmedOwner = owner.trim();
    const trimmedName = name.trim();

    if (!OWNER.test(trimmedOwner)) {
      return err(
        invalidCoordinates(
          `"${trimmedOwner}" is not a GitHub owner: letters, digits and hyphens only.`,
        ),
      );
    }
    if (
      !NAME.test(trimmedName) ||
      trimmedName === "." ||
      trimmedName === ".."
    ) {
      return err(
        invalidCoordinates(
          `"${trimmedName}" is not a GitHub repository name: letters, digits, ".", "_" and "-" only.`,
        ),
      );
    }

    return ok(
      new RepositoryCoordinates({ owner: trimmedOwner, name: trimmedName }),
    );
  }

  /** Parse the `owner/name` form people type and paste. */
  static parse(
    value: string,
  ): Result<RepositoryCoordinates, InvalidCoordinates> {
    const segments = value
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/");
    if (segments.length !== 2) {
      return err(
        invalidCoordinates(
          `Write the repository as "owner/name" — got "${value.trim()}".`,
        ),
      );
    }
    return RepositoryCoordinates.create(segments[0]!, segments[1]!);
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

  toString(): string {
    return this.fullName;
  }
}
