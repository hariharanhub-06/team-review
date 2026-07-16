import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders a member's free-text notes, which in practice are pasted markdown
 * (headings, bold, bullet lists). Without this they read as literal `##` and
 * `**` noise.
 *
 * Raw HTML is deliberately NOT enabled (no rehype-raw): this text comes from
 * users, and react-markdown escapes embedded HTML by default. Keep it that way.
 *
 * Prose styling is done here by hand rather than with a typography plugin, and
 * is deliberately tight — these render inside table detail panels and modals,
 * so the default heading/paragraph margins would be far too airy.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-2 break-words text-sm leading-relaxed [overflow-wrap:anywhere]",
        // Headings: markdown levels compress to two visual sizes — the notes are
        // short, so h1..h6 don't need six distinct steps.
        "[&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground",
        "[&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-muted-foreground",
        "[&_h4]:mt-2 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-muted-foreground",
        "[&_h5]:mt-2 [&_h5]:text-xs [&_h5]:font-semibold [&_h5]:text-muted-foreground",
        "[&_h6]:mt-2 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:text-muted-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:marker:text-muted-foreground",
        "[&_a]:text-primary [&_a]:underline",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_hr]:border-border",
        "[&_table]:w-full [&_table]:text-xs",
        "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
