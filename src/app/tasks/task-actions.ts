import type { TaskActions } from "@/modules/tasks/ui/task-forms";

import {
  answerQuestionnaireAction,
  changeKindAction,
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

export const TASK_ACTIONS: TaskActions = {
  create: createTaskAction,
  update: updateTaskAction,
  labels: setLabelsAction,
  kind: changeKindAction,
  edit: editTaskAction,
  note: recordNoteAction,
  checkCriterion: checkCriterionAction,
  changeStatus: changeStatusAction,
  link: linkTasksAction,
  removePicture: removePictureAction,
  answer: answerQuestionnaireAction,
};
