/**
 * The Fenro mark: an F drawn as a git graph, the stem a main line with a
 * branch curving off into the middle arm. `src/app/icon.svg` is the same
 * drawing in fixed colours; here it takes the pull-request tokens so it
 * follows the colour scheme.
 */
export function FenroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="8" className="fill-pr" />
      <g
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-on-pr"
      >
        <path d="M10.5 25V8.5h8" />
        <path d="M10.5 23c0-5 2-7 6.5-7" />
      </g>
      <g className="fill-on-pr">
        <circle cx="22.5" cy="8.5" r="3" />
        <circle cx="20.5" cy="16" r="3" />
      </g>
    </svg>
  );
}
