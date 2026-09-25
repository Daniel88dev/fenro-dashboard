import {
  ArrowUpRight,
  DotsThree,
  EyeSlash,
  PushPin,
  PushPinSlash,
} from "@phosphor-icons/react/ssr";

import { Menu } from "./menu";
import { MENU_ITEM } from "./menu-item";

/** What you can do to a watched repository that is not reading it. */
export function RowMenu({
  owner,
  name,
  pinned = false,
  pinAction,
  unwatchAction,
}: {
  owner: string;
  name: string;
  pinned?: boolean;
  pinAction?: (formData: FormData) => Promise<void>;
  unwatchAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <Menu
      label={`More for ${owner}/${name}`}
      triggerClassName="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr grid size-7 place-items-center rounded-lg"
      trigger={
        <DotsThree aria-hidden="true" weight="bold" className="size-4" />
      }
    >
      <a
        href={`https://github.com/${owner}/${name}`}
        rel="noreferrer noopener"
        target="_blank"
        className={MENU_ITEM}
      >
        <ArrowUpRight aria-hidden="true" className="size-4" />
        Open on GitHub
      </a>
      {pinAction ? (
        <form action={pinAction}>
          <input type="hidden" name="owner" value={owner} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="pinned" value={String(!pinned)} />
          <button type="submit" className={MENU_ITEM}>
            {pinned ? (
              <PushPinSlash aria-hidden="true" className="size-4" />
            ) : (
              <PushPin aria-hidden="true" className="size-4" />
            )}
            {pinned ? "Unpin" : "Pin to top"}
            <span className="sr-only">{` ${owner}/${name}`}</span>
          </button>
        </form>
      ) : null}
      {unwatchAction ? (
        <form action={unwatchAction}>
          <input type="hidden" name="owner" value={owner} />
          <input type="hidden" name="name" value={name} />
          <button type="submit" className={`${MENU_ITEM} text-issue-strong`}>
            <EyeSlash aria-hidden="true" className="size-4" />
            Unwatch
            <span className="sr-only">{` ${owner}/${name}`}</span>
          </button>
        </form>
      ) : null}
    </Menu>
  );
}
