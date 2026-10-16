// `src/app/icon.svg` is the same drawing in fixed colours; keep them in step.
export function FenroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="8" className="fill-pr" />
      <g className="fill-on-pr">
        <rect x="7" y="6.5" width="5.5" height="5.5" rx="1.5" />
        <rect
          x="7"
          y="13.25"
          width="5.5"
          height="5.5"
          rx="1.5"
          fillOpacity=".6"
        />
        <rect x="7" y="20" width="5.5" height="5.5" rx="1.5" fillOpacity=".6" />
      </g>
      <g strokeWidth="3" strokeLinecap="round" className="stroke-on-pr">
        <path d="M16 9.25h9" />
        <path d="M16 16h5.5" />
      </g>
    </svg>
  );
}
