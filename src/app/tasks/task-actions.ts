import type { TaskActions } from "@/modules/tasks/ui/task-forms";

import {
  changeStatusAction,
  checkCriterionAction,
  createTaskAction,
  editTaskAction,
  linkTasksAction,
  recordNoteAction,
  removePictureAction,
  setLabelsAction,
  updateTaskAction,
} from "./actions";

/** The tasks screens' server actions, handed to the UI as one object. */
export const TASK_ACTIONS: TaskActions = {
  create: createTaskAction,
  update: updateTaskAction,
  labels: setLabelsAction,
  edit: editTaskAction,
  note: recordNoteAction,
  checkCriterion: checkCriterionAction,
  changeStatus: changeStatusAction,
  link: linkTasksAction,
  removePicture: removePictureAction,
};
