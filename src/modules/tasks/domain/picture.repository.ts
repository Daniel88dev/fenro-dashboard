import type { Picture } from "./picture";

/**
 * Where pictures' records are kept; the bytes live behind the application's
 * `PictureStorage` port. Every lookup is scoped to its owner.
 */
export interface PictureRepository {
  pictureById(ownerId: string, id: string): Promise<Picture | undefined>;
  /** A picture is only ever added whole, never changed. */
  add(picture: Picture): Promise<void>;
  remove(picture: Picture): Promise<void>;
}
