# Designing screens with design-taste-frontend

Every new screen, and every visible change to an existing one, starts as a
prototype made with the `design-taste-frontend` skill. The skill is vendored
at [`.claude/skills/design-taste-frontend/`](../../.claude/skills/design-taste-frontend/SKILL.md)
so any session opening this repository has it.

## The process

1. **Design read and dials.** Open with the skill's one-line design read
   (its section 0.B) and the three dials (section 1), using the Fenro values
   below unless the screen gives a reason to move them.
2. **Audit first on a redesign.** For a change to an existing screen, run the
   skill's redesign protocol (section 11) against the current code and list
   what to keep and what to retire.
3. **Prototype, then ask.** Build a clickable prototype that uses the real
   tokens from `src/app/globals.css`, in both schemes and at phone width, with
   invented data labelled as such. At most two directions: Daniel prefers one
   focused view to many competing concepts.
4. **Pre-flight.** Run the skill's pre-flight check (section 14), skipping
   the rows that only apply to marketing pages (hero, logo wall, bento,
   testimonials, marquee).
5. **Wait for a pick.** No implementation until Daniel has chosen a
   direction. Record the choice and the prototype link in `docs/ui/`.

## Where Fenro departs from the skill

The skill is written for landing pages and portfolios, and its section 13
says dashboards and data tables are out of scope. Fenro is a dashboard, so
the parts about taste, typography, states, contrast, motion discipline and
the AI tells apply in full, and these project rules win where the two
disagree:

- **Tokens, not `dark:`.** The skill offers the `dark:` variant as the
  Tailwind default. Fenro uses CSS-variable tokens under `@theme` and
  redefines them under `prefers-color-scheme: dark`. No component uses a
  `dark:` class. `src/app/palette.test.ts` holds every readable pair to
  4.5:1 in both schemes.
- **Semantic colours are not accents.** The one-accent rule (4.2) applies to
  decoration. Teal means pull requests and healthy, rust means issues and
  stale, amber means running. These carry meaning, always sit next to words
  that say the same thing, and stay.
- **The warm paper ground is a brand choice.** `#F6F5F1` is in the skill's
  premium-consumer ban list. That list is about cookware-style briefs; the
  ground was chosen and approved for this product and stays unless a
  prototype makes a case against it.
- **Density is high on purpose.** Dials for app screens:
  `DESIGN_VARIANCE 3`, `MOTION_INTENSITY 3`, `VISUAL_DENSITY 7`. Numbers are
  always Geist Mono. Motion is feedback and state change only (expanding a row, a sync in
  flight), always behind `prefers-reduced-motion`.
- **No design-system package.** The skill points dashboards at Fluent,
  Carbon or Primer. Fenro keeps its own small set of Tailwind components; do
  not add a system without a decision recorded here.
- **Icons.** When a screen needs icons, use Phosphor (`@phosphor-icons/react`)
  at one weight, per the skill's 3.C. Add the dependency with the first
  screen that uses it.
- **Inputs.** Text inputs that are not credentials carry the attributes that
  keep password managers off them (`autoComplete="off"`, `data-1p-ignore`,
  `data-lpignore`, `data-bwignore`, `data-form-type="other"`).
- **No skeleton loaders.** The skill's 4.5 asks for skeletons. Daniel does
  not want them: while data updates, the current data stays on screen and a
  quiet indicator says an update is in progress.
- **Copy.** No em-dashes or en-dashes in anything a reader sees (the skill's
  9.G). The middle dot is rationed to one per line.

## Prototype log

| Date       | What                             | Link                                                                                        | Outcome       |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------- | ------------- |
| 2026-09-20 | Repository table                 | [canvas](https://claude.ai/artifact/CHoCsPDAWY2tvnoL7gHW9t)                                 | Built (PR #3) |
| 2026-09-24 | Whole-app redesign, 2 directions | [canvas](https://claude.ai/artifact/Uj2hLnvUy6X9dYrzzAdDgr), [notes](./redesign-2026-09.md) | Awaiting pick |
