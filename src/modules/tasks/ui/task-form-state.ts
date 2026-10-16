/** `saved` counts successful saves, so a form can clear itself after each one. */
export type TaskFormState = {
  readonly error: string | null;
  readonly saved: number;
};

export const EMPTY_FORM_STATE: TaskFormState = { error: null, saved: 0 };
