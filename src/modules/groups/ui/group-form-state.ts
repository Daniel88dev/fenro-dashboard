/** `saved` counts successful saves, so a form can clear itself after each one. */
export type GroupFormState = {
  readonly error: string | null;
  readonly saved: number;
};

export const EMPTY_GROUP_FORM: GroupFormState = { error: null, saved: 0 };

export type GroupAction = (
  state: GroupFormState,
  formData: FormData,
) => Promise<GroupFormState>;
