import type { Picture } from "./picture";

export interface PictureRepository {
  pictureById(ownerId: string, id: string): Promise<Picture | undefined>;
  add(picture: Picture): Promise<void>;
  remove(picture: Picture): Promise<void>;
}
