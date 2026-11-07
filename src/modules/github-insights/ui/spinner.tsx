import { ArrowsClockwise } from "@phosphor-icons/react/ssr";

export function Spinner({
  className = "size-3.5",
  colour = "text-pr",
}: {
  className?: string;
  colour?: string;
}) {
  return (
    <ArrowsClockwise
      aria-hidden="true"
      className={`${colour} shrink-0 motion-safe:animate-spin ${className}`}
    />
  );
}
