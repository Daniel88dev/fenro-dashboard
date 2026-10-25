import type { Picture } from "./picture";

export interface PictureRepository {
  pictureById(ownerId: string, id: string): Promise<Picture | undefined>;
  idsOnTask(ownerId: string, taskId: string): Promise<string[]>;
  add(picture: Picture): Promise<void>;
  remove(picture: Picture): Promise<void>;
}
