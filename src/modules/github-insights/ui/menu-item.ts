/**
 * The class every row of a menu shares, whether a link or a button. It lives
 * outside menu.tsx because a value exported from a client module reaches a
 * server component as a reference, not as the string.
 */
export const MENU_ITEM =
  "hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] focus-visible:outline-2";
