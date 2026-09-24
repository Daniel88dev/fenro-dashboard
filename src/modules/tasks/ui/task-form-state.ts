/**
 * What a task form's server action answers. `saved` counts successful saves,
 * so a form can clear itself after each one without guessing.
 */
export type TaskFormState = {
  readonly error: string | null;
  readonly saved: number;
};

export const EMPTY_FORM_STATE: TaskFormState = { error: null, saved: 0 };
