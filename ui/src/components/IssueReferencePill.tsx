import type { ReactNode } from "react";
import type { IssueRelationIssueSummary } from "@paperclipai/shared";
import { Link, useInsideLink } from "@/lib/router";
import { cn } from "../lib/utils";
import { StatusIcon } from "./StatusIcon";

export function IssueReferencePill({
  issue,
  strikethrough,
  className,
  children,
}: {
  issue: Pick<IssueRelationIssueSummary, "id" | "identifier" | "title"> &
    Partial<Pick<IssueRelationIssueSummary, "status">>;
  strikethrough?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const insideLink = useInsideLink();
  const issueLabel = issue.identifier ?? issue.title;
  const classNames = cn(
    "paperclip-mention-chip paperclip-mention-chip--issue",
    "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs no-underline",
    issue.identifier && "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
    strikethrough && "opacity-60 line-through decoration-muted-foreground",
    className,
  );
  const content = (
    <>
      {issue.status ? <StatusIcon status={issue.status} className="h-3 w-3 shrink-0" /> : null}
      {children !== undefined ? children : <span>{issue.identifier ?? issue.title}</span>}
    </>
  );

  // Render a non-anchor span when there's no identifier to link to, or when we
  // are already inside another link (an <a> inside an <a> is invalid HTML — the
  // enclosing link owns the click). See InsideLinkContext in lib/router.
  if (!issue.identifier || insideLink) {
    return (
      <span
        data-mention-kind="issue"
        className={classNames}
        title={issue.title}
        aria-label={issue.identifier ? `Task ${issueLabel}: ${issue.title}` : `Task: ${issue.title}`}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to={`/issues/${issueLabel}`}
      data-mention-kind="issue"
      className={classNames}
      title={issue.title}
      aria-label={`Task ${issueLabel}: ${issue.title}`}
    >
      {content}
    </Link>
  );
}
