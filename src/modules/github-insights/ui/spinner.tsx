import { ArrowsClockwise } from "@phosphor-icons/react/ssr";

/** The one sign that something is on its way; it only turns without reduced motion. */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <ArrowsClockwise
      aria-hidden="true"
      className={`text-pr shrink-0 motion-safe:animate-spin ${className}`}
    />
  );
}
