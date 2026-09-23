import type {
  AccessToken,
  AccessTokenRepository,
} from "@/modules/identity/domain";

/** For tests: tokens kept by reference, newest first. */
export class InMemoryAccessTokenRepository implements AccessTokenRepository {
  readonly #tokens = new Map<string, AccessToken>();

  async findById(id: string): Promise<AccessToken | undefined> {
    return this.#tokens.get(id);
  }

  async findBySecretHash(secretHash: string): Promise<AccessToken | undefined> {
    return [...this.#tokens.values()].find(
      (token) => token.secretHash === secretHash,
    );
  }

  async listFor(ownerId: string): Promise<AccessToken[]> {
    return [...this.#tokens.values()]
      .filter((token) => token.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async save(token: AccessToken): Promise<void> {
    this.#tokens.set(token.id.value, token);
  }
}
