import { PushPin } from "@phosphor-icons/react/ssr";

/**
 * Sits beside the repository name. A pinned row always shows it, filled, as
 * the marker that explains why the row is on top; pressing it unpins. An
 * unpinned row shows an outline pin only while the pointer or focus is on the
 * row, from md up; on a phone the row menu does the pinning.
 */
export function PinButton({
  owner,
  name,
  pinned,
  pinAction,
}: {
  owner: string;
  name: string;
  pinned: boolean;
  pinAction: (formData: FormData) => Promise<void>;
}) {
  const label = pinned
    ? `Unpin ${owner}/${name}`
    : `Pin ${owner}/${name} to the top`;
  return (
    <form
      action={pinAction}
      className={
        pinned
          ? "flex"
          : "hidden md:flex md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100"
      }
    >
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="pinned" value={String(!pinned)} />
      <button
        type="submit"
        aria-label={label}
        aria-pressed={pinned}
        title={pinned ? "Pinned. Press to unpin" : "Pin to the top"}
        className="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr grid size-6 cursor-pointer place-items-center rounded-md focus-visible:outline-2"
      >
        <PushPin
          aria-hidden="true"
          weight={pinned ? "fill" : "regular"}
          className="size-[14px]"
        />
      </button>
    </form>
  );
}
