import { ArrowUpRight, DotsThree, EyeSlash } from "@phosphor-icons/react/ssr";

import { Menu } from "./menu";
import { MENU_ITEM } from "./menu-item";

/** What you can do to a watched repository that is not reading it. */
export function RowMenu({
  owner,
  name,
  unwatchAction,
}: {
  owner: string;
  name: string;
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
