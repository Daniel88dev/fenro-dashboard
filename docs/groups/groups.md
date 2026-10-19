# Groups and shared tasks

A group shares tasks between its members. Every task lives in a **space**:
the person's own (keys `T-1`, `T-2`…) or a group's, whose keys carry the
group's prefix (`HAL-1`, `HAL-2`…).

## Model

- **`groups` context** (`src/modules/groups/`). The `Group` aggregate holds a
  name, a key prefix, members (GitHub user id and login, role `owner` or
  `member`) and pending invitations addressed to a GitHub login.
- **Prefix**: 2 to 5 letters A to Z, so it can never be `T`; unique across all
  groups (`user_group_key_prefix_idx`); fixed once the group exists, so links,
  search and agents keep finding its tasks.
- **Rules the aggregate owns**: only owners invite, cancel invitations, change
  roles, remove others and delete; a group always keeps an owner, so the last
  owner can neither leave nor be demoted; one invitation per login.
- **Deleting** is refused while the group holds tasks, because it would take
  them from every member. Tasks cannot be deleted in the app yet.
- Someone outside a group gets "not found" for everything about it, unless
  they hold an invitation, which they accept or decline in Settings after
  signing in with that GitHub login.

## Tasks in a space

- A task's `owner_id` is a user id or a group id, and `task.key_prefix`
  (default `T`) is copied from the space when the task is created. Numbering,
  labels and skills are per owner, so a group gets its own sequence and
  label catalogue with no extra logic.
- Links (parent, sub-tasks, epics, blockers) never cross spaces: a key is
  resolved inside the task's own owner, and `HAL-12` never finds `T-12`.
- Command and query handlers still take an `ownerId`. Pages, server actions,
  route handlers and the MCP server resolve it at the boundary from the key's
  prefix and the spaces the person belongs to (`src/app/tasks/spaces.ts`).
  List queries accept several owners at once.
- A picture id names no space, so `/api/pictures/<id>` and `get_picture` ask
  each of the person's spaces in turn.

## Screens

- **Tasks**: a Spaces filter beside Labels and Repository, shown once the
  person belongs to a group: "Only my personal tasks" or "Personal and groups"
  with a tick per group, kept in `?spaces=T,HAL` (absent means every space).
  On phones it opens as a bottom sheet. A group task names its group in the
  row while more than one space is shown.
- **New task**: "In [space]" with the key the task will get. Parents and
  labels follow the chosen space; `?space=HAL` or a group parent picks it.
- **Settings > Groups**: the person's groups, invitations to join or decline,
  and the New group dialog with a live key preview.
- **`/groups/HAL`**: members, invite by GitHub username, roles, cancel an
  invitation, leave, and delete an empty group.

## Agents

An agent token acts as its person, so it reaches their personal tasks and
every group they belong to. `list_tasks` and `start_task` cover every space
(`list_tasks` takes `space` to narrow it); `save_task` files new work in the
parent's or `discovered_from`'s space, or the `space` it is given. Labels and
skills tools still work on the person's own catalogue.
