import { ChatCircleDots } from "@phosphor-icons/react/ssr";

export function questionsLabel(count: number, forYou = false): string {
  const noun = count === 1 ? "question" : "questions";
  return forYou ? `${count} ${noun} for you` : `${count} ${noun}`;
}

export function QuestionsChip({
  count,
  forYou = false,
}: {
  count: number;
  forYou?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      data-questions={count}
      className="bg-state-waiting-wash text-state-waiting border-state-waiting-line inline-flex shrink-0 items-center gap-1 rounded-md border px-[7px] py-px text-[11px] font-medium whitespace-nowrap"
    >
      <ChatCircleDots aria-hidden="true" weight="bold" className="size-3" />
      {questionsLabel(count, forYou)}
    </span>
  );
}
