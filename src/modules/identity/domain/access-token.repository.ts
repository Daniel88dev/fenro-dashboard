import type { AccessToken } from "./access-token";

export interface AccessTokenRepository {
  findById(id: string): Promise<AccessToken | undefined>;
  findBySecretHash(secretHash: string): Promise<AccessToken | undefined>;
  /** Newest first. */
  listFor(ownerId: string): Promise<AccessToken[]>;
  save(token: AccessToken): Promise<void>;
}
