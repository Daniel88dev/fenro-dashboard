import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/*
 * Task text is stored as the agent or person wrote it, and read here as
 * GitHub-flavoured Markdown: that is what agents write without being asked, and
 * what GitHub, Linear and Jira's MCP servers take too. Raw HTML is never
 * rendered (react-markdown drops it without rehype-raw) and unsafe URL schemes
 * are stripped by its default URL transform.
 *
 * A single newline is a line break, as in a GitHub issue or comment: journal
 * entries are often a few short lines, and joining them into one paragraph
 * would lose what the writer meant.
 */

const PLUGINS = [remarkGfm, remarkBreaks];

const external = {
  target: "_blank",
  rel: "noreferrer noopener",
} as const;

function isExternal(href: string | undefined): boolean {
  return !!href && /^[a-z][a-z0-9+.-]*:/i.test(href);
}

const INLINE: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      {...(isExternal(href) ? external : {})}
      className="text-pr-strong decoration-pr/40 hover:decoration-pr underline underline-offset-2"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="text-ink font-semibold">{children}</strong>
  ),
  code: ({ children }) => (
    <code className="bg-neutral-wash text-ink rounded-[4px] px-1 py-px font-mono text-[0.9em] wrap-break-word">
      {children}
    </code>
  ),
  // An image could be a tracking pixel or a huge file; the link is enough.
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      <a
        href={src}
        {...external}
        className="text-pr-strong underline underline-offset-2"
      >
        {alt || "Image"}
      </a>
    ) : null,
};

// The page already has its h1 and the section its h2, so Markdown headings
// start at h3 and stay small: they order a description, they do not title it.
const HEADING =
  "text-ink font-semibold tracking-tight mt-5 first:mt-0 mb-1.5 leading-snug";

const BLOCK: Components = {
  ...INLINE,
  h1: ({ children }) => (
    <h3 className={`${HEADING} text-[15px]`}>{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className={`${HEADING} text-[14.5px]`}>{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className={`${HEADING} text-[14px]`}>{children}</h5>
  ),
  h4: ({ children }) => (
    <h6 className={`${HEADING} text-[13.5px]`}>{children}</h6>
  ),
  h5: ({ children }) => (
    <h6 className={`${HEADING} text-ink-soft text-[13px]`}>{children}</h6>
  ),
  h6: ({ children }) => (
    <h6 className={`${HEADING} text-ink-soft text-[13px]`}>{children}</h6>
  ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={`my-2 flex flex-col gap-1 pl-5 first:mt-0 last:mb-0 [&_ol]:my-1 [&_ul]:my-1 ${
        className?.includes("contains-task-list")
          ? "list-none pl-0.5"
          : "marker:text-ink-faint list-disc [&_ul]:list-[circle]"
      }`}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="marker:text-ink-muted my-2 flex list-decimal flex-col gap-1 pl-5 first:mt-0 last:mb-0 [&_ol]:my-1 [&_ul]:my-1"
    >
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li
      className={`pl-0.5 ${
        className?.includes("task-list-item") ? "flex items-baseline gap-2" : ""
      }`}
    >
      {children}
    </li>
  ),
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled
      readOnly
      className="accent-pr translate-y-[1px]"
    />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-hairline text-ink-soft my-3 border-l-2 pl-3.5 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="bg-surface-sunken text-ink my-3 overflow-x-auto rounded-lg px-3.5 py-3 font-mono text-[12.5px] leading-relaxed first:mt-0 last:mb-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em] [&_code]:[overflow-wrap:normal]">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-hairline my-5 border-t" />,
  table: ({ children }) => (
    <div className="border-hairline my-3 overflow-x-auto rounded-lg border first:mt-0 last:mb-0">
      <table className="w-full border-collapse text-left text-[0.95em]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-sunken text-ink">{children}</thead>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-hairline border-b px-3 py-1.5 font-semibold"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className="border-hairline-soft border-t px-3 py-1.5 align-top first:border-t-0"
    >
      {children}
    </td>
  ),
  del: ({ children }) => <del className="text-ink-muted">{children}</del>,
};

/** A description, journal entry or handoff: block Markdown. */
export function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 wrap-break-word ${className}`}>
      <ReactMarkdown remarkPlugins={PLUGINS} components={BLOCK}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const INLINE_ELEMENTS = ["p", "a", "strong", "em", "code", "del", "br"];

/**
 * One line of Markdown, for criteria and evidence: emphasis, code and links
 * render; anything that would break the line (a list, a heading) is reduced
 * to its text.
 */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      components={{ ...INLINE, p: ({ children }) => <>{children}</> }}
    >
      {children}
    </ReactMarkdown>
  );
}
